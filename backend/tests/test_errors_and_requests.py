import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from sikatrack_api.errors import AppError


def test_unknown_path_is_a_problem_document(client: TestClient) -> None:
    response = client.get("/v1/nope")

    assert response.status_code == 404
    assert response.headers["Content-Type"] == "application/problem+json"
    body = response.json()
    assert body["code"] == "not_found"
    assert body["type"] == "https://sikatrack.app/errors/not-found"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_wrong_method_is_a_problem_document(client: TestClient) -> None:
    response = client.post("/health")

    assert response.status_code == 405
    assert response.json()["code"] == "method_not_allowed"


class _Body(BaseModel):
    phone_number: str


@pytest.fixture
def app_with_test_routes(app: FastAPI) -> FastAPI:
    @app.post("/_test/validate")
    async def validate(body: _Body) -> dict[str, str]:
        return {"ok": body.phone_number}

    @app.get("/_test/app-error")
    async def app_error() -> None:
        raise AppError(409, "conflict", "Already added", "This wallet is already on your account.")

    @app.get("/_test/crash")
    async def crash() -> None:
        raise RuntimeError("secret internals")

    return app


def test_validation_errors_name_the_field(app_with_test_routes: FastAPI, client: TestClient) -> None:
    response = client.post("/_test/validate", json={})

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["errors"][0]["field"] == "phone_number"


def test_app_errors_keep_their_code(app_with_test_routes: FastAPI, client: TestClient) -> None:
    body = client.get("/_test/app-error").json()

    assert (body["status"], body["code"], body["detail"]) == (
        409,
        "conflict",
        "This wallet is already on your account.",
    )


def test_crashes_are_a_500_without_internals(app_with_test_routes: FastAPI, client: TestClient) -> None:
    response = client.get("/_test/crash")

    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert "secret internals" not in response.text
    assert response.headers["X-Request-ID"]


def test_a_new_request_id_is_made_when_none_is_sent(client: TestClient) -> None:
    first = client.get("/health").headers["X-Request-ID"]
    second = client.get("/health").headers["X-Request-ID"]

    assert len(first) == 32
    assert first != second


def test_the_callers_request_id_is_kept(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "app-7f3a9c21"})

    assert response.headers["X-Request-ID"] == "app-7f3a9c21"


@pytest.mark.parametrize("bad", ["short", "has spaces in it!!", "x" * 65, "<script>alert(1)</script>"])
def test_unsafe_request_ids_are_replaced(client: TestClient, bad: str) -> None:
    assert client.get("/health", headers={"X-Request-ID": bad}).headers["X-Request-ID"] != bad


def test_access_log_has_the_request_id_but_not_the_query(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="sikatrack_api.access"):
        response = client.get("/health?phone=0241234567")

    record = next(r for r in caplog.records if r.name == "sikatrack_api.access")
    assert record.__dict__["path"] == "/health"
    assert record.__dict__["status"] == 200
    assert "0241234567" not in record.getMessage()
    assert response.headers["X-Request-ID"]


def test_logs_are_one_json_object_per_line() -> None:
    from sikatrack_api.logging_config import JsonFormatter, request_id_var

    token = request_id_var.set("req-12345678")
    try:
        line = JsonFormatter().format(
            logging.makeLogRecord({"msg": "hello", "levelname": "INFO", "check": "db"})
        )
    finally:
        request_id_var.reset(token)

    entry = json.loads(line)
    assert (entry["message"], entry["request_id"], entry["check"]) == ("hello", "req-12345678", "db")
