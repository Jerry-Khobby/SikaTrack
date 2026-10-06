import hashlib
import uuid
from datetime import datetime, timezone


def new_run_id() -> str:
    """Sortable, unique: 20261005T143000Z-1a2b3c"""
    return f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:6]}"


def run_id_for(orchestrator_run_id: str, started: datetime) -> str:
    """Same format, but deterministic: a retried Airflow run maps to the same pipeline run ID.

    Airflow's own IDs (e.g. "manual__2026-10-06T17:00:00+00:00") contain characters that
    don't belong in object keys and are too long for dw.etl_run.run_id.
    """
    digest = hashlib.sha256(orchestrator_run_id.encode()).hexdigest()[:6]
    return f"{started.astimezone(timezone.utc):%Y%m%dT%H%M%SZ}-{digest}"
