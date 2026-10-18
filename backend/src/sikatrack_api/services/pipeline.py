"""Running the pipeline for a user, and hearing back when it's done.

Uploads arrive in bursts (a first sync is many batches), so runs are debounced: an upload sets
`pipeline_due_at` a couple of minutes ahead (unless a run is already due), and a scheduler
loop triggers Airflow for users whose time has come. Several API instances can run the loop:
`FOR UPDATE SKIP LOCKED` hands each due user to exactly one of them.
"""

import asyncio
import logging
import uuid
from datetime import timedelta
from typing import Protocol

import httpx2
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from sikatrack_api import clock
from sikatrack_api.config import Settings
from sikatrack_api.models import PipelineEvent, ProvisionalTransaction, SmsBatch, User
from sikatrack_api.schemas.ingestion import PipelineEventIn

log = logging.getLogger(__name__)


def mark_due(user: User, delay_s: float = 0) -> None:
    """Schedule a run for this user, keeping an earlier one if it's already scheduled, so a
    steady stream of uploads can't postpone processing forever."""
    due = clock.utcnow() + timedelta(seconds=delay_s)
    if user.pipeline_due_at is None or due < user.pipeline_due_at:
        user.pipeline_due_at = due


class PipelineTrigger(Protocol):
    async def trigger(self, user_id: uuid.UUID) -> str: ...


class AirflowTrigger:
    """Starts a DAG run through Airflow 3's REST API, authenticating with a short-lived token."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def trigger(self, user_id: uuid.UUID) -> str:
        s = self.settings
        if s.airflow_password is None:
            raise RuntimeError("AIRFLOW_PASSWORD isn't set; can't trigger pipeline runs")
        async with httpx2.AsyncClient(base_url=s.airflow_url, timeout=10) as client:
            token = await client.post(
                "/auth/token",
                json={"username": s.airflow_username, "password": s.airflow_password.get_secret_value()},
            )
            token.raise_for_status()
            response = await client.post(
                f"/api/v2/dags/{s.airflow_dag_id}/dagRuns",
                headers={"Authorization": f"Bearer {token.json()['access_token']}"},
                json={"logical_date": None, "conf": {"user_id": str(user_id)}},
            )
            response.raise_for_status()
            run_id: str = response.json()["dag_run_id"]
            return run_id


STUCK_AFTER = timedelta(hours=2)


async def requeue_stuck_batches(session: AsyncSession, settings: Settings) -> None:
    """A run that never reported back (lost callback, Airflow restarted): try again."""
    stuck_users = (
        (
            await session.execute(
                update(SmsBatch)
                .where(SmsBatch.status == "processing", SmsBatch.created_at < clock.utcnow() - STUCK_AFTER)
                .values(status="received")
                .returning(SmsBatch.user_id)
            )
        )
        .scalars()
        .all()
    )
    for user_id in set(stuck_users):
        user = await session.get(User, user_id)
        if user is not None:
            mark_due(user)
            log.warning("Uploads stuck in processing were requeued", extra={"user_id": str(user_id)})


async def trigger_due_runs(
    factory: async_sessionmaker[AsyncSession], settings: Settings, trigger: PipelineTrigger, limit: int = 10
) -> int:
    """Trigger runs for users whose time has come. Returns how many were triggered."""
    async with factory() as session:
        await requeue_stuck_batches(session, settings)
        await session.flush()
        due = (
            (
                await session.execute(
                    select(User)
                    .where(User.pipeline_due_at <= clock.utcnow(), User.status == "active")
                    .order_by(User.pipeline_due_at)
                    .limit(limit)
                    .with_for_update(skip_locked=True)
                )
            )
            .scalars()
            .all()
        )
        triggered = 0
        for user in due:
            user.pipeline_due_at = None
            try:
                run_id = await trigger.trigger(user.id)
            except Exception as exc:
                log.warning(
                    "Couldn't trigger the pipeline; will retry",
                    extra={"user_id": str(user.id), "error_type": type(exc).__name__},
                )
                mark_due(user, settings.pipeline_retry_s)
                continue
            await session.execute(
                update(SmsBatch)
                .where(SmsBatch.user_id == user.id, SmsBatch.status == "received")
                .values(status="processing", pipeline_run_id=run_id)
            )
            triggered += 1
            log.info("Pipeline run triggered", extra={"user_id": str(user.id), "dag_run_id": run_id})
        await session.commit()
        return triggered


async def scheduler_loop(
    factory: async_sessionmaker[AsyncSession], settings: Settings, trigger: PipelineTrigger
) -> None:
    """Runs for the life of the API process (started in main.py's lifespan)."""
    while True:
        try:
            await trigger_due_runs(factory, settings, trigger)
        except Exception:
            log.exception("Pipeline scheduler pass failed")  # the next pass tries again
        await asyncio.sleep(settings.pipeline_scheduler_interval_s)


async def record_event(session: AsyncSession, settings: Settings, event: PipelineEventIn) -> None:
    """A run ended. A run reads everything uploaded before it started, so on success every
    batch from before `started_at` is done, and its provisional rows give way to the warehouse."""
    user = await session.get(User, event.user_id, with_for_update=True)
    if user is None:
        return  # deleted meanwhile: nothing to update
    session.add(
        PipelineEvent(
            user_id=user.id,
            run_id=event.run_id,
            status=event.status,
            started_at=event.started_at,
            finished_at=event.finished_at,
        )
    )
    covered = (
        select(SmsBatch.id)
        .where(
            SmsBatch.user_id == user.id, SmsBatch.status != "loaded", SmsBatch.created_at <= event.started_at
        )
        .scalar_subquery()
    )
    if event.status == "succeeded":
        # Provisional rows first: once the batches are "loaded", `covered` no longer finds them
        await session.execute(
            delete(ProvisionalTransaction).where(
                ProvisionalTransaction.user_id == user.id, ProvisionalTransaction.batch_id.in_(covered)
            )
        )
        await session.execute(
            update(SmsBatch)
            .where(SmsBatch.id.in_(covered))
            .values(status="loaded", loaded_at=event.finished_at)
        )
    else:
        # Back in the queue; retried after a pause, so a broken run doesn't loop every few seconds
        await session.execute(update(SmsBatch).where(SmsBatch.id.in_(covered)).values(status="received"))
        mark_due(user, settings.pipeline_retry_s)
    # Uploads that arrived during the run still need one. Only those: after a failure the run's
    # own uploads are "received" again too, and they wait for the back-off above, not the debounce.
    waiting = await session.scalar(
        select(SmsBatch.id)
        .where(
            SmsBatch.user_id == user.id, SmsBatch.status == "received", SmsBatch.created_at > event.started_at
        )
        .limit(1)
    )
    if waiting is not None:
        mark_due(user, settings.pipeline_debounce_s)
    await session.commit()
