"""Alert rules: when to tell the user something, in the inbox and by push.

Every alert goes through `notify`, which inserts with ON CONFLICT DO NOTHING on the alert's
dedupe key. If the row already existed (the alert was sent before, maybe by another API
instance at the same moment), nothing is pushed. That is what makes "one alert per budget
threshold per month" hold, however many payments cross it.

The user's notification settings switch each kind on or off; sync problems always go out.
"""

import logging
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Literal

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from sikatrack_api import clock
from sikatrack_api.config import Settings
from sikatrack_api.models import Device, Notification, RecurringPreference, User
from sikatrack_api.providers import PushMessage, PushSender
from sikatrack_api.schemas.me import UserSettings
from sikatrack_api.services import balances, budgets, recurring, summaries
from sikatrack_api.services.warehouse import DateRange

log = logging.getLogger(__name__)

Event = Literal["upload", "pipeline_succeeded", "pipeline_failed", "scheduled"]


async def notify(
    session: AsyncSession,
    pusher: PushSender,
    user_id: uuid.UUID,
    *,
    kind: str,
    key: str,
    title: str,
    body: str,
    link: str | None = None,
) -> bool:
    """Create the alert unless it exists; push it if it was new. Returns whether it was new."""
    created = (
        await session.execute(
            insert(Notification)
            .values(user_id=user_id, kind=kind, dedupe_key=key, title=title, body=body, link=link)
            .on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"])
            .returning(Notification.id)
        )
    ).scalar()
    if created is None:
        return False
    await session.commit()  # recorded before pushing: a push failure can't cause a duplicate later
    tokens = (
        (
            await session.execute(
                select(Device.push_token).where(Device.user_id == user_id, Device.push_token.is_not(None))
            )
        )
        .scalars()
        .all()
    )
    try:
        dead = await pusher.send(
            [PushMessage(token=t, title=title, body=body, link=link) for t in tokens if t]
        )
    except Exception as exc:
        log.warning("Push failed; the alert stays in the inbox", extra={"error_type": type(exc).__name__})
        return True
    if dead:
        await session.execute(update(Device).where(Device.push_token.in_(dead)).values(push_token=None))
    await session.execute(
        update(Notification).where(Notification.id == created).values(pushed_at=clock.utcnow())
    )
    await session.commit()
    return True


async def evaluate(
    session: AsyncSession, pusher: PushSender, user: User, event: Event, run_id: str | None = None
) -> int:
    """Run the rules that apply to this event. Returns how many alerts were created."""
    prefs = UserSettings.model_validate(user.settings)
    sent = 0
    if event == "pipeline_failed":
        day = clock.utcnow().date().isoformat()
        sent += await notify(
            session, pusher, user.id, kind="sync_problem", key=f"sync_problem:{day}",
            title="Your latest SMS are taking longer",
            body="We hit a problem processing them and will retry. Nothing is lost.",
        )  # fmt: skip
        return sent
    if prefs.notify.budget:
        sent += await _budgets(session, pusher, user)
    if prefs.notify.low_balance:
        sent += await _low_balance(session, pusher, user, prefs.low_balance_threshold)
    if event == "pipeline_succeeded":
        if prefs.notify.recurring:
            sent += await _recurring(session, pusher, user)
        if prefs.notify.data_ready and run_id:
            sent += await notify(
                session, pusher, user.id, kind="data_ready", key=f"data_ready:{run_id}",
                title="Your transactions are up to date", body="New SMS have been processed.",
                link="sikatrack://transactions",
            )  # fmt: skip
    return sent


async def _budgets(session: AsyncSession, pusher: PushSender, user: User) -> int:
    month = summaries.month_range(clock.utcnow().date())
    label = month.start.strftime("%Y-%m")
    sent = 0
    for budget in (await budgets.list_budgets(session, user.id, month)).items:
        crossed = [t for t in budget.alert_thresholds if budget.used >= t]
        if not crossed:
            continue
        top = max(crossed)  # several crossed at once: one alert, for the highest
        existing = (
            (
                await session.execute(
                    select(Notification.dedupe_key).where(
                        Notification.user_id == user.id,
                        Notification.dedupe_key.like(f"budget:{budget.category.id}:{label}:%"),
                    )
                )
            )
            .scalars()
            .all()
        )
        if any(Decimal(k.rsplit(":", 1)[1]) >= top for k in existing):
            continue  # already told about this level or a higher one
        over = top >= 1
        days_left = (month.end - clock.utcnow().date()).days
        sent += await notify(
            session, pusher, user.id,
            kind="budget_over" if over else "budget_warning",
            key=f"budget:{budget.category.id}:{label}:{top:.3f}",
            title=f"{budget.category.name} budget {'is used up' if over else f'at {top:.0%}'}",
            body=f"GHS {budget.spent:,.0f} of GHS {budget.limit:,.0f} spent, {days_left} days left.",
            link=f"sikatrack://budgets/{budget.category.id}",
        )  # fmt: skip
    return sent


