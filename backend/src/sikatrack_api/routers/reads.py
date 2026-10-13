"""The read API: what the app's screens show. All of it is the caller's own data only."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from sikatrack_api import ids
from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep
from sikatrack_api.schemas.me import UserSettings
from sikatrack_api.schemas.reads import (
    BalanceHistory,
    Balances,
    CategoryList,
    CategorySummary,
    Counterparty,
    CounterpartyPage,
    CounterpartySummary,
    Habits,
    InsightList,
    RecurringList,
    RecurringSeries,
    Summary,
    TransactionDetail,
    TransactionPage,
    Trend,
)
from sikatrack_api.services import (
    balances,
    budgets,
    catalog,
    insights,
    recurring,
    summaries,
    transactions,
    warehouse,
)
from sikatrack_api.services.wallets import get_wallet
from sikatrack_api.services.warehouse import resolve_period

router = APIRouter(prefix="/v1")

From = Annotated[date | None, Query(alias="from", description="First day, inclusive")]
To = Annotated[date | None, Query(alias="to", description="Last day, inclusive")]
Month = Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$", description="Instead of from/to: YYYY-MM")]
Provider = Annotated[str | None, Query(max_length=30)]
Limit = Annotated[int, Query(ge=1, le=100)]


# ---- transactions ----------------------------------------------------------------------


@router.get("/transactions", tags=["transactions"], summary="Your transactions, newest first")
async def list_transactions(
    me: CurrentUserDep,
    session: SessionDep,
    start: From = None,
    end: To = None,
    direction: Literal["in", "out"] | None = None,
    category: Annotated[list[str] | None, Query(description="Category id; repeat for several")] = None,
    provider: Provider = None,
    wallet_id: str | None = None,
    counterparty_id: str | None = None,
    recurring_id: str | None = None,
    include_own_transfers: bool = False,
    q: Annotated[str | None, Query(min_length=2, max_length=60)] = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    limit: Limit = 50,
    cursor: str | None = None,
) -> TransactionPage:
    period = resolve_period(None, start, end, default="30d")
    if wallet_id is not None:
        provider = (await get_wallet(session, me.id, wallet_id)).provider_code
    return await transactions.list_transactions(
        session,
        me.id,
        start=period.start,
        end=period.end,
        direction=direction,
        categories=await transactions.category_names(session, category) if category else None,
        provider=provider,
        counterparty=warehouse.counterparty_name(counterparty_id) if counterparty_id else None,
        series=warehouse.recurring_series(recurring_id) if recurring_id else None,
        include_own_transfers=include_own_transfers,
        q=q,
        min_amount=min_amount,
        max_amount=max_amount,
        limit=limit,
        cursor=cursor,
    )


@router.get("/transactions/{transaction_id}", tags=["transactions"], summary="One transaction, with its SMS")
async def get_transaction(transaction_id: str, me: CurrentUserDep, session: SessionDep) -> TransactionDetail:
    return await transactions.get_transaction(session, me.id, transaction_id)


# ---- summaries -------------------------------------------------------------------------


@router.get("/summary", tags=["summary"], summary="The home screen: totals and change vs the period before")
async def get_summary(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None,
    provider: Provider = None,
) -> Summary:  # fmt: skip
    return await summaries.summary(session, me.id, resolve_period(month, start, end), provider)


@router.get("/summary/categories", tags=["summary"], summary="Spending (or income) by category")
async def get_categories_summary(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None,
    provider: Provider = None, group: Literal["spending", "money_in", "all"] = "spending",
) -> CategorySummary:  # fmt: skip
    result = await summaries.by_category(session, me.id, resolve_period(month, start, end), provider, group)
    return await budgets.attach_to_categories(session, me.id, result)


@router.get("/summary/trend", tags=["summary"], summary="Money in, out and fees over time (zero-filled)")
async def get_trend(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None,
    provider: Provider = None, granularity: Literal["day", "week", "month"] = "month",
) -> Trend:  # fmt: skip
    period = resolve_period(month, start, end)
    if granularity == "day" and period.days > 400:
        raise warehouse.bad_request("granularity", "Daily points for at most 400 days; use week or month")
    return await summaries.trend(session, me.id, period, provider, granularity)


@router.get("/summary/counterparties", tags=["summary"], summary="Who you paid (or who paid you) the most")
async def get_counterparties_summary(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None,
    provider: Provider = None, direction: Literal["out", "in"] = "out", limit: Limit = 10,
) -> CounterpartySummary:  # fmt: skip
    period = resolve_period(month, start, end)
    return await summaries.top_counterparties(session, me.id, period, provider, direction, limit)


@router.get("/summary/habits", tags=["summary"], summary="When you spend: weekday x time of day, by hour")
async def get_habits(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None,
    provider: Provider = None,
) -> Habits:  # fmt: skip
    return await summaries.habits(session, me.id, resolve_period(month, start, end), provider)


# ---- balances ---------------------------------------------------------------------------


@router.get("/balances", tags=["balances"], summary="Latest balance per wallet")
async def get_balances(me: CurrentUserDep, session: SessionDep) -> Balances:
    return await balances.latest(session, me.id)


@router.get("/balances/history", tags=["balances"], summary="End-of-day balance per wallet")
async def get_balance_history(
    me: CurrentUserDep, session: SessionDep, start: From = None, end: To = None
) -> BalanceHistory:
    period = resolve_period(None, start, end, default="30d")
    threshold = UserSettings.model_validate(me.user.settings).low_balance_threshold
    return await balances.history(session, me.id, period.start, period.end, threshold)


# ---- categories, counterparties, recurring ---------------------------------------------


@router.get("/categories", tags=["categories"], summary="Every category, for pickers and icons")
async def get_categories(me: CurrentUserDep, session: SessionDep) -> CategoryList:
    return await catalog.categories(session)


@router.get("/counterparties", tags=["counterparties"], summary="Who you've paid or been paid by")
async def get_counterparties(
    me: CurrentUserDep,
    session: SessionDep,
    q: Annotated[str | None, Query(min_length=2, max_length=60)] = None,
    kind: Literal["person", "merchant", "agent", "telco", "bank", "own_wallet", "unknown"] | None = None,
    limit: Limit = 50,
    cursor: str | None = None,
) -> CounterpartyPage:
    return await catalog.counterparties(session, me.id, q, kind, limit, cursor)


@router.get("/counterparties/{counterparty_id}", tags=["counterparties"], summary="One counterparty")
async def get_counterparty(counterparty_id: str, me: CurrentUserDep, session: SessionDep) -> Counterparty:
    found = await catalog.counterparty(session, me.id, warehouse.counterparty_name(counterparty_id))
    if found is None:
        raise ids.not_found()
    return found


@router.get("/recurring", tags=["recurring"], summary="Recurring payments")
async def get_recurring(
    me: CurrentUserDep, session: SessionDep, status: Literal["active", "stopped", "all"] = "active"
) -> RecurringList:
    return await recurring.list_series(session, me.id, status)


@router.get("/recurring/{recurring_id}", tags=["recurring"], summary="One recurring series")
async def get_recurring_series(recurring_id: str, me: CurrentUserDep, session: SessionDep) -> RecurringSeries:
    return await recurring.get_series(session, me.id, recurring_id)


@router.get("/recurring/{recurring_id}/transactions", tags=["recurring"], summary="A series' payments")
async def get_recurring_transactions(
    recurring_id: str, me: CurrentUserDep, session: SessionDep, limit: Limit = 50, cursor: str | None = None
) -> TransactionPage:
    series = warehouse.recurring_series(recurring_id)
    return await transactions.list_transactions(
        session, me.id, start=date(2000, 1, 1), end=date(2999, 12, 31), series=series,
        include_own_transfers=True, limit=limit, cursor=cursor,
    )  # fmt: skip


# ---- insights ---------------------------------------------------------------------------


@router.get("/insights", tags=["insights"], summary="Short cards for the home screen")
async def get_insights(
    me: CurrentUserDep, session: SessionDep, month: Month = None, start: From = None, end: To = None
) -> InsightList:
    return await insights.insights(session, me.id, resolve_period(month, start, end))
