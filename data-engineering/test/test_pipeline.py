"""End to end: SMS backup XML -> processed Parquet, using only sample data."""

import json

import pandas as pd
import pytest

import samples as s
from src.lake.store import get_store
from src.orchestration.gates import QualityGateError, Thresholds
from src.orchestration.pipeline import run_pipeline
from src.transform.config import Owner
from src.transform.run import OUTPUT_COLUMNS

BACKUP = [
    (s.MTN, "2025-11-17T16:40:30", s.MERCHANT_PAID),
    (s.MTN, "2025-11-17T16:40:31", s.MERCHANT_CONFIRMED),     # same transaction, second SMS
    (s.MTN, "2025-11-18T09:00:00", s.PAYMENT_RECEIVED),
    (s.GHANAPAY, "2026-01-28T07:21:34", s.BANK_IN),            # transfer to yourself
    (s.GHANAPAY, "2026-01-28T07:39:39", s.GHANAPAY_TRANSFER_OUT),
    (s.MTN, "2026-01-29T10:00:00", s.OTP),
    (s.MTN, "2026-01-29T11:00:00", s.FAILED),
    (s.MTN, "2026-01-29T12:00:00", s.PROMO),
    ("CalBank", "2026-01-29T13:00:00", "Your account was debited with GHS 5.00"),
]


@pytest.fixture
def result(make_xml, tmp_path):
    owner = Owner(names=frozenset({"KWAME OWUSU"}), numbers=frozenset({"0240000001"}))
    stats = run_pipeline(make_xml(BACKUP), tmp_path / "data", owner=owner)
    transactions = pd.read_parquet(tmp_path / "data" / "processed" / "transactions.parquet")
    return stats, transactions, tmp_path / "data"


def test_every_step_reports_stats(result):
    stats, _, _ = result
    assert list(stats) == ["stage", "extract", "parse", "transform", "publish", "run_id"]
    assert stats["stage"]["backups"] == 1
    assert stats["extract"]["kept"] == 8  # CalBank isn't a MoMo sender
    assert (stats["parse"]["parsed"], stats["parse"]["ignored"]) == (5, 3)
    assert stats["transform"]["removed"] == {"duplicate_sms": 1, "cross_provider_receipts": 0}


def test_output_has_one_row_per_real_transaction(result):
    _, df, _ = result
    assert len(df) == 4
    assert list(df.columns) == OUTPUT_COLUMNS
    assert df["transaction_nk"].is_unique
    assert df["occurred_at"].is_monotonic_increasing


def test_output_values(result):
    _, df, _ = result
    by_template = df.set_index("template")
    assert by_template.loc["merchant_payment", "counterparty"] == "SUNSHINE LAUNDRY"
    assert by_template.loc["payment_received", "signed_amount"] == 150.0
    assert by_template.loc["ghanapay_wallet_transfer_out", "counterparty_kind"] == "own_wallet"
    assert df["is_internal_transfer"].sum() == 2  # bank self-transfer + transfer to own MTN wallet


def test_intermediate_files_are_written(result):
    _, _, data_dir = result
    for name in ["momo_sms.csv", "parsed_transactions.json", "unparsed_sms.csv",
                 "processed/quality_report.json"]:
        assert (data_dir / name).exists(), name
    report = json.loads((data_dir / "processed" / "quality_report.json").read_text())
    assert report["rows_out"] == 4


def test_rerunning_gives_the_same_output(make_xml, tmp_path):
    xml = make_xml(BACKUP)
    run_pipeline(xml, tmp_path / "a", owner=Owner())
    run_pipeline(xml, tmp_path / "b", owner=Owner())
    first = pd.read_parquet(tmp_path / "a" / "processed" / "transactions.parquet")
    second = pd.read_parquet(tmp_path / "b" / "processed" / "transactions.parquet")
    pd.testing.assert_frame_equal(first, second)


def test_failure_stops_the_pipeline(tmp_path):
    with pytest.raises(FileNotFoundError):
        run_pipeline(tmp_path / "missing.xml", tmp_path / "data", owner=Owner())
    assert not (tmp_path / "data" / "parsed_transactions.json").exists()


def test_history_survives_a_newer_backup_that_lost_old_sms(make_xml, tmp_path):
    jan = make_xml([(s.MTN, "2025-11-18T09:00:00", s.PAYMENT_RECEIVED)], name="jan.xml")
    # Months later the phone has deleted that SMS; the new backup only has newer ones.
    jun = make_xml([(s.MTN, "2026-06-01T09:00:00", s.PAYMENT_MADE)], name="jun.xml")

    run_pipeline(jan, tmp_path / "data", owner=Owner())
    stats = run_pipeline(jun, tmp_path / "data", owner=Owner())

    df = pd.read_parquet(tmp_path / "data" / "processed" / "transactions.parquet")
    assert stats["stage"]["backups"] == 2
    assert sorted(df["template"]) == ["payment_received", "payment_sent"]  # nothing lost


def test_each_run_publishes_its_own_report(make_xml, tmp_path):
    xml = make_xml(BACKUP)
    first = run_pipeline(xml, tmp_path / "data", owner=Owner())
    second = run_pipeline(xml, tmp_path / "data", owner=Owner())

    processed = get_store("PROCESSED_BUCKET")
    assert processed.exists("transactions/transactions.parquet")
    reports = processed.list("reports/")
    assert reports == sorted(f"reports/run_id={r['run_id']}/quality_report.json" for r in (first, second))
    report = json.loads(processed.open(reports[0]).read())
    assert report["config"]["run_id"] in (first["run_id"], second["run_id"])


def test_quality_gate_stops_the_pipeline_before_publishing(make_xml, tmp_path):
    xml = make_xml([(s.MTN, "2026-01-01T09:00:00", s.PAYMENT_MADE),
                    (s.MTN, "2026-01-01T10:00:00", "Payment received from KOFI. Current Balance: GHS 5.00")])

    with pytest.raises(QualityGateError, match="parse rate 50.0%"):
        run_pipeline(xml, tmp_path / "data", owner=Owner(), limits=Thresholds(min_parse_rate=0.95))
    assert get_store("PROCESSED_BUCKET").list() == []
