"""Liveness and readiness, for Docker, the watchdog and a load balancer. Unversioned and public.

- /health: the process is up. Never touches a dependency, so a slow database can't make a
  container look dead and get restarted in a loop.
- /ready: the process can serve requests: Postgres and the object store both answer.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from sikatrack_api import __version__
from sikatrack_api.config import Settings
from sikatrack_api.dependencies import get_readiness_checks, get_settings_from_app
from sikatrack_api.schemas.health import HealthResponse, ReadinessResponse
from sikatrack_api.services.readiness import DependencyCheck, check_readiness

router = APIRouter(tags=["health"])

NO_STORE = {"Cache-Control": "no-store"}


@router.get("/health", response_model=HealthResponse, summary="Is the process up?")
async def health(response: Response) -> HealthResponse:
    response.headers.update(NO_STORE)
    return HealthResponse(version=__version__)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Can this instance serve requests?",
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ReadinessResponse,
            "description": "A dependency is down",
        }
    },
)
async def ready(
    response: Response,
    checks: Annotated[list[DependencyCheck], Depends(get_readiness_checks)],
    settings: Annotated[Settings, Depends(get_settings_from_app)],
) -> ReadinessResponse:
    result = await check_readiness(checks, settings.readiness_timeout)
    response.headers.update(NO_STORE)
    if result.status != "ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
