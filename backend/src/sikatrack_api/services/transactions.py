"""Transactions: final (warehouse) and provisional (just uploaded), with the user's corrections.

`TX` is the one query every read builds on. It merges both kinds of transaction (a provisional
row disappears once the warehouse has the same natural key), then applies the user's input:
    category = their correction for this transaction
            > their default for the counterparty (never for transfers between own wallets)
            > the pipeline's rule
Summaries use it too, so a correction changes the totals at once.
"""

import base64
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import ids
from sikatrack_api.schemas.reads import Transaction, TransactionDetail, TransactionPage
from sikatrack_api.services import warehouse
from sikatrack_api.services.warehouse import category_ref, counterparty_ref, recurring_id, transaction_id

TX = """
WITH base AS (
    SELECT t.transaction_nk AS nk, 'final' AS status, t.occurred_at, t.date, t.provider_code,
           t.transaction_type, t.direction, t.amount, t.fee, t.tax, t.total_cost, t.balance_after,
           t.category_name AS rule_category, t.category_rule, t.counterparty_name, t.counterparty_kind,
           t.reference, t.is_own_transfer, t.recurring_series, t.has_balance_gap, t.sms_count,
           t.weekday, t.is_weekend, t.hour, t.day_part
    FROM api.transaction t
    UNION ALL
    SELECT p.transaction_nk, 'provisional', p.occurred_at, (p.occurred_at AT TIME ZONE 'UTC')::date,
           p.provider_code, p.transaction_type,
           CASE WHEN p.direction = 'debit' THEN 'out' ELSE 'in' END,
           p.amount, p.fee, p.tax, p.fee + p.tax, p.balance_after,
           p.category_name, p.category_rule, p.counterparty, p.counterparty_kind,
           p.reference, p.is_own_transfer, NULL, FALSE, 1,
           EXTRACT(ISODOW FROM p.occurred_at AT TIME ZONE 'UTC')::int,
           EXTRACT(ISODOW FROM p.occurred_at AT TIME ZONE 'UTC') >= 6,
           EXTRACT(HOUR FROM p.occurred_at AT TIME ZONE 'UTC')::int,
           (SELECT day_part FROM api.time_of_day
            WHERE hour = EXTRACT(HOUR FROM p.occurred_at AT TIME ZONE 'UTC'))
    FROM app.provisional_transaction p
    WHERE p.user_id = :uid AND p.parse_status = 'parsed'
      AND NOT EXISTS (SELECT 1 FROM api.transaction t WHERE t.transaction_nk = p.transaction_nk)
),
tx AS (
    SELECT b.*,
           COALESCE(o.category_name,
                    CASE WHEN NOT b.is_own_transfer THEN cp.default_category END,
                    b.rule_category) AS category_name,
           CASE WHEN o.category_name IS NOT NULL THEN 'user'
                WHEN NOT b.is_own_transfer AND cp.default_category IS NOT NULL THEN 'counterparty_default'
                ELSE 'rule' END AS category_source,
           o.note, cp.alias,
           CASE WHEN b.direction = 'out' AND NOT b.is_own_transfer THEN b.amount ELSE 0 END AS money_out,
           CASE WHEN b.direction = 'in' AND NOT b.is_own_transfer THEN b.amount ELSE 0 END AS money_in
    FROM base b
    LEFT JOIN app.category_override o ON o.user_id = :uid AND o.transaction_nk = b.nk
    LEFT JOIN app.counterparty_preference cp
           ON cp.user_id = :uid AND cp.counterparty_name = b.counterparty_name
),
txc AS (
    SELECT tx.*, c.category_group FROM tx LEFT JOIN api.category c USING (category_name)
)
"""

COLUMNS = """nk, status, occurred_at, provider_code, transaction_type, direction, amount, fee, tax,
    total_cost, balance_after, category_name, category_group, category_source, category_rule,
    counterparty_name, counterparty_kind, alias, reference, note, is_own_transfer, recurring_series,
    has_balance_gap, sms_count"""

EXPLANATIONS = {
    "own": "A transfer between your own wallets",
    "money_in": "Money you received",
    "type": "Every {value} transaction goes here",
    "reference": "Your reference mentions '{value}'",
    "counterparty": "The name of who you paid contains '{value}'",
    "default": "The usual category for payments to a {value}",
    "none": "No rule matched yet",
}


def explain(rule: str | None, source: str) -> str:
    if source == "user":
        return "You chose this category"
    if source == "counterparty_default":
        return "Your category for everything with this counterparty"
    layer, _, value = (rule or "none").partition(":")
    template = EXPLANATIONS.get(layer, EXPLANATIONS["none"])
    return template.format(value=value.replace("_", " "))


