"""SMS uploads from the app (docs/ingestion-and-sync.md).

An upload, in order:
1. Idempotency: a repeated Idempotency-Key returns the first response.
2. Only allowlisted MoMo senders are kept.
3. Message IDs (the pipeline's own function); SMS seen before are skipped.
4. The new SMS go to the raw zone as one JSON Lines object: the source of truth.
5. Each is parsed at once for the instant view (provisional transactions).
6. The batch, the seen-SMS index and the provisional rows are committed together.
7. A pipeline run is scheduled for the user (debounced).

If the raw-zone write fails nothing is recorded, so the app's retry starts clean. If the
commit fails after the write, the object is an orphan the pipeline reads harmlessly: its SMS
deduplicate by message ID when the retry stores them again.
"""

import hashlib
import json
import logging
import uuid
from datetime import timedelta
from typing import TYPE_CHECKING

import anyio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.extraction.filter_sms import is_momo_sender, make_message_id

from sikatrack_api import clock, ids
from sikatrack_api.config import Settings
from sikatrack_api.errors import AppError
from sikatrack_api.models import Device, PipelineEvent, ProvisionalTransaction, SmsBatch, SmsSeen, User
from sikatrack_api.schemas.ingestion import (
    PipelineRunInfo,
    SmsBatchIn,
    SmsBatchOut,
    SmsBatchStatus,
    SyncHint,
    SyncStatus,
)
from sikatrack_api.services import pipeline
from sikatrack_api.services.provisional import parse_sms
from sikatrack_api.services.users import data_summary
from sikatrack_api.services.wallets import owner_of

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

log = logging.getLogger(__name__)


def raw_object_key(user_id: uuid.UUID, batch_id: uuid.UUID, day: str) -> str:
    """Where the pipeline looks for a user's uploads (src/lake/raw_zone.py user_uploads_prefix)."""
    return f"users/{user_id}/sms/{day}/{batch_id}.jsonl"


