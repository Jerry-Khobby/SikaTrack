"""The async database engine (one per process) and a session per request."""

from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from sikatrack_api.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        pool_pre_ping=True,  # a connection dropped by Postgres restarts is replaced, not handed out
        connect_args={
            "timeout": settings.database_connect_timeout,
            "server_settings": {"application_name": "sikatrack-api"},
        },
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    # expire_on_commit=False: objects stay readable after commit, for building the response
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """A session per request. Services commit explicitly; anything not committed when the
    request ends is rolled back.

    Explicit commits (rather than one transaction around the whole request) let a service
    keep a record *and* refuse the request: a wrong sign-in code must still count as an
    attempt, a reused refresh token must still revoke its session.
    """
    factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with factory() as session:
        yield session
