"""The read API: transactions, summaries, balances, categories, counterparties, recurring, insights."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from sikatrack_api.schemas.common import Money, Ratio

CategoryGroup = Literal["spending", "money_in", "own_money", "unknown"]


class CategoryRef(BaseModel):
    id: str = Field(examples=["airtime_data"])
    name: str
    group: CategoryGroup


class CounterpartyRef(BaseModel):
    id: str
    name: str
    kind: str


class Period(BaseModel):
    from_: date = Field(alias="from", serialization_alias="from")
    to: date
    days: int | None = None

    model_config = {"populate_by_name": True}


# ---- transactions ------------------------------------------------------------------------


class Transaction(BaseModel):
    id: str
    status: Literal["final", "provisional"]
    occurred_at: datetime
    provider: str | None
    type: str | None
    direction: Literal["in", "out"]
    amount: Money
    fee: Money
    tax: Money
    total_cost: Money
    balance_after: Money | None
    currency: Literal["GHS"] = "GHS"
    category: CategoryRef | None
    category_source: Literal["rule", "user", "counterparty_default"]
    counterparty: CounterpartyRef | None
    reference: str | None
    note: str | None = None
    is_own_transfer: bool
    recurring_id: str | None
    flags: list[Literal["balance_gap", "duplicate_sms_merged"]]


class TransactionDetail(Transaction):
    sms_text: str | None
    sms_count: int
    category_explanation: str
    provider_txn_id: str | None


class TransactionPage(BaseModel):
    items: list[Transaction]
    next_cursor: str | None


# ---- summaries ---------------------------------------------------------------------------


class Comparison(BaseModel):
    period: Period
    money_out: Money
    money_out_change: Ratio | None
    money_in_change: Ratio | None


class TopCategory(BaseModel):
    id: str
    name: str
    share: Ratio


class Summary(BaseModel):
    period: Period
    currency: Literal["GHS"] = "GHS"
    money_out: Money
    money_in: Money
    net: Money
    fees: Money
    avg_daily_spend: Money
    spending_transactions: int
    compare: Comparison
    top_category: TopCategory | None
    recurring_monthly_cost: Money
    includes_provisional: bool = False


class BudgetUse(BaseModel):
    limit: Money
    used: Ratio


class CategorySpend(BaseModel):
    category: CategoryRef
    amount: Money
    share: Ratio
    transactions: int
    budget: BudgetUse | None = None


class CategorySummary(BaseModel):
    period: Period
    total: Money
    items: list[CategorySpend]


class TrendPoint(BaseModel):
    period: str = Field(examples=["2026-08"])
    money_out: Money
    money_in: Money
    fees: Money


class Trend(BaseModel):
    granularity: Literal["day", "week", "month"]
    items: list[TrendPoint]


class CounterpartySpend(BaseModel):
    counterparty: CounterpartyRef
    amount: Money
    transactions: int


class CounterpartySummary(BaseModel):
    items: list[CounterpartySpend]


class HabitCell(BaseModel):
    weekday: int = Field(ge=1, le=7, description="1 = Monday")
    day_part: str
    amount: Money


class HourSpend(BaseModel):
    hour: int
    amount: Money


class Peak(BaseModel):
    weekday: int | None
    day_part: str | None


class Habits(BaseModel):
    grid: list[HabitCell]
    by_hour: list[HourSpend]
    peak: Peak
    weekend_share: Ratio | None
    median_payment: Money | None


# ---- balances ----------------------------------------------------------------------------


class WalletBalance(BaseModel):
    wallet_id: str | None
    provider: str
    balance: Money
    as_of: datetime


class Balances(BaseModel):
    total: Money
    items: list[WalletBalance]


class BalanceDay(BaseModel):
    date: date
    wallet_id: str | None
    provider: str
    balance: Money


class BalanceHistory(BaseModel):
    items: list[BalanceDay]
    days_below_threshold: int
    threshold: Money


# ---- categories and counterparties ------------------------------------------------------


class CategoryInfo(BaseModel):
    id: str
    name: str
    group: CategoryGroup
    user_selectable: bool


class CategoryList(BaseModel):
    items: list[CategoryInfo]


class Counterparty(BaseModel):
    id: str
    name: str
    original_name: str
    alias: str | None
    kind: str
    default_category: CategoryRef | None
    money_out: Money
    transactions: int
    last_seen_at: datetime | None


class CounterpartyPage(BaseModel):
    items: list[Counterparty]
    next_cursor: str | None


# ---- recurring ---------------------------------------------------------------------------


class RecurringSeries(BaseModel):
    id: str
    label: str
    counterparty: CounterpartyRef | None
    category: CategoryRef | None
    rhythm: Literal["daily", "weekly", "fortnightly", "monthly"]
    interval_days: int
    typical_amount: Money
    payments: int
    first_paid_at: datetime
    last_paid_at: datetime
    status: Literal["active", "stopped"]
    monthly_cost: Money
    user_state: Literal["expected", "cancel_planned", "not_recurring"] | None = None


class RecurringList(BaseModel):
    monthly_cost: Money
    items: list[RecurringSeries]


# ---- insights ----------------------------------------------------------------------------


class Insight(BaseModel):
    id: str
    severity: Literal["info", "tip", "warning"]
    title: str
    body: str
    link: str | None = None


class InsightList(BaseModel):
    items: list[Insight]
