import argparse
import csv
import hashlib
import json
import logging
import xml.etree.ElementTree as ET
from collections import Counter
from contextlib import closing
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from typing import BinaryIO, Callable, Sequence, Union

from src.lake.raw_zone import list_sources
from src.lake.store import ObjectStore
from src.utils.constants import MOMO_KEYWORDS, MOMO_SENDERS
from src.utils.fileio import atomic_write
from src.utils.logging_config import setup_logging

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

FIELDNAMES = ["message_id", "raw_text", "sender", "received_at", "source_object"]

# (name, path or zero-arg function returning an open binary file)
Source = tuple[str, Union[Path, Callable[[], BinaryIO]]]

# Normalised once, so comparisons are case/whitespace-insensitive.
_SENDER_ALLOWLIST = {s.strip().lower() for s in MOMO_SENDERS}
_KEYWORDS = [k.lower() for k in MOMO_KEYWORDS]

# __spec__.name keeps the module path in log lines even when run with `python -m`.
log = logging.getLogger(__spec__.name if __spec__ else __name__)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def epoch_ms_to_iso(value: str) -> str:
    """Convert SMS Backup & Restore's epoch-milliseconds to ISO 8601 (UTC)."""
    try:
        dt = datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return ""
    return dt.isoformat()


def make_message_id(sender: str, date_ms: str, body: str) -> str:
    """Stable ID: same message always hashes to the same value.
    Reusable later as the backend's idempotency key."""
    raw = f"{sender}|{date_ms}|{body}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def is_momo_sender(sender: str) -> bool:
    """Strict check: sender must be in the allowlist."""
    return sender.strip().lower() in _SENDER_ALLOWLIST


def matches_keywords(sender: str, body: str) -> bool:
    """Loose check, used only for --discover mode."""
    text = f"{sender} {body}".lower()
    return any(k in text for k in _KEYWORDS)


def iter_sms(xml):
    """Stream <sms> elements from a path or binary file, without loading it all into memory."""
    for _, elem in ET.iterparse(xml, events=("end",)):
        if elem.tag == "sms":
            yield elem.attrib
            elem.clear()


def iter_jsonl(stream):
    """App uploads: one JSON object per line ({"sender", "date_ms", "body", ...}), read in the
    same shape as backup <sms> attributes, so both give the same message_id for the same SMS."""
    # read() then split: an S3 body iterates in fixed-size chunks, not lines (uploads are <= 1 MB)
    for line in stream.read().decode("utf-8").splitlines():
        if line.strip():
            sms = json.loads(line)
            yield {"address": sms["sender"], "date": str(sms["date_ms"]), "body": sms["body"]}


# ---------------------------------------------------------
# Modes
# ---------------------------------------------------------

def discover_senders(xml_path: Path) -> None:
    """Show which senders produce keyword matches, so you can build MOMO_SENDERS."""
    counts = Counter()
    for attrs in iter_sms(xml_path):
        sender = attrs.get("address", "").strip()
        body = attrs.get("body", "").strip()
        if body and matches_keywords(sender, body):
            counts[sender] += 1

    log.info("Senders with MoMo-like content (add the real ones to MOMO_SENDERS):")
    for sender, n in counts.most_common():
        log.info("  %5d  %s", n, sender)


def _open(source) -> BinaryIO:
    return open(source, "rb") if isinstance(source, (str, Path)) else closing(source())


def filter_momo_sms(sources: Union[Path, Sequence[Source]], output_path: Path) -> dict:
    """Merge the MoMo SMS from one or more backups into one CSV.

    A message found in several backups is kept once and credited to the first source
    that contained it, so pass sources oldest first.
    """
    if isinstance(sources, (str, Path)):
        sources = [(Path(sources).name, Path(sources))]
    if not _SENDER_ALLOWLIST:
        raise ValueError(
            "MOMO_SENDERS is empty. Run with --discover, then add your real "
            "sender IDs to src/utils/constants.py."
        )
    for name, source in sources:
        if isinstance(source, (str, Path)) and not Path(source).exists():
            raise FileNotFoundError(f"XML file not found: {source}")

    total = skipped_empty = skipped_bad_date = duplicates = 0
    rows: dict[str, dict] = {}

    for name, source in sources:
        log.info("Reading %s", name)
        read = iter_jsonl if str(name).endswith(".jsonl") else iter_sms
        with _open(source) as stream:
            for attrs in read(stream):
                total += 1
                sender = attrs.get("address", "").strip()
                body = attrs.get("body", "").strip()
                date_ms = attrs.get("date", "").strip()

                if not body:
                    skipped_empty += 1
                    continue
                if not is_momo_sender(sender):
                    continue

                received_at = epoch_ms_to_iso(date_ms)
                if not received_at:
                    skipped_bad_date += 1
                    log.warning("Skipped SMS from %s with unreadable date %r", sender, date_ms)
                    continue

                message_id = make_message_id(sender, date_ms, body)
                if message_id in rows:
                    duplicates += 1
                    log.debug("Duplicate SMS %s from %s skipped", message_id, sender)
                    continue

                rows[message_id] = {
                    "message_id": message_id,
                    "raw_text": body,
                    "sender": sender,
                    "received_at": received_at,
                    "source_object": name,
                }

    # Deterministic order -> identical output on every run.
    ordered = sorted(rows.values(), key=lambda r: (r["received_at"], r["message_id"]))

    with atomic_write(output_path, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(ordered)

    log.info(
        "Filtered %d SMS from %d backup(s): kept %d MoMo, %d duplicates, %d empty, %d bad dates -> %s",
        total, len(sources), len(ordered), duplicates, skipped_empty, skipped_bad_date, output_path,
    )

    return {
        "sources": len(sources),
        "scanned": total,
        "kept": len(ordered),
        "duplicates": duplicates,
        "empty_bodies": skipped_empty,
        "bad_dates": skipped_bad_date,
        "output_file": str(output_path),
    }


def filter_raw_zone(
    store: ObjectStore, output_path: Path, user_id: str | None = None, include_backups: bool = True
) -> dict:
    """Extract from every source of one user in the raw zone, so history accumulates.

    The legacy owner's sources are the backups (plus their app uploads once linked); an app
    user's are their uploads.
    """
    keys = list_sources(store, user_id, include_backups)
    if not keys:
        raise FileNotFoundError(f"No SMS staged in {store.name} for this user; stage some first")
    sources = [(f"{store.name}/{key}", partial(store.open, key)) for key in keys]
    return filter_momo_sms(sources, output_path)


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------

def main() -> None:
    """Find sender IDs to add to MOMO_SENDERS. Extraction itself runs in the pipeline."""
    setup_logging()
    parser = argparse.ArgumentParser(description="List senders whose SMS look like mobile money.")
    parser.add_argument("xml_file", type=Path, help="An SMS Backup & Restore export")
    discover_senders(parser.parse_args().xml_file)


if __name__ == "__main__":
    main()