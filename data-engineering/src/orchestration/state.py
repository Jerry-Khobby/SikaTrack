"""Remember what was last processed, so a scheduled run can skip when nothing changed.

The fingerprint covers the staged backups and the settings that shape the output. A change
to the parser or transform code isn't covered: trigger the DAG with force=true after one.
"""

import hashlib
import tempfile
from pathlib import Path

from src.lake.raw_zone import list_backups
from src.lake.store import ObjectStore
from src.transform.config import Owner

STATE_KEY = "state/last_processed_fingerprint.txt"


def fingerprint(raw: ObjectStore, owner: Owner) -> str:
    content = "\n".join(list_backups(raw)) + "\nowner:" + owner.fingerprint()
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def last_fingerprint(processed: ObjectStore) -> str | None:
    if not processed.exists(STATE_KEY):
        return None
    return processed.open(STATE_KEY).read().decode().strip()


def save_fingerprint(processed: ObjectStore, value: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "fingerprint.txt"
        path.write_text(value, encoding="utf-8")
        processed.put_file(STATE_KEY, path)
