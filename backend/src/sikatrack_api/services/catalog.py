"""Categories and counterparties."""

import base64
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api.schemas.reads import CategoryInfo, CategoryList, Counterparty, CounterpartyPage
from sikatrack_api.services import warehouse
from sikatrack_api.services.warehouse import (
    as_group,
    category_ref,
    category_slug,
    counterparty_id,
    display_name,
)

COUNTERPARTIES_SQL = """
WITH spend AS (
    SELECT counterparty_name,
           sum(CASE WHEN direction = 'out' AND NOT is_own_transfer THEN amount ELSE 0 END) AS money_out,
           count(*) AS n
    FROM api.transaction WHERE counterparty_name IS NOT NULL GROUP BY counterparty_name
)
SELECT c.counterparty_name, c.counterparty_kind, c.last_seen_at, cp.alias, cp.default_category,
       dc.category_group AS default_group, COALESCE(s.money_out, 0) AS money_out, COALESCE(s.n, 0) AS n
FROM api.counterparty c
LEFT JOIN spend s USING (counterparty_name)
LEFT JOIN app.counterparty_preference cp ON cp.user_id = :uid AND cp.counterparty_name = c.counterparty_name
LEFT JOIN api.category dc ON dc.category_name = cp.default_category
"""


async def categories(session: AsyncSession) -> CategoryList:
    rows = (await session.execute(text("SELECT category_name, category_group FROM api.category"))).all()
    return CategoryList(
        items=sorted(
            (
                CategoryInfo(
                    id=category_slug(r.category_name),
                    name=r.category_name,
                    group=as_group(r.category_group),
                    user_selectable=r.category_name not in warehouse.NOT_SELECTABLE,
                )
                for r in rows
            ),
            key=lambda c: (c.group, c.name),
        )
    )


def _to_counterparty(row: Any) -> Counterparty:
    return Counterparty(
        id=counterparty_id(row.counterparty_name),
        name=row.alias or display_name(row.counterparty_name),
        original_name=row.counterparty_name,
        alias=row.alias,
        kind=row.counterparty_kind,
        default_category=category_ref(row.default_category, row.default_group),
        money_out=row.money_out,
        transactions=row.n,
        last_seen_at=row.last_seen_at,
    )


async def counterparties(
    session: AsyncSession, user_id: uuid.UUID, q: str | None, kind: str | None, limit: int, cursor: str | None
) -> CounterpartyPage:
    """Biggest first. The cursor is an offset: the list is small and changes only at loads."""
    await warehouse.scope(session, user_id)
    offset = _offset(cursor)
    where, params = ["TRUE"], {"uid": user_id, "limit": limit + 1, "offset": offset}
    if q:
        where.append("(c.counterparty_name ILIKE :q OR cp.alias ILIKE :q)")
        params["q"] = f"%{q.replace('%', '').replace('_', '')}%"
    if kind:
        where.append("c.counterparty_kind = :kind")
        params["kind"] = kind
    sql = (
        f"{COUNTERPARTIES_SQL} WHERE {' AND '.join(where)} "
        "ORDER BY money_out DESC, c.counterparty_name LIMIT :limit OFFSET :offset"
    )
    rows = (await session.execute(text(sql), params)).all()
    next_cursor = _encode_offset(offset + limit) if len(rows) > limit else None
    return CounterpartyPage(items=[_to_counterparty(r) for r in rows[:limit]], next_cursor=next_cursor)


async def counterparty(session: AsyncSession, user_id: uuid.UUID, name: str) -> Counterparty | None:
    await warehouse.scope(session, user_id)
    row = (
        await session.execute(
            text(f"{COUNTERPARTIES_SQL} WHERE c.counterparty_name = :name"), {"uid": user_id, "name": name}
        )
    ).first()
    return _to_counterparty(row) if row else None


def _encode_offset(offset: int) -> str:
    return base64.urlsafe_b64encode(f"o:{offset}".encode()).decode().rstrip("=")


def _offset(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        if raw.startswith("o:") and raw[2:].isdigit():
            return int(raw[2:])
    except ValueError:
        pass
    raise warehouse.bad_request("cursor", "Not a cursor from this API")
