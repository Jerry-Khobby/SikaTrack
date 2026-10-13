"""What users change: categories, nicknames, recurring decisions, budgets."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from sikatrack_api.schemas.common import Money, Ratio
from sikatrack_api.schemas.reads import CategoryRef


class _Patch(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TransactionPatch(_Patch):
    category: str | None = Field(default=None, description="Category id; null removes your correction")
    note: str | None = Field(default=None, max_length=500)
    apply_to_counterparty: bool = Field(
        default=False, description="Also make this the category for everything with this counterparty"
    )


class CounterpartyPatch(_Patch):
    alias: str | None = Field(default=None, min_length=1, max_length=80, examples=["Mum"])
    default_category: str | None = Field(default=None, description="Category id; null removes it")


class RecurringPatch(_Patch):
    user_state: Literal["expected", "cancel_planned", "not_recurring"] | None = None
    label: str | None = Field(default=None, min_length=1, max_length=80)


class BudgetPut(BaseModel):
    limit: Money = Field(gt=0, le=Decimal("1000000"))
    alert_thresholds: list[Ratio] = Field(
        default_factory=lambda: [Decimal("0.8"), Decimal("1.0")],
        min_length=1,
        max_length=4,
        description="Fractions of the limit that send an alert, e.g. 0.8 and 1.0",
    )


class BudgetOut(BaseModel):
    id: str
    category: CategoryRef
    limit: Money
    spent: Money
    remaining: Money
    used: Ratio
    projected: Money = Field(description="This month's daily pace, extended to the end of the month")
    state: Literal["on_track", "warning", "over"]
    alert_thresholds: list[Ratio]


class BudgetList(BaseModel):
    month: str
    items: list[BudgetOut]
