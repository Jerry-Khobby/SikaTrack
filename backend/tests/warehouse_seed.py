"""Put transactions in the warehouse for a user, as the pipeline's loader would, without running
the pipeline. Rows are written with plain SQL into dw (the tests connect as the admin)."""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from database import execute

WAREHOUSE_RESET = (
    "DELETE FROM dw.fact_transaction",
    "DELETE FROM dw.dim_counterparty WHERE counterparty_key <> -1",
    "DELETE FROM dw.etl_run",
    "DELETE FROM dw.dim_user",
)


@dataclass(frozen=True)
class Row:
    nk: str
    at: str  # ISO time, UTC
    amount: str
    direction: str = "debit"  # debit | credit
    type: str = "transfer"
    category: str = "Food"
    counterparty: str | None = "SUNSHINE LAUNDRY"
    kind: str = "merchant"
    fee: str = "0.00"
    balance: str | None = None
    provider: str = "mtn_momo"
    own: bool = False
    series: str | None = None
    interval: int | None = None
    rule: str = "type:transfer"


def _q(value: object) -> str:
    """A SQL literal for test data we control (no user input reaches this)."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int | Decimal):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def seed(database_url: str, user_id: str, rows: list[Row]) -> None:
    statements = [
        f"INSERT INTO dw.dim_user (user_id) VALUES ({_q(user_id)}) ON CONFLICT (user_id) DO NOTHING",
        "INSERT INTO dw.dim_transaction_type (template, transaction_type, direction, flow_label) "
        "SELECT 'test_' || t || '_' || d, t, d, CASE d WHEN 'debit' THEN 'Money Out' ELSE 'Money In' END "
        "FROM (VALUES ('transfer'), ('cashout'), ('airtime'), ('merchant'), ('cashin')) v(t), "
        "(VALUES ('debit'), ('credit')) w(d) ON CONFLICT DO NOTHING",
    ]
    user = f"(SELECT user_key FROM dw.dim_user WHERE user_id = {_q(user_id)})"
    for r in rows:
        if r.counterparty:
            statements.append(
                "INSERT INTO dw.dim_counterparty "
                "(user_key, counterparty_name, counterparty_kind, last_seen_at) "
                f"VALUES ({user}, {_q(r.counterparty)}, {_q(r.kind)}, {_q(r.at)}) "
                "ON CONFLICT (user_key, counterparty_name) DO NOTHING"
            )
        at = datetime.fromisoformat(r.at)
        sign = -1 if r.direction == "debit" else 1
        counterparty = (
            f"(SELECT counterparty_key FROM dw.dim_counterparty WHERE user_key = {user} "
            f"AND counterparty_name = {_q(r.counterparty)})"
            if r.counterparty
            else "-1"
        )
        statements.append(f"""
            INSERT INTO dw.fact_transaction (
                user_key, transaction_nk, message_id, amount, signed_amount, fee, balance_after,
                date_key, time_key, provider_key, transaction_type_key, counterparty_key, category_key,
                category_rule, is_internal_transfer, is_recurring, recurring_series, recurring_interval_days,
                occurred_at, raw_text
            ) VALUES (
                {user}, {_q(r.nk)}, 'm', {r.amount}, {sign} * {r.amount}, {r.fee}, {_q(r.balance)},
                {at:%Y%m%d}, {at.hour},
                (SELECT provider_key FROM dw.dim_provider WHERE provider_code = {_q(r.provider)}),
                (SELECT transaction_type_key FROM dw.dim_transaction_type
                 WHERE template = 'test_' || {_q(r.type)} || '_' || {_q(r.direction)}),
                {counterparty},
                (SELECT category_key FROM dw.dim_category WHERE category_name = {_q(r.category)}),
                {_q(r.rule)}, {_q(r.own)}, {_q(r.series is not None)}, {_q(r.series)}, {_q(r.interval)},
                {_q(r.at)}, {_q("SMS for " + r.nk)}
            )""")
    asyncio.run(execute(database_url, *statements))
