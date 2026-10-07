"""Small state objects in the processed bucket.

- Fingerprint: what was last processed, so a scheduled run can skip when nothing changed.
  It covers the staged backups and the settings that shape the output; a change to the
  parser or transform code isn't covered, so trigger the DAG with force=true after one.
- Heartbeat: when the pipeline last ran at all (even a skipped run), so monitoring can
  tell a quiet day from a pipeline that has stopped.
"""

import hashlib
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from src.lake.raw_zone import list_backups
from src.lake.store import ObjectStore
from src.transform.config import Owner

STATE_KEY = "state/last_processed_fingerprint.txt"
HEARTBEAT_KEY = "state/pipeline_heartbeat.txt"


def _read_text(store: ObjectStore, key: str) -> str | None:
    if not store.exists(key):
        return None
    return store.open(key).read().decode().strip()


def _write_text(store: ObjectStore, key: str, value: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "value.txt"
        path.write_text(value, encoding="utf-8")
        store.put_file(key, path)


def fingerprint(raw: ObjectStore, owner: Owner) -> str:
    content = "\n".join(list_backups(raw)) + "\nowner:" + owner.fingerprint()
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def last_fingerprint(processed: ObjectStore) -> str | None:
    return _read_text(processed, STATE_KEY)


def save_fingerprint(processed: ObjectStore, value: str) -> None:
    _write_text(processed, STATE_KEY, value)


def save_heartbeat(processed: ObjectStore, when: datetime | None = None) -> None:
    _write_text(processed, HEARTBEAT_KEY, (when or datetime.now(timezone.utc)).isoformat())


def last_heartbeat(processed: ObjectStore) -> datetime | None:
    value = _read_text(processed, HEARTBEAT_KEY)
    return datetime.fromisoformat(value) if value else None