def _to_transaction(row: Any) -> Transaction:
    flags = []
    if row.has_balance_gap:
        flags.append("balance_gap")
    if (row.sms_count or 1) > 1:
        flags.append("duplicate_sms_merged")
    return Transaction(
        id=transaction_id(row.nk),
        status=row.status,
        occurred_at=row.occurred_at,
        provider=row.provider_code,
        type=row.transaction_type,
        direction=row.direction,
        amount=row.amount,
        fee=row.fee or Decimal("0"),
        tax=row.tax or Decimal("0"),
        total_cost=row.total_cost or Decimal("0"),
        balance_after=row.balance_after,
        category=category_ref(row.category_name, row.category_group),
        category_source=row.category_source,
        counterparty=counterparty_ref(row.counterparty_name, row.counterparty_kind, row.alias),
        reference=row.reference,
        note=row.note,
        is_own_transfer=row.is_own_transfer,
        recurring_id=recurring_id(row.recurring_series) if row.recurring_series else None,
        flags=flags,
    )


def _cursor(occurred_at: datetime, nk: str) -> str:
    raw = json.dumps([occurred_at.isoformat(), nk]).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _read_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        at, nk = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        return datetime.fromisoformat(at), str(nk)
    except (ValueError, TypeError):
        raise warehouse.bad_request("cursor", "Not a cursor from this API") from None


async def category_names(session: AsyncSession, slugs: list[str]) -> list[str]:
    rows = (await session.execute(text("SELECT category_name FROM api.category"))).scalars().all()
    by_slug = {warehouse.category_slug(name): name for name in rows}
    return [by_slug[s] for s in slugs if s in by_slug]


async def list_transactions(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    start: date,
    end: date,
    direction: str | None = None,
    categories: list[str] | None = None,
    provider: str | None = None,
    counterparty: str | None = None,
    series: str | None = None,
    include_own_transfers: bool = False,
    q: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    limit: int = 50,
    cursor: str | None = None,
) -> TransactionPage:
    await warehouse.scope(session, user_id)
    where = ["date BETWEEN :start AND :end"]
    params: dict[str, Any] = {"uid": user_id, "start": start, "end": end, "limit": limit + 1}
    if direction:
        where.append("direction = :direction")
        params["direction"] = direction
    if categories is not None:
        where.append("category_name = ANY(:categories)")
        params["categories"] = categories
    if provider:
        where.append("provider_code = :provider")
        params["provider"] = provider
    if counterparty:
        where.append("counterparty_name = :counterparty")
        params["counterparty"] = counterparty
    if series:
        where.append("recurring_series = :series")
        params["series"] = series
    if not include_own_transfers:
        where.append("NOT is_own_transfer")
    if q:
        where.append("(counterparty_name ILIKE :q OR alias ILIKE :q OR reference ILIKE :q)")
        params["q"] = f"%{q.replace('%', '').replace('_', '')}%"
    if min_amount is not None:
        where.append("amount >= :min_amount")
        params["min_amount"] = min_amount
    if max_amount is not None:
        where.append("amount <= :max_amount")
        params["max_amount"] = max_amount
    if cursor:
        params["c_at"], params["c_nk"] = _read_cursor(cursor)
        where.append("(occurred_at, nk) < (:c_at, :c_nk)")

    sql = (
        f"{TX} SELECT {COLUMNS} FROM txc WHERE {' AND '.join(where)} "
        "ORDER BY occurred_at DESC, nk DESC LIMIT :limit"
    )
    rows = (await session.execute(text(sql), params)).all()
    items = [_to_transaction(r) for r in rows[:limit]]
    next_cursor = _cursor(rows[limit - 1].occurred_at, rows[limit - 1].nk) if len(rows) > limit else None
    return TransactionPage(items=items, next_cursor=next_cursor)


async def get_transaction(session: AsyncSession, user_id: uuid.UUID, public_id: str) -> TransactionDetail:
    nk = warehouse.transaction_nk(public_id)
    await warehouse.scope(session, user_id)
    row = (
        await session.execute(
            text(f"{TX} SELECT {COLUMNS} FROM txc WHERE nk = :nk"), {"uid": user_id, "nk": nk}
        )
    ).first()
    if row is None:
        raise ids.not_found()
    extra = (
        await session.execute(
            text("SELECT raw_text, provider_txn_id FROM api.transaction WHERE transaction_nk = :nk"),
            {"nk": nk},
        )
    ).first()
    base = _to_transaction(row)
    return TransactionDetail(
        **base.model_dump(),
        sms_text=extra.raw_text if extra else None,
        sms_count=row.sms_count or 1,
        category_explanation=explain(row.category_rule, row.category_source),
        provider_txn_id=extra.provider_txn_id if extra else None,
    )
