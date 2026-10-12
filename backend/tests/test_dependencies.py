"""The real readiness checks against real services.

The object store check runs everywhere (moto fakes S3). The database tests need the Docker
Postgres: they skip when it's unreachable, unless REQUIRE_DATABASE=1 (CI), where they fail.
Connection settings: TEST_DATABASE_URL (environment, else backend/.env), e.g. postgresql+asyncpg://user:pass@localhost:5434/postgres
(an account allowed to create databases).
"""

import asyncio
import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import boto3
import pytest
from alembic import command
from alembic.config import Config
from dotenv import dotenv_values
from moto import mock_aws
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine

from sikatrack_api.services.readiness import check_readiness, database_check, object_store_check

BACKEND = Path(__file__).parents[1]
ADMIN_URL = os.getenv("TEST_DATABASE_URL") or dotenv_values(BACKEND / ".env").get("TEST_DATABASE_URL")
REQUIRED = os.getenv("REQUIRE_DATABASE") == "1"
SCHEMAS_SQL = "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('app', 'dw')"


def test_object_store_check_passes_when_the_bucket_exists() -> None:
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="sikatrack-raw")

        result = asyncio.run(check_readiness([object_store_check(s3, "sikatrack-raw")], limit_s=5))

    assert result.status == "ready"


def test_object_store_check_fails_when_the_bucket_is_missing() -> None:
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")

        result = asyncio.run(check_readiness([object_store_check(s3, "sikatrack-raw")], limit_s=5))

    assert result.checks["object_store"].status == "failed"


@pytest.fixture
def scratch_database_url() -> Iterator[str]:
    """URL of a fresh, empty database, dropped afterwards."""
    if not ADMIN_URL:
        if REQUIRED:
            pytest.fail("REQUIRE_DATABASE=1 but TEST_DATABASE_URL isn't set")
        pytest.skip("TEST_DATABASE_URL not set")
    name = f"sikatrack_api_test_{uuid.uuid4().hex[:8]}"

    async def admin(sql: str) -> None:
        engine = create_async_engine(ADMIN_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 3})
        try:
            async with engine.connect() as conn:
                await conn.execute(text(sql))
        finally:
            await engine.dispose()

    try:
        asyncio.run(admin(f'CREATE DATABASE "{name}"'))
    except OSError as exc:
        if REQUIRED:
            pytest.fail(f"REQUIRE_DATABASE=1 but Postgres isn't reachable: {exc}")
        pytest.skip(f"Postgres not reachable: {exc}")
    yield make_url(ADMIN_URL).set(database=name).render_as_string(hide_password=False)
    asyncio.run(admin(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))


@pytest.mark.integration
def test_database_check_passes_against_postgres(scratch_database_url: str) -> None:
    async def run() -> str:
        engine = create_async_engine(scratch_database_url)
        try:
            return (await check_readiness([database_check(engine)], limit_s=5)).status
        finally:
            await engine.dispose()

    assert asyncio.run(run()) == "ready"


@pytest.mark.integration
def test_migrations_create_the_app_schema_and_are_idempotent(scratch_database_url: str) -> None:
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["database_url"] = scratch_database_url

    command.upgrade(config, "head")
    command.upgrade(config, "head")  # running again changes nothing

    async def inspect() -> tuple[str | None, list[str]]:
        engine = create_async_engine(scratch_database_url)
        try:
            async with engine.connect() as conn:
                version = (await conn.execute(text("SELECT version_num FROM app.alembic_version"))).scalar()
                schemas = (await conn.execute(text(SCHEMAS_SQL))).scalars().all()
                return version, list(schemas)
        finally:
            await engine.dispose()

    version, schemas = asyncio.run(inspect())
    assert version == "0001"
    assert schemas == ["app"]  # never touches the pipeline's dw schema
