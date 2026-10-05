import csv

import pytest

from samples import GHANAPAY, MTN, PAYMENT_MADE, PAYMENT_RECEIVED, TOP_UP
from src.extraction.filter_sms import (
    epoch_ms_to_iso, filter_momo_sms, is_momo_sender, make_message_id,
)


def test_epoch_ms_to_iso_converts_to_utc():
    assert epoch_ms_to_iso("0") == "1970-01-01T00:00:00+00:00"


@pytest.mark.parametrize("bad", ["", "abc", "99999999999999999999999"])
def test_epoch_ms_to_iso_returns_empty_on_bad_input(bad):
    assert epoch_ms_to_iso(bad) == ""


def test_message_id_is_stable_and_content_sensitive():
    a = make_message_id("MobileMoney", "1700000000000", "body")
    assert a == make_message_id("MobileMoney", "1700000000000", "body")
    assert len(a) == 16
    assert a != make_message_id("MobileMoney", "1700000000000", "other body")


@pytest.mark.parametrize("sender, expected", [
    ("MobileMoney", True), ("  mobilemoney ", True), ("GhanaPay", True),
    ("MTN", False), ("CalBank", False), ("", False),
])
def test_is_momo_sender(sender, expected):
    assert is_momo_sender(sender) is expected


def read_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_filter_keeps_only_momo_sms_sorted_and_deduplicated(make_xml, tmp_path):
    xml = make_xml([
        (MTN, "2026-01-02T10:00:00", PAYMENT_RECEIVED),
        (GHANAPAY, "2026-01-01T09:00:00", TOP_UP),
        (MTN, "2026-01-02T10:00:00", PAYMENT_RECEIVED),   # exact duplicate
        ("MTN", "2026-01-01T08:00:00", "Data bundle purchased"),  # not a MoMo sender
        (MTN, "2026-01-03T08:00:00", ""),                 # empty body
        (MTN, None, PAYMENT_MADE),                        # unreadable date
    ])
    out = tmp_path / "momo_sms.csv"

    stats = filter_momo_sms(xml, out)

    rows = read_rows(out)
    assert [r["sender"] for r in rows] == [GHANAPAY, MTN]  # oldest first
    assert rows[0]["received_at"] == "2026-01-01T09:00:00+00:00"
    assert {r["source_object"] for r in rows} == {"backup.xml"}
    assert stats == {
        "sources": 1, "scanned": 6, "kept": 2, "duplicates": 1, "empty_bodies": 1, "bad_dates": 1,
        "output_file": str(out),
    }


def test_filter_merges_backups_and_keeps_history(make_xml, tmp_path):
    old = make_xml([(MTN, "2026-01-01T09:00:00", PAYMENT_RECEIVED),
                    (MTN, "2026-01-02T09:00:00", PAYMENT_MADE)], name="old.xml")
    # The newer backup lost the oldest SMS (phone deleted it) but has a new one.
    new = make_xml([(MTN, "2026-01-02T09:00:00", PAYMENT_MADE),
                    (GHANAPAY, "2026-01-03T09:00:00", TOP_UP)], name="new.xml")
    out = tmp_path / "momo_sms.csv"

    stats = filter_momo_sms([("old.xml", old), ("new.xml", new)], out)

    rows = read_rows(out)
    assert [r["source_object"] for r in rows] == ["old.xml", "old.xml", "new.xml"]
    assert (stats["sources"], stats["kept"], stats["duplicates"]) == (2, 3, 1)


def test_failed_write_keeps_the_previous_output(make_xml, tmp_path, monkeypatch):
    xml = make_xml([(MTN, "2026-01-02T10:00:00", PAYMENT_RECEIVED)])
    out = tmp_path / "momo_sms.csv"
    filter_momo_sms(xml, out)
    before = out.read_bytes()

    def crash(*args, **kwargs):
        raise OSError("disk full")
    monkeypatch.setattr(csv.DictWriter, "writerows", crash)

    with pytest.raises(OSError):
        filter_momo_sms(xml, out)
    assert out.read_bytes() == before
    assert not list(tmp_path.glob("*.tmp"))


def test_filter_is_idempotent(make_xml, tmp_path):
    xml = make_xml([(MTN, "2026-01-02T10:00:00", PAYMENT_RECEIVED), (GHANAPAY, "2026-01-01T09:00:00", TOP_UP)])
    out = tmp_path / "momo_sms.csv"

    filter_momo_sms(xml, out)
    first = out.read_bytes()
    filter_momo_sms(xml, out)

    assert out.read_bytes() == first


def test_filter_raises_when_xml_missing(tmp_path):
    with pytest.raises(FileNotFoundError):
        filter_momo_sms(tmp_path / "missing.xml", tmp_path / "out.csv")
