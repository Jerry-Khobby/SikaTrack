"""/internal: called by the pipeline, not the app. Authenticated with a shared service token
(INTERNAL_API_TOKEN) and left out of the public API docs. Expose it only inside the Docker
network: a reverse proxy in front of the API should not route /internal at all."""

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sikatrack_api.auth.dependencies import SessionDep, SettingsDep
from sikatrack_api.errors import AppError
from sikatrack_api.schemas.ingestion import PipelineEventIn
from sikatrack_api.services import alerts, pipeline

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)
_bearer = HTTPBearer(auto_error=False)


def require_service_token(
    settings: SettingsDep, token: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> None:
    expected = settings.internal_api_token.get_secret_value()
    if token is None or not hmac.compare_digest(token.credentials.encode(), expected.encode()):
        raise AppError(403, "forbidden", "Not allowed")


@router.post(
    "/pipeline-events", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_service_token)]
)
async def pipeline_event(
    body: PipelineEventIn, request: Request, session: SessionDep, settings: SettingsDep
) -> Response:
    await pipeline.record_event(session, settings, body)
    event: alerts.Event = "pipeline_succeeded" if body.status == "succeeded" else "pipeline_failed"
    await alerts.evaluate_for(
        request.app.state.session_factory, request.app.state.push_sender, body.user_id, event, body.run_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
