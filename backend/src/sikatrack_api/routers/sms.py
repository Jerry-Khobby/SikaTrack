"""/v1/sms and /v1/sync: uploading MoMo SMS from the phone, and staying in step."""

import uuid
from typing import TYPE_CHECKING, Annotated

from fastapi import APIRouter, BackgroundTasks, Header, Request, status

from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep, SettingsDep
from sikatrack_api.errors import AppError
from sikatrack_api.schemas.ingestion import SmsBatchIn, SmsBatchOut, SmsBatchStatus, SyncStatus
from sikatrack_api.services import alerts, ingestion

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

router = APIRouter(tags=["sms"])


@router.post(
    "/v1/sms/batches",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload MoMo SMS from the phone",
    description="Idempotent: retry a failed upload with the same Idempotency-Key. SMS already "
    "uploaded are counted as duplicates and not stored again.",
)
async def upload_sms(
    body: SmsBatchIn,
    request: Request,
    background: BackgroundTasks,
    me: CurrentUserDep,
    session: SessionDep,
    settings: SettingsDep,
    idempotency_key: Annotated[uuid.UUID, Header(description="A new UUID per batch")],
) -> SmsBatchOut:
    length = request.headers.get("content-length")
    if length is not None and length.isdigit() and int(length) > settings.sms_batch_max_bytes:
        raise AppError(413, "payload_too_large", "The upload is too large", "Send smaller batches.")
    s3: S3Client = request.app.state.s3
    result = await ingestion.upload_batch(session, settings, s3, me.user, body, idempotency_key)
    if result.provisional_transactions:  # budgets and balance may have moved: check after replying
        state = request.app.state
        background.add_task(alerts.evaluate_for, state.session_factory, state.push_sender, me.id, "upload")
    return result


@router.get("/v1/sms/batches/{batch_id}", summary="How far an upload has got")
async def get_batch(batch_id: str, me: CurrentUserDep, session: SessionDep) -> SmsBatchStatus:
    return await ingestion.batch_status(session, me.id, batch_id)


@router.get("/v1/sync/status", summary="Where to resume scanning, and what's still processing")
async def sync_status(me: CurrentUserDep, session: SessionDep) -> SyncStatus:
    return await ingestion.sync_status(session, me.id)
