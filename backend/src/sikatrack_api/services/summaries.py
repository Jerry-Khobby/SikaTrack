"""Summaries for the app's screens. The definitions match the dashboards' measures:
money out/in leave out transfers between your own wallets; fees are every fee and tax charged;
the daily average divides by the days of the period that fall inside your data."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api.schemas.common import to_pesewa
from sikatrack_api.schemas.reads import (
    CategorySpend,
    CategorySummary,
    Comparison,
    CounterpartySpend,
    CounterpartySummary,
    HabitCell,
    Habits,
    HourSpend,
    Peak,
    Period,
    Summary,
    TopCategory,
    Trend,
    TrendPoint,
)
from sikatrack_api.services import recurring, warehouse
from sikatrack_api.services.transactions import TX
from sikatrack_api.services.warehouse import DateRange, category_ref, counterparty_ref

ZERO = Decimal("0")


def _ratio(part: Decimal, whole: Decimal) -> Decimal | None:
    return part / whole if whole else None


def _change(now: Decimal, before: Decimal) -> Decimal | None:
    return (now - before) / before if before else None


def _filters(provider: str | None) -> tuple[str, dict[str, Any]]:
    return ("AND provider_code = :provider", {"provider": provider}) if provider else ("", {})


async def _totals(session: AsyncSession, user_id: uuid.UUID, period: DateRange, provider: str | None) -> Any:
    extra, params = _filters(provider)
    sql = f"""{TX}
    SELECT COALESCE(sum(money_out), 0) AS money_out, COALESCE(sum(money_in), 0) AS money_in,
           COALESCE(sum(total_cost), 0) AS fees,
           count(*) FILTER (WHERE money_out > 0) AS spending_transactions,
           bool_or(status = 'provisional') AS any_provisional
    FROM txc WHERE date BETWEEN :start AND :end {extra}"""
    return (
        await session.execute(text(sql), {"uid": user_id, "start": period.start, "end": period.end, **params})
    ).one()


async def data_days(session: AsyncSession, user_id: uuid.UUID, period: DateRange) -> int:
    """Days of the period inside the user's data (so an average isn't diluted by empty days)."""
    first, last = (
        await session.execute(text(f"{TX} SELECT min(date), max(date) FROM txc"), {"uid": user_id})
    ).one()
    if first is None:
        return 0
    start, end = max(period.start, first), min(period.end, last)
    return max(int((end - start).days) + 1, 0)


async def summary(
    session: AsyncSession, user_id: uuid.UUID, period: DateRange, provider: str | None
) -> Summary:
    await warehouse.scope(session, user_id)
    now = await _totals(session, user_id, period, provider)
    before_period = period.previous()
    before = await _totals(session, user_id, before_period, provider)
    days = await data_days(session, user_id, period)
    categories = await by_category(session, user_id, period, provider, "spending")
    top = categories.items[0] if categories.items else None
    series = await recurring.list_series(session, user_id, status="active")
    return Summary(
        period=Period(from_=period.start, to=period.end, days=period.days),
        money_out=now.money_out,
        money_in=now.money_in,
        net=now.money_in - now.money_out,
        fees=now.fees,
        avg_daily_spend=to_pesewa(now.money_out / days) if days else ZERO,
        spending_transactions=now.spending_transactions,
        compare=Comparison(
            period=Period(from_=before_period.start, to=before_period.end),
            money_out=before.money_out,
            money_out_change=_change(now.money_out, before.money_out),
            money_in_change=_change(now.money_in, before.money_in),
        ),
        top_category=TopCategory(id=top.category.id, name=top.category.name, share=top.share)
        if top
        else None,
        recurring_monthly_cost=series.monthly_cost,
        includes_provisional=bool(now.any_provisional),
    )


async def by_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    period: DateRange,
    provider: str | None,
    group: Literal["spending", "money_in", "all"],
) -> CategorySummary:
    await warehouse.scope(session, user_id)
    extra, params = _filters(provider)
    amount = {"spending": "money_out", "money_in": "money_in", "all": "money_out + money_in"}[group]
    group_filter = {
        "spending": "AND category_group = 'Spending'",
        "money_in": "AND category_group = 'Money In'",
        "all": "",
    }[group]
    sql = f"""{TX}
    SELECT category_name, category_group, sum({amount}) AS amount, count(*) AS n
    FROM txc WHERE date BETWEEN :start AND :end AND NOT is_own_transfer {group_filter} {extra}
    GROUP BY category_name, category_group HAVING sum({amount}) > 0
    ORDER BY amount DESC, category_name"""
    rows = (
        await session.execute(text(sql), {"uid": user_id, "start": period.start, "end": period.end, **params})
    ).all()
    total = sum((r.amount for r in rows), ZERO)
    items = []
    for r in rows:
        ref = category_ref(r.category_name, r.category_group)
        assert ref is not None
        items.append(CategorySpend(category=ref, amount=r.amount, share=r.amount / total, transactions=r.n))
    return CategorySummary(period=Period(from_=period.start, to=period.end), total=total, items=items)


async def trend(
    session: AsyncSession,
    user_id: uuid.UUID,
    period: DateRange,
    provider: str | None,
    granularity: Literal["day", "week", "month"],
) -> Trend:
    await warehouse.scope(session, user_id)
    extra, params = _filters(provider)
    sql = f"""{TX},
    buckets AS (
        SELECT generate_series(date_trunc(:g, CAST(:start AS date)), date_trunc(:g, CAST(:end AS date)),
                               CAST('1 ' || :g AS interval))::date AS bucket
    )
    SELECT b.bucket, COALESCE(sum(t.money_out), 0) AS money_out, COALESCE(sum(t.money_in), 0) AS money_in,
           COALESCE(sum(t.total_cost), 0) AS fees
    FROM buckets b
    LEFT JOIN txc t ON date_trunc(:g, t.date)::date = b.bucket AND t.date BETWEEN :start AND :end {extra}
    GROUP BY b.bucket ORDER BY b.bucket"""
    rows = (
        await session.execute(
            text(sql), {"uid": user_id, "start": period.start, "end": period.end, "g": granularity, **params}
        )
    ).all()

    def label(day: date) -> str:
        return day.strftime("%Y-%m") if granularity == "month" else day.isoformat()

    return Trend(
        granularity=granularity,
        items=[
            TrendPoint(period=label(r.bucket), money_out=r.money_out, money_in=r.money_in, fees=r.fees)
            for r in rows
        ],
    )


async def top_counterparties(
    session: AsyncSession,
    user_id: uuid.UUID,
    period: DateRange,
    provider: str | None,
    direction: Literal["out", "in"],
    limit: int,
) -> CounterpartySummary:
    await warehouse.scope(session, user_id)
    extra, params = _filters(provider)
    amount = "money_out" if direction == "out" else "money_in"
    sql = f"""{TX}
    SELECT counterparty_name, max(counterparty_kind) AS kind, max(alias) AS alias,
           sum({amount}) AS amount, count(*) AS n
    FROM txc WHERE date BETWEEN :start AND :end AND counterparty_name IS NOT NULL AND {amount} > 0 {extra}
    GROUP BY counterparty_name ORDER BY amount DESC, counterparty_name LIMIT :limit"""
    rows = (
        await session.execute(
            text(sql), {"uid": user_id, "start": period.start, "end": period.end, "limit": limit, **params}
        )
    ).all()
    items = []
    for r in rows:
        ref = counterparty_ref(r.counterparty_name, r.kind, r.alias)
        assert ref is not None
        items.append(CounterpartySpend(counterparty=ref, amount=r.amount, transactions=r.n))
    return CounterpartySummary(items=items)


async def habits(
    session: AsyncSession, user_id: uuid.UUID, period: DateRange, provider: str | None
) -> Habits:
    await warehouse.scope(session, user_id)
    extra, params = _filters(provider)
    bind = {"uid": user_id, "start": period.start, "end": period.end, **params}
    spend = f"FROM txc WHERE date BETWEEN :start AND :end AND money_out > 0 {extra}"
    grid = (
        await session.execute(
            text(
                f"{TX} SELECT weekday, day_part, sum(money_out) AS amount {spend} GROUP BY weekday, day_part"
            ),
            bind,
        )
    ).all()
    hours = (
        await session.execute(text(f"{TX} SELECT hour, sum(money_out) AS amount {spend} GROUP BY hour"), bind)
    ).all()
    stats = (
        await session.execute(
            text(f"""{TX} SELECT sum(money_out) FILTER (WHERE is_weekend) AS weekend, sum(money_out) AS total,
                     percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) AS median {spend}"""),
            bind,
        )
    ).one()
    peak = max(grid, key=lambda r: r.amount, default=None)
    by_hour = {r.hour: r.amount for r in hours}
    return Habits(
        grid=[HabitCell(weekday=r.weekday, day_part=r.day_part, amount=r.amount) for r in grid],
        by_hour=[HourSpend(hour=h, amount=by_hour.get(h, ZERO)) for h in range(24)],
        peak=Peak(weekday=peak.weekday if peak else None, day_part=peak.day_part if peak else None),
        weekend_share=_ratio(stats.weekend or ZERO, stats.total) if stats.total else None,
        median_payment=Decimal(str(stats.median)).quantize(Decimal("0.01"))
        if stats.median is not None
        else None,
    )


def month_range(day: date) -> DateRange:
    first = day.replace(day=1)
    return DateRange(first, (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))
