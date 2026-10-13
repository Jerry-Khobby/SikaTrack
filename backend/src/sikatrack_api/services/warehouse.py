"""Shared helpers for reading the warehouse.

Every read starts with `scope(session, user_id)`, which tells the warehouse's `api` views whose
rows to return. The views return nothing until it's set, so a missed call fails closed.
"""

import base64
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import clock, ids
from sikatrack_api.errors import AppError
from sikatrack_api.schemas.reads import CategoryGroup, CategoryRef, CounterpartyRef

GROUPS: dict[str, CategoryGroup] = {
    "Spending": "spending",
    "Money In": "money_in",
    "Own Money": "own_money",
    "Unknown": "unknown",
}
NOT_SELECTABLE = frozenset({"Own Transfers", "Uncategorized"})  # managed by the pipeline itself


async def scope(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Set the user for this transaction's warehouse reads (is_local: ends with the transaction)."""
    await session.execute(text("SELECT set_config('sikatrack.user_id', :u, true)"), {"u": str(user_id)})


# ---- public IDs --------------------------------------------------------------------------


def _b64(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")


def _unb64(value: str) -> str:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode()
    except (ValueError, UnicodeDecodeError):
        raise ids.not_found() from None


def transaction_id(nk: str) -> str:
    """The natural key is the same for the provisional and final version, so IDs don't change."""
    return "txn_" + _b64(nk)


def transaction_nk(public_id: str) -> str:
    if not public_id.startswith("txn_"):
        raise ids.not_found()
    return _unb64(public_id[4:])


def counterparty_id(name: str) -> str:
    return "cpt_" + _b64(name)


def counterparty_name(public_id: str) -> str:
    if not public_id.startswith("cpt_"):
        raise ids.not_found()
    return _unb64(public_id[4:])


def recurring_id(series: str) -> str:
    return "rec_" + series


def recurring_series(public_id: str) -> str:
    if not public_id.startswith("rec_") or not public_id[4:].isalnum():
        raise ids.not_found()
    return public_id[4:]


# ---- categories and counterparties -------------------------------------------------------


def category_slug(name: str) -> str:
    """ "Airtime/Data" -> "airtime_data", "Transfers-Personal" -> "transfers_personal"."""
    return "".join(c if c.isalnum() else "_" for c in name.lower()).strip("_")


def category_ref(name: str | None, group: str | None) -> CategoryRef | None:
    if name is None:
        return None
    return CategoryRef(id=category_slug(name), name=name, group=GROUPS.get(group or "", "unknown"))


def display_name(name: str) -> str:
    """SMS names are upper case; show them as names."""
    return name.title()


def counterparty_ref(name: str | None, kind: str | None, alias: str | None = None) -> CounterpartyRef | None:
    if name is None:
        return None
    return CounterpartyRef(id=counterparty_id(name), name=alias or display_name(name), kind=kind or "unknown")


# ---- periods -----------------------------------------------------------------------------


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date  # inclusive

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    def previous(self) -> "DateRange":
        """The same length, right before."""
        return DateRange(self.start - timedelta(days=self.days), self.start - timedelta(days=1))


def resolve_period(
    month: str | None, start: date | None, end: date | None, default: Literal["month", "30d"] = "month"
) -> DateRange:
    if month is not None:
        try:
            year, number = (int(part) for part in month.split("-"))
            first = date(year, number, 1)
        except ValueError:
            raise bad_request("month", "Use YYYY-MM, e.g. 2026-09") from None
        last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return DateRange(first, last)
    today = clock.utcnow().date()  # Ghana is UTC+0: the UTC date is the local date
    if start is None and end is None:
        if default == "30d":
            return DateRange(today - timedelta(days=29), today)
        first = today.replace(day=1)
        return DateRange(
            first, (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        )
    period = DateRange(start or (end or today) - timedelta(days=29), end or today)
    if period.start > period.end:
        raise bad_request("from", "Must be on or before 'to'")
    if period.days > 3 * 366:
        raise bad_request("from", "At most three years at a time")
    return period


def bad_request(field: str, message: str) -> AppError:
    return AppError(
        400, "validation_error", "The request is invalid", errors=[{"field": field, "message": message}]
    )


def as_group(value: str | None) -> CategoryGroup:
    return GROUPS.get(value or "", "unknown")
