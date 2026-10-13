"""Rate limits for every endpoint: per user once signed in, per IP address before.

A fixed window counter in Postgres: one upsert per request, in its own short transaction (so a
request that fails still counts). Several API instances share the counts. Sign-in codes and SMS
uploads have their own, tighter limits on top (services/sign_in.py, services/ingestion.py).
"""

import ipaddress
from datetime import datetime, timedelta

from fastapi import Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from sikatrack_api import clock
from sikatrack_api.config import Settings
from sikatrack_api.errors import AppError
from sikatrack_api.models import RateLimitCounter


def _window(now: datetime, seconds: int) -> datetime:
    return datetime.fromtimestamp(int(now.timestamp()) // seconds * seconds, now.tzinfo)


async def hit(factory: async_sessionmaker[AsyncSession], key: str, limit: int, window_s: int) -> None:
    """Count one request for `key`; raise 429 once it's over `limit` in the current window."""
    now = clock.utcnow()
    start = _window(now, window_s)
    async with factory() as session:
        count = (
            await session.execute(
                insert(RateLimitCounter)
                .values(key=key, window_start=start, count=1)
                .on_conflict_do_update(
                    index_elements=["key", "window_start"], set_={"count": RateLimitCounter.count + 1}
                )
                .returning(RateLimitCounter.count)
            )
        ).scalar_one()
        await session.commit()
    if count > limit:
        retry = max(1, int((start + timedelta(seconds=window_s) - now).total_seconds()) + 1)
        raise AppError(
            429, "rate_limited", "Too many requests", f"Try again in {retry} seconds.",
            headers={"Retry-After": str(retry)},
        )  # fmt: skip


def client_ip(request: Request) -> str | None:
    """The caller's address. Behind the proxy, uvicorn takes it from X-Forwarded-For (only
    from addresses in FORWARDED_ALLOW_IPS), so it's the phone's address, not the proxy's."""
    host = request.client.host if request.client else None
    try:
        return str(ipaddress.ip_address(host)) if host else None
    except ValueError:
        return None


async def limit_user(request: Request, user_id: str) -> None:
    settings: Settings = request.app.state.settings
    if settings.rate_limit_enabled:
        await hit(request.app.state.session_factory, f"user:{user_id}", settings.rate_limit_per_user, 60)


async def limit_public(request: Request) -> None:
    """For endpoints without sign-in (sign-in itself, config): per IP address."""
    settings: Settings = request.app.state.settings
    ip = client_ip(request)
    if settings.rate_limit_enabled and ip is not None:
        await hit(request.app.state.session_factory, f"ip:{ip}", settings.rate_limit_per_ip, 60)


async def clear_old_windows(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        await session.execute(
            delete(RateLimitCounter).where(
                RateLimitCounter.window_start < clock.utcnow() - timedelta(hours=1)
            )
        )
        await session.commit()
