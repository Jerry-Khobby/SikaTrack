"""End to end: SMS backup XML -> processed Parquet, using only sample data."""

import json

import pandas as pd
import pytest

import samples as s
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
    assert list(stats) == ["extract", "parse", "transform"]
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
