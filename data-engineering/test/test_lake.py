import csv
from datetime import date

import boto3
import pytest
from moto import mock_aws

import samples as s
from src.extraction.filter_sms import filter_raw_zone
from src.lake.raw_zone import list_backups, stage_backup
from src.lake.store import LocalObjectStore, S3ObjectStore, get_store


@pytest.fixture
def local_store(tmp_path):
    return LocalObjectStore(tmp_path / "lake", "raw")


@pytest.fixture
def s3_store():
    """MinIO speaks the S3 API; moto fakes it in memory, so no server is needed."""
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="raw")
        yield S3ObjectStore("raw", client)


@pytest.fixture(params=["local", "s3"])
def store(request):
    return request.getfixturevalue(f"{request.param}_store")


def test_store_round_trip(store, tmp_path):
    src = tmp_path / "file.txt"
    src.write_bytes(b"hello")

    store.put_file("a/b/file.txt", src)

    assert store.exists("a/b/file.txt")
    assert not store.exists("a/b/other.txt")
    assert store.open("a/b/file.txt").read() == b"hello"
    assert store.list("a/") == ["a/b/file.txt"]
    assert store.list("zzz/") == []


def test_local_store_rejects_keys_outside_the_bucket(local_store, tmp_path):
    with pytest.raises(ValueError, match="escapes"):
        local_store.put_file("../outside.txt", tmp_path)


def test_get_store_uses_env(monkeypatch, tmp_path):
    monkeypatch.setenv("RAW_BUCKET", "my-raw")
    store = get_store("RAW_BUCKET")
    assert isinstance(store, LocalObjectStore)
    assert store.root == tmp_path / "lake" / "my-raw"

    monkeypatch.setenv("LAKE_BACKEND", "ftp")
    with pytest.raises(ValueError, match="LAKE_BACKEND"):
        get_store("RAW_BUCKET")


def test_staging_is_idempotent(store, make_xml):
    xml = make_xml([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)])

    first = stage_backup(xml, store, ingest_date=date(2026, 1, 1))
    again = stage_backup(xml, store, ingest_date=date(2026, 2, 1))  # same content, later day

    assert first == again
    assert first.startswith("sms_backup/ingest_date=2026-01-01/backup-")
    assert list_backups(store) == [first]


def test_new_backup_content_is_staged_separately(store, make_xml):
    old = make_xml([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)], name="backup.xml")
    first = stage_backup(old, store, ingest_date=date(2026, 1, 1))
    new = make_xml([(s.MTN, "2026-02-01T10:00:00", s.PAYMENT_RECEIVED)], name="backup.xml")  # same name
    second = stage_backup(new, store, ingest_date=date(2026, 2, 1))

    assert first != second
    assert list_backups(store) == [first, second]  # oldest first
    assert b"16.50" in store.open(first).read()     # the original was never overwritten


def test_staging_a_missing_file_fails(store, tmp_path):
    with pytest.raises(FileNotFoundError):
        stage_backup(tmp_path / "missing.xml", store)


def test_extract_reads_every_backup_in_the_raw_zone(store, make_xml, tmp_path):
    stage_backup(make_xml([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)], name="jan.xml"),
                 store, ingest_date=date(2026, 1, 1))
    stage_backup(make_xml([(s.MTN, "2026-02-01T10:00:00", s.PAYMENT_RECEIVED)], name="feb.xml"),
                 store, ingest_date=date(2026, 2, 1))
    out = tmp_path / "momo_sms.csv"

    stats = filter_raw_zone(store, out)

    with open(out, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert stats["sources"] == 2
    assert [r["source_object"].split("/")[-1].split("-")[0] for r in rows] == ["jan", "feb"]
    assert all(r["source_object"].startswith("raw/sms_backup/") for r in rows)


def test_extract_fails_on_an_empty_raw_zone(store, tmp_path):
    with pytest.raises(FileNotFoundError, match="No backups staged"):
        filter_raw_zone(store, tmp_path / "out.csv")
