"""Recurring payments: the series the pipeline detected, with the user's decisions on top.

Status uses the pipeline's rule: a series is active if its last payment is within two
rhythm-lengths of the user's latest data (4 days for daily, 18 weekly, 34 fortnightly, 70 monthly).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import ids
from sikatrack_api.schemas.reads import RecurringList, RecurringSeries
from sikatrack_api.services import warehouse
from sikatrack_api.services.warehouse import category_ref, counterparty_ref, recurring_id

RHYTHMS: dict[int, Literal["daily", "weekly", "fortnightly", "monthly"]] = {
    1: "daily",
    7: "weekly",
    14: "fortnightly",
    30: "monthly",
}
ACTIVE_WITHIN_DAYS = {1: 4, 7: 18, 14: 34, 30: 70}

SERIES_SQL = """
WITH series AS (
    SELECT recurring_series,
           max(recurring_interval_days) AS interval_days,
           mode() WITHIN GROUP (ORDER BY counterparty_name) AS counterparty_name,
           mode() WITHIN GROUP (ORDER BY counterparty_kind) AS counterparty_kind,
           mode() WITHIN GROUP (ORDER BY category_name) AS category_name,
           mode() WITHIN GROUP (ORDER BY category_group) AS category_group,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) AS typical_amount,
           count(*) AS payments,
           min(occurred_at) AS first_paid_at,
           max(occurred_at) AS last_paid_at
    FROM api.transaction
    WHERE recurring_series IS NOT NULL
    GROUP BY recurring_series
)
SELECT s.*, p.user_state, p.label, cp.alias,
       (SELECT max(occurred_at) FROM api.transaction) AS data_end
FROM series s
LEFT JOIN app.recurring_preference p ON p.user_id = :uid AND p.recurring_series = s.recurring_series
LEFT JOIN app.counterparty_preference cp ON cp.user_id = :uid AND cp.counterparty_name = s.counterparty_name
"""


def _to_series(row: Any) -> RecurringSeries:
    interval = int(row.interval_days)
    rhythm = RHYTHMS.get(interval, "monthly")
    typical = Decimal(str(row.typical_amount)).quantize(Decimal("0.01"))
    data_end: datetime = row.data_end
    active = (data_end - row.last_paid_at).days <= ACTIVE_WITHIN_DAYS.get(interval, 70)
    counterparty = counterparty_ref(row.counterparty_name, row.counterparty_kind, row.alias)
    who = f" to {counterparty.name}" if counterparty else ""
    counts = active and row.user_state != "not_recurring"  # a false match costs nothing
    return RecurringSeries(
        id=recurring_id(row.recurring_series),
        label=row.label or f"{rhythm.title()} GHS {typical:,.0f}{who}",
        counterparty=counterparty,
        category=category_ref(row.category_name, row.category_group),
        rhythm=rhythm,
        interval_days=interval,
        typical_amount=typical,
        payments=row.payments,
        first_paid_at=row.first_paid_at,
        last_paid_at=row.last_paid_at,
        status="active" if active else "stopped",
        monthly_cost=(typical * 30 / interval).quantize(Decimal("0.01")) if counts else Decimal("0.00"),
        user_state=row.user_state,
    )


async def list_series(
    session: AsyncSession, user_id: uuid.UUID, status: Literal["active", "stopped", "all"] = "active"
) -> RecurringList:
    await warehouse.scope(session, user_id)
    rows = (await session.execute(text(SERIES_SQL), {"uid": user_id})).all()
    series = [_to_series(r) for r in rows]
    hidden = {r.recurring_series for r in rows if r.user_state == "not_recurring"}
    shown = [
        s
        for s in series
        if (status == "all" or s.status == status) and s.id.removeprefix("rec_") not in hidden
    ]
    shown.sort(key=lambda s: (s.status != "active", -s.payments))
    return RecurringList(monthly_cost=sum((s.monthly_cost for s in shown), Decimal("0.00")), items=shown)


async def get_series(session: AsyncSession, user_id: uuid.UUID, public_id: str) -> RecurringSeries:
    series = warehouse.recurring_series(public_id)
    await warehouse.scope(session, user_id)
    row = (
        await session.execute(
            text(f"SELECT * FROM ({SERIES_SQL}) x WHERE recurring_series = :series"),
            {"uid": user_id, "series": series},
        )
    ).first()
    if row is None:
        raise ids.not_found()
    return _to_series(row)
