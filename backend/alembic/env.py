"""Alembic runs migrations for the `app` schema only, with the API's own settings."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from sikatrack_api.config import get_settings
from sikatrack_api.db import create_engine

SCHEMA = "app"

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Set when tables exist (phase 2): the SQLAlchemy metadata, for `alembic revision --autogenerate`
target_metadata = None


def include_name(name: str | None, type_: str, _parent: object) -> bool:
    # Autogenerate must never see (and offer to drop) the pipeline's dw schema or Metabase's mart
    return name == SCHEMA if type_ == "schema" else True


def run_migrations(connection: Connection) -> None:
    # The version table lives in `app`, so the schema has to exist first. In Docker,
    # scripts/init_db.sql creates it; check before creating, because the API's login may
    # not be allowed to create schemas (Postgres checks that before IF NOT EXISTS).
    exists = connection.execute(text("SELECT 1 FROM pg_namespace WHERE nspname = :s"), {"s": SCHEMA}).first()
    if not exists:
        connection.execute(text(f"CREATE SCHEMA {SCHEMA}"))
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
        include_name=include_name,
        transaction_per_migration=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _engine() -> AsyncEngine:
    url = config.attributes.get("database_url")  # tests point Alembic at a throwaway database
    return create_async_engine(url) if url else create_engine(get_settings())


async def run_async() -> None:
    engine = _engine()
    async with engine.begin() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline (SQL script) mode isn't supported; run against a database.")
asyncio.run(run_async())
