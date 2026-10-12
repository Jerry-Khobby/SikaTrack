from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from sikatrack_api.config import Settings
from sikatrack_api.dependencies import get_readiness_checks
from sikatrack_api.main import create_app
from sikatrack_api.services.readiness import DependencyCheck


@pytest.fixture
def settings() -> Settings:
    """Settings that never come from a developer's .env, so tests behave the same everywhere."""
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        environment="test",
        database_password="unused",  # type: ignore[arg-type]
        s3_access_key="unused",  # type: ignore[arg-type]
        s3_secret_key="unused",  # type: ignore[arg-type]
        readiness_timeout=0.2,
    )


def check(name: str, behaviour: str = "ok") -> DependencyCheck:
    """A fake dependency: 'ok' answers, 'error' raises, 'hang' never answers."""

    async def probe() -> None:
        if behaviour == "error":
            raise ConnectionRefusedError("connect to warehouse:5432 refused")  # must not leak
        if behaviour == "hang":
            import asyncio

            await asyncio.sleep(10)

    return DependencyCheck(name, probe)


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def make_client(app: FastAPI) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def _make(*checks: DependencyCheck) -> TestClient:
        app.dependency_overrides[get_readiness_checks] = lambda: list(checks)
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()  # runs the lifespan, as in production
        clients.append(client)
        return client

    yield _make
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client(check("database"), check("object_store"))
