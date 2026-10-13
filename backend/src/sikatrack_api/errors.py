"""Errors as RFC 9457 problem details, the shape every endpoint returns (see docs/api-contract.md).

`code` is the stable field the app switches on; `title` and `detail` are for people.
"""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from sikatrack_api.logging_config import request_id_var

PROBLEM_JSON = "application/problem+json"
ERROR_TYPE_BASE = "https://sikatrack.app/errors/"

_CODES_BY_STATUS = {
    400: "bad_request",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    429: "rate_limited",
    503: "dependency_unavailable",
}


class AppError(Exception):
    """An expected failure with a stable code, raised by services and turned into a problem response."""

    def __init__(
        self,
        status: int,
        code: str,
        title: str,
        detail: str | None = None,
        headers: Mapping[str, str] | None = None,
        errors: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(title)
        self.status, self.code, self.title, self.detail = status, code, title, detail
        self.headers, self.errors = headers, errors


def problem(
    status: int,
    code: str,
    title: str,
    detail: str | None = None,
    errors: list[dict[str, str]] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": ERROR_TYPE_BASE + code.replace("_", "-"),
        "title": title,
        "status": status,
        "code": code,
    }
    if detail:
        body["detail"] = detail
    if errors:
        body["errors"] = errors
    if request_id := request_id_var.get():
        body["request_id"] = request_id
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return problem(exc.status, exc.code, exc.title, exc.detail, exc.errors, exc.headers)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _CODES_BY_STATUS.get(exc.status_code, "error")
    title = HTTPStatus(exc.status_code).phrase
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail != title else None
    return problem(exc.status_code, code, title, detail, headers=exc.headers)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [
        # "body.phone_number" -> "phone_number": the app maps this to a form field
        {"field": ".".join(str(p) for p in err["loc"][1:]) or str(err["loc"][0]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return problem(400, "validation_error", "The request is invalid", errors=errors)


def internal_error() -> JSONResponse:
    """The response for a crash. Sent by RequestContextMiddleware, so it carries the request ID."""
    return problem(
        500,
        "internal_error",
        "Something went wrong on our side",
        "Try again. If it keeps happening, quote the request ID.",
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    # Unhandled exceptions are caught in RequestContextMiddleware, not here: a handler for
    # Exception runs in Starlette's outermost middleware, after ours, so its 500 would go out
    # without the X-Request-ID header.
