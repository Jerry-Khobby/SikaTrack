"""Wallet balances. A balance is semi-additive: never summed over time, only across wallets on
the same day. Days with no SMS carry the last known balance forward."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import ids
from sikatrack_api.models import Wallet
from sikatrack_api.schemas.reads import BalanceDay, BalanceHistory, Balances, WalletBalance
from sikatrack_api.services import warehouse

LATEST_SQL = """
SELECT DISTINCT ON (provider_code) provider_code, balance_after, occurred_at
FROM api.transaction
WHERE balance_after IS NOT NULL
ORDER BY provider_code, occurred_at DESC
"""

HISTORY_SQL = """
WITH bounds AS (SELECT min(date) AS first_day, max(date) AS last_day FROM api.transaction),
days AS (
    SELECT generate_series(GREATEST(CAST(:start AS date), first_day), LEAST(CAST(:end AS date), last_day),
                           interval '1 day')::date AS day
    FROM bounds
),
providers AS (SELECT DISTINCT provider_code FROM api.transaction WHERE balance_after IS NOT NULL)
SELECT d.day, p.provider_code, b.balance_after
FROM days d
CROSS JOIN providers p
CROSS JOIN LATERAL (
    SELECT t.balance_after FROM api.transaction t
    WHERE t.provider_code = p.provider_code AND t.balance_after IS NOT NULL AND t.occurred_at < d.day + 1
    ORDER BY t.occurred_at DESC LIMIT 1
) b
ORDER BY d.day, p.provider_code
"""


async def _wallet_ids(session: AsyncSession, user_id: uuid.UUID) -> dict[str, str]:
    """One wallet per provider, as the SMS don't say which of a user's numbers they're for."""
    rows = (
        await session.execute(select(Wallet).where(Wallet.user_id == user_id).order_by(Wallet.created_at))
    ).scalars()
    mapping: dict[str, str] = {}
    for wallet in rows:
        mapping.setdefault(wallet.provider_code, ids.encode("wal", wallet.id))
    return mapping


async def latest(session: AsyncSession, user_id: uuid.UUID) -> Balances:
    await warehouse.scope(session, user_id)
    wallets = await _wallet_ids(session, user_id)
    rows = (await session.execute(text(LATEST_SQL))).all()
    items = [
        WalletBalance(
            wallet_id=wallets.get(r.provider_code),
            provider=r.provider_code,
            balance=r.balance_after,
            as_of=r.occurred_at,
        )
        for r in rows
    ]
    return Balances(total=sum((i.balance for i in items), Decimal("0.00")), items=items)


async def history(
    session: AsyncSession, user_id: uuid.UUID, start: date, end: date, threshold: Decimal
) -> BalanceHistory:
    await warehouse.scope(session, user_id)
    wallets = await _wallet_ids(session, user_id)
    rows = (await session.execute(text(HISTORY_SQL), {"start": start, "end": end})).all()
    totals: dict[date, Decimal] = {}
    for r in rows:
        totals[r.day] = totals.get(r.day, Decimal("0.00")) + r.balance_after
    return BalanceHistory(
        items=[
            BalanceDay(
                date=r.day,
                wallet_id=wallets.get(r.provider_code),
                provider=r.provider_code,
                balance=r.balance_after,
            )
            for r in rows
        ],
        days_below_threshold=sum(1 for total in totals.values() if total < threshold),
        threshold=threshold,
    )
