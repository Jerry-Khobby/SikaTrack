from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from conftest import check
from sikatrack_api import __version__


def test_health_says_the_process_is_up(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}
    assert response.headers["Cache-Control"] == "no-store"


def test_health_ignores_dependencies(make_client: Callable[..., TestClient]) -> None:
    """A database outage must not make the container look dead and get restarted."""
    client = make_client(check("database", "error"), check("object_store", "error"))

    assert client.get("/health").status_code == 200


def test_ready_when_every_dependency_answers(client: TestClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert {name: c["status"] for name, c in body["checks"].items()} == {
        "database": "ok",
        "object_store": "ok",
    }
    assert all(c["latency_ms"] >= 0 for c in body["checks"].values())
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("behaviour", ["error", "hang"])
def test_not_ready_names_the_failed_dependency(
    make_client: Callable[..., TestClient], behaviour: str
) -> None:
    client = make_client(check("database", behaviour), check("object_store"))

    response = client.get("/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["database"]["status"] == "failed"
    assert body["checks"]["object_store"]["status"] == "ok"


def test_not_ready_never_leaks_the_cause(make_client: Callable[..., TestClient]) -> None:
    client = make_client(check("database", "error"), check("object_store"))

    text = client.get("/ready").text

    assert "warehouse" not in text
    assert "refused" not in text


def test_a_hung_dependency_is_cut_off_at_the_timeout(make_client: Callable[..., TestClient]) -> None:
    client = make_client(check("database", "hang"), check("object_store", "hang"))

    body = client.get("/ready").json()

    # Both run at the same time and stop at 0.2 s each, well before the 10 s sleep
    assert all(c["latency_ms"] < 2000 for c in body["checks"].values())


def test_health_endpoints_are_in_the_contract(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert {"/health", "/ready"} <= set(paths)
    assert "503" in paths["/ready"]["get"]["responses"]
