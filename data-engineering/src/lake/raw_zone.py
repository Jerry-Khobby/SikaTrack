"""The raw zone: every SMS backup, stored unchanged. The source of truth the pipeline replays.

Layout: sms_backup/ingest_date=YYYY-MM-DD/<file stem>-<content hash>.xml
"""

import hashlib
import logging
from datetime import date
from pathlib import Path

from src.lake.store import ObjectStore

log = logging.getLogger(__spec__.name if __spec__ else __name__)

PREFIX = "sms_backup/"


def content_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()[:12]


def stage_backup(xml_path: Path, store: ObjectStore, ingest_date: date | None = None) -> str:
    """Copy a backup into the raw zone and return its key.

    Idempotent: a file whose content is already staged (under any date) isn't stored
    again. Existing objects are never overwritten.
    """
    xml_path = Path(xml_path)
    if not xml_path.is_file():
        raise FileNotFoundError(f"Backup not found: {xml_path}")

    digest = content_hash(xml_path)
    existing = [k for k in list_backups(store) if k.endswith(f"-{digest}.xml")]
    if existing:
        log.info("Backup %s already staged as %s", xml_path.name, existing[0])
        return existing[0]

    day = (ingest_date or date.today()).isoformat()
    key = f"{PREFIX}ingest_date={day}/{xml_path.stem}-{digest}.xml"
    store.put_file(key, xml_path)
    log.info("Staged %s -> %s/%s", xml_path.name, store.name, key)
    return key


def list_backups(store: ObjectStore) -> list[str]:
    """All staged backups, oldest ingest date first."""
    return [k for k in store.list(PREFIX) if k.endswith(".xml")]
