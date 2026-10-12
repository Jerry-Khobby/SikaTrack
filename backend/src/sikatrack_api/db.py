"""The async database engine. One per process, created at startup, disposed at shutdown."""

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

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
