"""The real readiness checks and migrations against real services.

The object store check runs everywhere (moto fakes S3); the database tests need the Docker
Postgres (see tests/database.py).
"""

import asyncio
from collections.abc import Iterator
from pathlib import Path

import boto3
import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from moto import mock_aws
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from database import scratch_database
from sikatrack_api.services.readiness import check_readiness, database_check, object_store_check

BACKEND = Path(__file__).parents[1]
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
    with scratch_database() as url:
        yield url


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
    assert version == ScriptDirectory.from_config(config).get_current_head()
    assert schemas == ["app"]  # never touches the pipeline's dw schema
