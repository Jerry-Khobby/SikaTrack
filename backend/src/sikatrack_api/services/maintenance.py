"""Housekeeping the API does on a timer: erasing accounts whose grace period is over, and
clearing old sign-in codes.

Erasure removes everything the user put in, everywhere: their raw SMS and processed files in
the lake, their warehouse rows (through api.forget_user, the backend's only warehouse write)
and their app rows. An audit entry with no personal data records that it happened.
"""

import asyncio
import logging
import uuid
from datetime import timedelta
from functools import partial
from typing import TYPE_CHECKING

import anyio
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from sikatrack_api import clock, ratelimit
from sikatrack_api.config import Settings
from sikatrack_api.models import OtpRequest, User
from sikatrack_api.providers import PushSender
from sikatrack_api.services import alerts, audit

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client
    from mypy_boto3_s3.type_defs import ObjectIdentifierTypeDef

log = logging.getLogger(__name__)


def _delete_prefix(s3: "S3Client", bucket: str, prefix: str) -> int:
    removed = 0
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys: list[ObjectIdentifierTypeDef] = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if keys:
            s3.delete_objects(Bucket=bucket, Delete={"Objects": keys, "Quiet": True})
            removed += len(keys)
    return removed


async def erase_account(
    session: AsyncSession, s3: "S3Client", settings: Settings, user_id: uuid.UUID
) -> None:
    prefix = f"users/{user_id}/"
    objects = 0
    for bucket in (settings.raw_bucket, settings.processed_bucket):
        objects += await anyio.to_thread.run_sync(partial(_delete_prefix, s3, bucket, prefix))
    warehouse_rows = await session.scalar(text("SELECT api.forget_user(:u)"), {"u": user_id})
    await session.execute(delete(User).where(User.id == user_id))  # cascades to every app table
    audit.record(session, "account_erased", user_id, objects=objects, warehouse_rows=warehouse_rows or 0)
    await session.commit()
    log.info("Account erased", extra={"user_id": str(user_id), "objects": objects})


async def erase_due_accounts(
    factory: async_sessionmaker[AsyncSession], s3: "S3Client", settings: Settings
) -> int:
    async with factory() as session:
        due = (
            (
                await session.execute(
                    select(User.id).where(User.status == "deleting", User.delete_after <= clock.utcnow())
                )
            )
            .scalars()
            .all()
        )
    for user_id in due:
        async with factory() as session:
            try:
                await erase_account(session, s3, settings, user_id)
            except Exception:
                log.exception("Erasing an account failed; will retry", extra={"user_id": str(user_id)})
    return len(due)


async def clear_old_codes(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        await session.execute(
            delete(OtpRequest).where(OtpRequest.created_at < clock.utcnow() - timedelta(days=1))
        )
        await session.commit()


async def maintenance_loop(
    factory: async_sessionmaker[AsyncSession], s3: "S3Client", pusher: PushSender, settings: Settings
) -> None:
    """Every 15 minutes, for the life of the API process (started in main.py's lifespan)."""
    while True:
        for job in (
            lambda: erase_due_accounts(factory, s3, settings),
            lambda: alerts.weekly_digests(factory, pusher, settings),
            lambda: clear_old_codes(factory),
            lambda: ratelimit.clear_old_windows(factory),
        ):
            try:
                await job()
            except Exception:
                log.exception("Maintenance job failed; the next pass tries again")
        await asyncio.sleep(900)