async def upload_batch(
    session: AsyncSession,
    settings: Settings,
    s3: "S3Client",
    user: User,
    body: SmsBatchIn,
    idempotency_key: uuid.UUID,
) -> SmsBatchOut:
    request_hash = hashlib.sha256(body.model_dump_json().encode()).hexdigest()

    # 1. Same key again: the first answer, or a conflict if the body changed
    previous = await session.scalar(
        select(SmsBatch).where(SmsBatch.user_id == user.id, SmsBatch.idempotency_key == idempotency_key)
    )
    if previous is not None:
        if previous.request_hash != request_hash:
            raise AppError(
                409, "idempotency_mismatch", "This Idempotency-Key was used for a different upload",
                "Use a new key for each batch; reuse a key only to retry the same batch.",
            )  # fmt: skip
        return SmsBatchOut.model_validate(previous.response)

    if len(body.messages) > settings.sms_batch_max_messages:
        raise AppError(
            413, "payload_too_large", "Too many SMS in one batch",
            f"Send at most {settings.sms_batch_max_messages} per batch.",
        )  # fmt: skip
    now = clock.utcnow()
    recent = await session.scalar(
        select(func.count()).where(
            SmsBatch.user_id == user.id, SmsBatch.created_at > now - timedelta(hours=1)
        )
    )
    if (recent or 0) >= settings.sms_batches_per_hour:
        raise AppError(429, "rate_limited", "Too many uploads", headers={"Retry-After": "600"})

    # 2-3. MoMo senders only; skip SMS already uploaded (by any batch) or repeated in this one
    rejected = 0
    candidates: dict[str, tuple[str, str, str]] = {}
    for sms in body.messages:
        if not is_momo_sender(sms.sender):
            rejected += 1
            continue
        message_id = make_message_id(sms.sender, sms.date_ms, sms.body)
        candidates.setdefault(message_id, (sms.sender, sms.date_ms, sms.body))
    seen = set(
        (
            await session.execute(
                select(SmsSeen.message_id).where(
                    SmsSeen.user_id == user.id, SmsSeen.message_id.in_(list(candidates))
                )
            )
        ).scalars()
    )
    new = {mid: sms for mid, sms in candidates.items() if mid not in seen}
    duplicates = len(body.messages) - rejected - len(new)

    batch_id = uuid.uuid4()
    object_key = None
    # 4. The raw zone first: if it's down, nothing is recorded and the retry starts clean
    if new:
        object_key = raw_object_key(user.id, batch_id, now.date().isoformat())
        lines = "".join(
            json.dumps({"message_id": mid, "sender": s, "date_ms": d, "body": b, "received_via": "app"})
            + "\n"
            for mid, (s, d, b) in new.items()
        ).encode()
        try:
            await anyio.to_thread.run_sync(
                lambda: s3.put_object(
                    Bucket=settings.raw_bucket, Key=object_key, Body=lines, ContentType="application/x-ndjson"
                )
            )
        except Exception as exc:
            log.warning("Raw-zone write failed", extra={"error_type": type(exc).__name__})
            raise AppError(
                503, "dependency_unavailable", "Can't store your SMS right now", "Try again shortly."
            ) from None

    # 5. The instant view
    owner = await owner_of(session, user.id)
    counts = {"parsed": 0, "unparsed": 0, "ignored": 0}
    provisional = []
    for mid, (sender, date_ms, text) in new.items():
        parsed = parse_sms(sender, date_ms, text, mid, owner)
        counts[parsed.parse_status] += 1
        if parsed.parse_status == "parsed":
            provisional.append(
                ProvisionalTransaction(user_id=user.id, message_id=mid, batch_id=batch_id, **parsed.__dict__)
            )

    latest = max((int(d) for _, d, _ in candidates.values()), default=None)
    response = SmsBatchOut(
        batch_id=ids.encode("bat", batch_id),
        received=len(body.messages),
        accepted=len(new),
        duplicates=duplicates,
        rejected_senders=rejected,
        **counts,
        provisional_transactions=len(provisional),
        sync=SyncHint(
            latest_date_ms=str(latest) if latest is not None else None,
            pipeline="scheduled" if new else "not_needed",
        ),
    )

    # 6. Everything recorded together. The device is kept only if it's this user's.
    device = await session.get(Device, body.device_id)
    device_id = device.id if device is not None and device.user_id == user.id else None
    session.add(
        SmsBatch(
            id=batch_id,
            user_id=user.id,
            device_id=device_id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            source=body.source,
            raw_object_key=object_key,
            received=len(body.messages),
            accepted=len(new),
            duplicates=duplicates,
            latest_date_ms=latest,
            status="received" if new else "loaded",
            response=response.model_dump(mode="json"),
            created_at=now,
        )
    )
    await session.flush()  # the batch row must exist before rows that reference it
    session.add_all(SmsSeen(user_id=user.id, message_id=mid, batch_id=batch_id, date_ms=int(sms[1]))
                    for mid, sms in new.items())  # fmt: skip
    session.add_all(provisional)

    # 7. Debounced pipeline run
    if new:
        pipeline.mark_due(user, settings.pipeline_debounce_s)
        if not user.onboarding.get("first_sync_done"):
            user.onboarding = {**user.onboarding, "first_sync_done": True}
    await session.commit()
    log.info(
        "SMS batch stored",
        extra={
            "batch_id": str(batch_id),
            "accepted": len(new),
            "duplicates": duplicates,
            "rejected": rejected,
        },
    )
    return response


async def batch_status(session: AsyncSession, user_id: uuid.UUID, public_id: str) -> SmsBatchStatus:
    batch = await session.get(SmsBatch, ids.decode("bat", public_id))
    if batch is None or batch.user_id != user_id:
        raise ids.not_found()
    return SmsBatchStatus(
        batch_id=public_id,
        status=batch.status,
        received_at=batch.created_at,
        accepted=batch.accepted,
        loaded_at=batch.loaded_at,
    )


async def sync_status(session: AsyncSession, user_id: uuid.UUID) -> SyncStatus:
    latest_date_ms = await session.scalar(select(func.max(SmsSeen.date_ms)).where(SmsSeen.user_id == user_id))
    last_upload, pending = (
        await session.execute(
            select(
                func.max(SmsBatch.created_at),
                func.coalesce(
                    func.sum(SmsBatch.accepted).filter(SmsBatch.status.in_(("received", "processing"))), 0
                ),
            ).where(SmsBatch.user_id == user_id)
        )
    ).one()
    provisional = await session.scalar(select(func.count()).where(ProvisionalTransaction.user_id == user_id))
    event = await session.scalar(
        select(PipelineEvent)
        .where(PipelineEvent.user_id == user_id)
        .order_by(PipelineEvent.finished_at.desc())
        .limit(1)
    )
    return SyncStatus(
        latest_date_ms=str(latest_date_ms) if latest_date_ms is not None else None,
        last_upload_at=last_upload,
        pending_messages=int(pending),
        provisional_transactions=provisional or 0,
        last_pipeline_run=(
            PipelineRunInfo(status=event.status, finished_at=event.finished_at) if event else None
        ),
        data_through=(await data_summary(session, user_id)).last_transaction_at,
    )
