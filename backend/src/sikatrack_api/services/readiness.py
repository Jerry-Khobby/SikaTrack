"""Can this instance serve traffic? Checks each dependency the API needs, at the same time.

A check either returns (the dependency answered) or raises. Failures are logged with their
cause; the response only says which dependency failed, never why (no hostnames or errors leak).
"""

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

import anyio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from sikatrack_api.schemas.health import CheckResult, ReadinessResponse

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class DependencyCheck:
    name: str
    probe: Callable[[], Awaitable[None]]


def database_check(engine: AsyncEngine) -> DependencyCheck:
    async def probe() -> None:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))

    return DependencyCheck("database", probe)


def object_store_check(client: "S3Client", bucket: str) -> DependencyCheck:
    async def probe() -> None:
        # boto3 is synchronous: run it in a worker thread so the event loop keeps serving
        await anyio.to_thread.run_sync(lambda: client.head_bucket(Bucket=bucket))

    return DependencyCheck("object_store", probe)


async def _run_one(check: DependencyCheck, limit_s: float) -> CheckResult:
    started = time.perf_counter()
    try:
        async with asyncio.timeout(limit_s):
            await check.probe()
        status = "ok"
    except TimeoutError:
        log.warning("Readiness check timed out", extra={"check": check.name, "limit_s": limit_s})
        status = "failed"
    except Exception as exc:  # any failure means "not ready"; the cause goes to the log only
        log.warning(
            "Readiness check failed",
            extra={"check": check.name, "error_type": type(exc).__name__},
            exc_info=exc,
        )
        status = "failed"
    return CheckResult(status=status, latency_ms=round((time.perf_counter() - started) * 1000, 1))


async def check_readiness(checks: Sequence[DependencyCheck], limit_s: float) -> ReadinessResponse:
    """Runs every check at once; each gets `limit_s` seconds before it counts as failed."""
    results = await asyncio.gather(*(_run_one(c, limit_s) for c in checks))
    by_name = {c.name: r for c, r in zip(checks, results, strict=True)}
    ready = all(r.status == "ok" for r in results)
    return ReadinessResponse(status="ready" if ready else "not_ready", checks=by_name)
