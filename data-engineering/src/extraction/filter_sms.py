import argparse
import csv
import hashlib
import logging
import os
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from src.utils.constants import MOMO_KEYWORDS, MOMO_SENDERS
from src.utils.logging_config import setup_logging

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_XML_FILE = BASE_DIR / "data" / "sms-20261003215510.xml"
OUTPUT_FILE = BASE_DIR / "data" / "momo_sms.csv"

FIELDNAMES = ["message_id", "raw_text", "sender", "received_at"]

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


def iter_sms(xml_path: Path):
    """Stream <sms> elements without loading the whole file into memory."""
    for _, elem in ET.iterparse(xml_path, events=("end",)):
        if elem.tag == "sms":
            yield elem.attrib
            elem.clear()


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


def filter_momo_sms(xml_path: Path, output_path: Path = OUTPUT_FILE) -> dict:
    if not xml_path.exists():
        raise FileNotFoundError(f"XML file not found: {xml_path}")
    if not _SENDER_ALLOWLIST:
        raise ValueError(
            "MOMO_SENDERS is empty. Run with --discover, then add your real "
            "sender IDs to src/utils/constants.py."
        )

    log.info("Reading %s", xml_path)

    total = skipped_empty = skipped_bad_date = duplicates = 0
    rows: dict[str, dict] = {}

    for attrs in iter_sms(xml_path):
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
        }

    # Deterministic order -> identical output on every run.
    ordered = sorted(rows.values(), key=lambda r: (r["received_at"], r["message_id"]))

    # Atomic write: never leaves a half-written CSV if the script dies mid-run.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = output_path.with_suffix(".csv.tmp")
    with open(tmp_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(ordered)
    os.replace(tmp_path, output_path)

    log.info(
        "Filtered %d SMS: kept %d MoMo, %d duplicates, %d empty, %d bad dates -> %s",
        total, len(ordered), duplicates, skipped_empty, skipped_bad_date, output_path,
    )

    return {
        "scanned": total,
        "kept": len(ordered),
        "duplicates": duplicates,
        "empty_bodies": skipped_empty,
        "bad_dates": skipped_bad_date,
        "output_file": str(output_path),
    }


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------

def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description="Extract MoMo SMS from a backup XML.")
    parser.add_argument("xml_file", nargs="?", type=Path, default=DEFAULT_XML_FILE)
    parser.add_argument("--discover", action="store_true",
                        help="List senders matching MoMo keywords, then exit.")
    args = parser.parse_args()

    if args.discover:
        discover_senders(args.xml_file)
    else:
        filter_momo_sms(args.xml_file)


if __name__ == "__main__":
    main()