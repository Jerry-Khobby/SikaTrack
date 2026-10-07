import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import boto3
import pandas as pd
import pytest
from moto import mock_aws

from src.extraction.momo_parser import parse_message

ISOLATED_ENV = [
    "OWNER_NAMES", "OWNER_NUMBERS", "RAW_BUCKET", "PROCESSED_BUCKET", "S3_ENDPOINT",
    "GATE_MIN_PARSE_RATE", "GATE_MIN_BALANCE_CONTINUITY", "GATE_MAX_UNEXPLAINED_GAPS",
    "GATE_MIN_CATEGORY_COVERAGE",
]


class FakeSMTP:
    """Stands in for smtplib.SMTP: records messages, never touches the network."""
    sent: list = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        self.user, self.password = user, password
        FakeSMTP.last_login = (user, password)

    def send_message(self, message):
        FakeSMTP.sent.append(message)


@pytest.fixture
def outbox():
    """Emails 'sent' during the test."""
    return FakeSMTP.sent


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch):
    """Tests never see your .env, RustFS, real buckets or a real mail server."""
    import os
    import smtplib

    for name in ISOLATED_ENV + ["EMAIL_USER", "EMAIL_PASS", "ALERT_EMAIL_TO", "SMTP_HOST", "SMTP_PORT",
                                "DIGEST_ENABLED", "WATCHDOG_ENABLED", "AIRFLOW_PUBLIC_URL"]:
        monkeypatch.delenv(name, raising=False)
    for name in [n for n in os.environ if n.startswith("MONITOR_")]:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ALERTS_ENABLED", "false")  # tests that check sending switch it on
    FakeSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("S3_ACCESS_KEY", "test")
    monkeypatch.setenv("S3_SECRET_KEY", "test")
    # Sample SMS aren't one continuous ledger, so balance gates would always trip.
    # Gate tests pass their own Thresholds explicitly.
    monkeypatch.setenv("GATE_MIN_BALANCE_CONTINUITY", "0")
    monkeypatch.setenv("GATE_MAX_UNEXPLAINED_GAPS", "1000")
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        for bucket in ("sikatrack-raw", "sikatrack-processed"):
            s3.create_bucket(Bucket=bucket)
        yield


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
