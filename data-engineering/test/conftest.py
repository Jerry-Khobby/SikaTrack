import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import pandas as pd
import pytest

from src.extraction.momo_parser import parse_message


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