async def _low_balance(session: AsyncSession, pusher: PushSender, user: User, threshold: Decimal) -> int:
    latest = await balances.latest(session, user.id)
    if not latest.items or latest.total >= threshold:
        return 0
    return int(
        await notify(
            session,
            pusher,
            user.id,
            kind="low_balance",
            key=f"low_balance:{clock.utcnow().date()}",
            title="Your balance is low",
            body=f"GHS {latest.total:,.2f} across your wallets, below your GHS {threshold:,.0f} alert.",
            link="sikatrack://balances",
        )
    )


async def _recurring(session: AsyncSession, pusher: PushSender, user: User) -> int:
    series = await recurring.list_series(session, user.id, status="active")
    plans = {
        p.recurring_series: p
        for p in (
            await session.execute(select(RecurringPreference).where(RecurringPreference.user_id == user.id))
        ).scalars()
    }
    sent = 0
    for s in series.items:
        sid = s.id.removeprefix("rec_")
        plan = plans.get(sid)
        if plan is None:
            sent += await notify(
                session, pusher, user.id, kind="new_recurring", key=f"recurring:{sid}",
                title="A new recurring payment",
                body=f"{s.label}: about GHS {s.monthly_cost:,.0f} a month.",
                link=f"sikatrack://recurring/{s.id}",
            )  # fmt: skip
        elif plan.user_state == "cancel_planned" and s.last_paid_at > plan.updated_at:
            sent += await notify(
                session, pusher, user.id, kind="recurring_still_charging",
                key=f"recurring_charge:{sid}:{s.last_paid_at.date()}",
                title="A payment you meant to stop charged again",
                body=f"{s.label} took GHS {s.typical_amount:,.2f} on {s.last_paid_at:%d %b}.",
                link=f"sikatrack://recurring/{s.id}",
            )  # fmt: skip
    return sent


async def evaluate_for(
    factory: async_sessionmaker[AsyncSession],
    pusher: PushSender,
    user_id: uuid.UUID,
    event: Event,
    run_id: str | None = None,
) -> None:
    """Background version (after an upload or a run): its own session; never raises."""
    try:
        async with factory() as session:
            user = await session.get(User, user_id)
            if user is not None and user.status == "active":
                await evaluate(session, pusher, user, event, run_id)
    except Exception:
        log.exception("Alert rules failed", extra={"user_id": str(user_id), "event": event})


async def weekly_digests(
    factory: async_sessionmaker[AsyncSession], pusher: PushSender, settings: Settings
) -> int:
    """Mondays (by default): last week's spending, for users who want it. Dedupe per ISO week,
    so running this every pass sends each digest once."""
    now = clock.utcnow()
    if now.isoweekday() != settings.weekly_digest_weekday or now.hour < settings.weekly_digest_hour_utc:
        return 0
    year, week, _ = now.isocalendar()
    last_week = DateRange(now.date() - timedelta(days=7), now.date() - timedelta(days=1))
    sent = 0
    async with factory() as session:
        users = (await session.execute(select(User).where(User.status == "active"))).scalars().all()
        for user in users:
            if not UserSettings.model_validate(user.settings).notify.weekly_digest:
                continue
            summary = await summaries.summary(session, user.id, last_week, provider=None)
            if summary.money_out == 0 and summary.money_in == 0:
                continue
            change = summary.compare.money_out_change
            trend = (
                ""
                if change is None
                else f", {'up' if change > 0 else 'down'} {abs(change):.0%} on the week before"
            )
            sent += await notify(
                session, pusher, user.id, kind="weekly_digest", key=f"digest:{year}-W{week:02d}",
                title="Your week in MoMo",
                body=f"You spent GHS {summary.money_out:,.0f}{trend}.",
                link="sikatrack://summary",
            )  # fmt: skip
    return sent
