import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import pandas as pd
import pytest

from src.extraction.momo_parser import parse_message


ISOLATED_ENV = [
    "OWNER_NAMES", "OWNER_NUMBERS", "LAKE_BACKEND", "LAKE_LOCAL_ROOT", "RAW_BUCKET", "PROCESSED_BUCKET",
    "WAREHOUSE_URL", "GATE_MIN_PARSE_RATE", "GATE_MIN_BALANCE_CONTINUITY", "GATE_MAX_UNEXPLAINED_GAPS",
]


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch, tmp_path):
    """Tests never see your .env or write to the real data/lake."""
    for name in ISOLATED_ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("LAKE_BACKEND", "local")
    monkeypatch.setenv("LAKE_LOCAL_ROOT", str(tmp_path / "lake"))
    # Sample SMS aren't one continuous ledger, so balance gates would always trip.
    # Gate tests pass their own Thresholds explicitly.
    monkeypatch.setenv("GATE_MIN_BALANCE_CONTINUITY", "0")
    monkeypatch.setenv("GATE_MAX_UNEXPLAINED_GAPS", "1000")


def to_epoch_ms(iso: str) -> str:
    dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)
    return str(int(dt.timestamp() * 1000))


@pytest.fixture
def make_xml(tmp_path):
    """Build an SMS Backup & Restore XML file from (sender, iso_time, body) tuples."""
    def _make(messages, name="backup.xml"):
        root = ET.Element("smses", count=str(len(messages)))
        for sender, iso, body in messages:
            date = to_epoch_ms(iso) if iso else "not-a-date"
            ET.SubElement(root, "sms", address=sender, date=date, body=body)
        path = tmp_path / name
        ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
        return path
    return _make


@pytest.fixture
def parsed_frame():
    """Parse (sender, iso_time, body) tuples into the frame the transform step receives."""
    def _make(messages):
        rows = [
            parse_message(body, sender, f"{iso}+00:00", message_id=f"msg{i:013d}")
            for i, (sender, iso, body) in enumerate(messages)
        ]
        assert all(r["parse_status"] == "parsed" for r in rows), "fixture SMS must parse"
        return pd.DataFrame(rows)
    return _make
