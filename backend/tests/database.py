"""Throwaway Postgres databases for the integration tests.

They need the Docker Postgres. Tests skip when it's unreachable, unless REQUIRE_DATABASE=1 (CI),
where they fail. Connection: TEST_DATABASE_URL (environment, else backend/.env), an account
allowed to create databases, e.g. postgresql+asyncpg://user:pass@localhost:5434/postgres.
"""

import asyncio
import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from dotenv import dotenv_values
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine

BACKEND = Path(__file__).parents[1]
ADMIN_URL = os.getenv("TEST_DATABASE_URL") or dotenv_values(BACKEND / ".env").get("TEST_DATABASE_URL")
REQUIRED = os.getenv("REQUIRE_DATABASE") == "1"


def _unavailable(reason: str) -> None:
    if REQUIRED:
        pytest.fail(f"REQUIRE_DATABASE=1 but {reason}")
    pytest.skip(reason)


async def _admin(sql: str) -> None:
    assert ADMIN_URL
    engine = create_async_engine(ADMIN_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 3})
    try:
        async with engine.connect() as conn:
            await conn.execute(text(sql))
    finally:
        await engine.dispose()


@contextmanager
def scratch_database() -> Iterator[str]:
    """A fresh, empty database for the duration of the block; dropped afterwards."""
    if not ADMIN_URL:
        _unavailable("TEST_DATABASE_URL isn't set")
    name = f"sikatrack_api_test_{uuid.uuid4().hex[:8]}"
    try:
        asyncio.run(_admin(f'CREATE DATABASE "{name}"'))
    except OSError as exc:
        _unavailable(f"Postgres isn't reachable: {exc}")
    try:
        yield make_url(ADMIN_URL).set(database=name).render_as_string(hide_password=False)
    finally:
        asyncio.run(_admin(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))


def migrate(url: str, warehouse: bool = True) -> None:
    """The full stack: the pipeline's warehouse schema (dw, mart, api), then the backend's app."""
    if warehouse:
        import psycopg2
        from src.load.warehouse import migrate as migrate_warehouse

        parts = make_url(url)
        conn = psycopg2.connect(
            host=parts.host,
            port=parts.port,
            dbname=parts.database,
            user=parts.username,
            password=parts.password,
        )
        try:
            migrate_warehouse(conn)
        finally:
            conn.close()
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")


async def execute(url: str, *statements: str) -> None:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            for sql in statements:
                await conn.execute(text(sql))
    finally:
        await engine.dispose()


async def fetch(url: str, sql: str, **params: object) -> list[tuple[object, ...]]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            return [tuple(row) for row in await conn.execute(text(sql), params)]
    finally:
        await engine.dispose()
