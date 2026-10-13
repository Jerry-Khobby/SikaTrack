"""Monthly spending limits per category."""

import uuid
from decimal import Decimal
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import clock, ids
from sikatrack_api.models import Budget
from sikatrack_api.schemas.common import to_pesewa
from sikatrack_api.schemas.reads import BudgetUse, CategorySummary
from sikatrack_api.schemas.user_input import BudgetList, BudgetOut, BudgetPut
from sikatrack_api.services import summaries, warehouse
from sikatrack_api.services.user_input import selectable_category, unknown_category
from sikatrack_api.services.warehouse import DateRange, category_ref, category_slug

ZERO = Decimal("0.00")


def _state(used: Decimal, thresholds: list[Decimal]) -> Literal["on_track", "warning", "over"]:
    if used >= 1:
        return "over"
    return "warning" if used >= min(thresholds) else "on_track"


async def list_budgets(session: AsyncSession, user_id: uuid.UUID, month: DateRange) -> BudgetList:
    rows = (
        (
            await session.execute(
                select(Budget).where(Budget.user_id == user_id).order_by(Budget.category_name)
            )
        )
        .scalars()
        .all()
    )
    spend = await summaries.by_category(session, user_id, month, provider=None, group="spending")
    spent_by_name = {item.category.name: item.amount for item in spend.items}
    groups = {item.category.name: item.category.group for item in spend.items}

    today = clock.utcnow().date()
    elapsed = (min(today, month.end) - month.start).days + 1 if today >= month.start else 0
    items = []
    for budget in rows:
        spent = spent_by_name.get(budget.category_name, ZERO)
        used = spent / budget.monthly_limit
        projected = to_pesewa(spent * month.days / elapsed) if elapsed else spent
        ref = category_ref(budget.category_name, groups.get(budget.category_name, "Spending"))
        assert ref is not None
        items.append(
            BudgetOut(
                id=ids.encode("bud", budget.id),
                category=ref,
                limit=budget.monthly_limit,
                spent=spent,
                remaining=max(budget.monthly_limit - spent, ZERO),
                used=used,
                projected=projected,
                state=_state(used, budget.alert_thresholds),
                alert_thresholds=budget.alert_thresholds,
            )
        )
    return BudgetList(month=month.start.strftime("%Y-%m"), items=items)


async def put_budget(session: AsyncSession, user_id: uuid.UUID, slug: str, body: BudgetPut) -> BudgetOut:
    name = await selectable_category(session, slug, "category_id")
    budget = await session.scalar(
        select(Budget).where(Budget.user_id == user_id, Budget.category_name == name)
    )
    if budget is None:
        budget = Budget(user_id=user_id, category_name=name)
        session.add(budget)
    budget.monthly_limit = body.limit
    budget.alert_thresholds = sorted(set(body.alert_thresholds))
    await session.commit()
    month = summaries.month_range(clock.utcnow().date())
    current = await list_budgets(session, user_id, month)
    return next(b for b in current.items if b.category.id == category_slug(name))


async def delete_budget(session: AsyncSession, user_id: uuid.UUID, slug: str) -> None:
    names = {category_slug(b.category_name): b for b in (
        await session.execute(select(Budget).where(Budget.user_id == user_id))
    ).scalars()}  # fmt: skip
    budget = names.get(slug)
    if budget is None:
        raise unknown_category(slug)
    await session.delete(budget)
    await session.commit()


async def attach_to_categories(
    session: AsyncSession, user_id: uuid.UUID, result: CategorySummary
) -> CategorySummary:
    """Adds each category's budget use to a category summary (for the categories screen)."""
    limits = {
        b.category_name: b.monthly_limit
        for b in (await session.execute(select(Budget).where(Budget.user_id == user_id))).scalars()
    }
    for item in result.items:
        limit = limits.get(item.category.name)
        if limit is not None:
            item.budget = BudgetUse(limit=limit, used=item.amount / limit)
    return result


def month_of(value: str | None) -> DateRange:
    if value is None:
        return summaries.month_range(clock.utcnow().date())
    return warehouse.resolve_period(value, None, None)
