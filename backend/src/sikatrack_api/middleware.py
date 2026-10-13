"""Request IDs and the access log.

Every response carries `X-Request-ID`: the caller's, if it sent a sensible one, or a new one.
The app shows it on error screens, so one ID connects a user's report to the server's logs.
"""

import logging
import re
import time
import uuid

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from sikatrack_api.errors import internal_error
from sikatrack_api.logging_config import request_id_var

log = logging.getLogger("sikatrack_api.access")

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestContextMiddleware:
    """Pure ASGI middleware: no request body buffering, works with streaming responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope["headers"]).get(REQUEST_ID_HEADER.lower().encode(), b"").decode("latin-1")
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status = 500  # if the app fails before sending a response
        started_response = False

        async def send_with_id(message: Message) -> None:
            nonlocal status, started_response
            if message["type"] == "http.response.start":
                status, started_response = message["status"], True
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
                headers.setdefault("X-Content-Type-Options", "nosniff")
                # Personal financial data: never stored by the phone's HTTP cache unless an
                # endpoint says otherwise (only /v1/config does)
                headers.setdefault("Cache-Control", "no-store")
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            if started_response:  # too late for a clean error response; let the server close it
                raise
            log.exception("Unhandled error", extra={"path": scope["path"]})
            await internal_error()(scope, receive, send_with_id)
        finally:
            # Path only: query strings can hold filters a user typed, so they stay out of logs
            log.info(
                "%s %s %s",
                scope["method"],
                scope["path"],
                status,
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id_var.reset(token)
