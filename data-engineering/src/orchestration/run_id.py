import uuid
from datetime import datetime, timezone


def new_run_id() -> str:
    """Sortable, unique: 20261005T143000Z-1a2b3c"""
    return f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:6]}"
