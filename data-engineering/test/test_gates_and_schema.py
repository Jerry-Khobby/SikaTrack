from pathlib import Path

import pandas as pd
import pytest

from src.orchestration.gates import QualityGateError, Thresholds, check_parse, check_transform
from src.transform.config import Owner, TransformConfig
from src.transform.dedupe import drop_duplicate_transactions
from src.transform.schema import OUTPUT_COLUMNS, SchemaError, to_table

LIMITS = Thresholds(min_parse_rate=0.95, min_balance_continuity=0.98, max_unexplained_gaps=2)


def parse_stats(parsed=95, unparsed=5):
    total = parsed + unparsed
    return {"parsed": parsed, "unparsed": unparsed, "parse_success_rate": parsed / total if total else None}


def transform_report(continuity=0.99, checked=100, unexplained=0, coverage=0.95):
    return {"providers": {"mtn_momo": {"continuity_rate": continuity, "balance_checked": checked}},
            "balance_gap_reasons": {"unexplained": unexplained} if unexplained else {},
            "categories": {"spending_transactions": 100, "coverage": coverage}}


def test_parse_gate_passes_at_the_limit():
    check_parse(parse_stats(95, 5), LIMITS)


@pytest.mark.parametrize("stats, message", [
    (parse_stats(90, 10), "parse rate 90.0% < 95.0%"),
    (parse_stats(0, 0), "no transactions parsed"),
])
def test_parse_gate_fails(stats, message):
    with pytest.raises(QualityGateError, match=message):
        check_parse(stats, LIMITS)


def test_transform_gate_passes():
    check_transform(transform_report(), LIMITS)
    check_transform(transform_report(continuity=0.0, checked=0), LIMITS)  # nothing to check


def test_transform_gate_reports_every_failure():
    with pytest.raises(QualityGateError) as e:
        check_transform(transform_report(continuity=0.9, unexplained=3), LIMITS)
    assert "mtn_momo balance continuity 90.0%" in str(e.value)
    assert "3 unexplained balance gaps > 2" in str(e.value)


def test_transform_gate_fails_on_low_category_coverage():
    with pytest.raises(QualityGateError, match="category coverage 50.0% < 90.0%"):
        check_transform(transform_report(coverage=0.5), Thresholds(min_category_coverage=0.9))


def test_thresholds_from_env(monkeypatch):
    monkeypatch.delenv("GATE_MIN_BALANCE_CONTINUITY")  # unset: falls back to the default
    monkeypatch.setenv("GATE_MIN_PARSE_RATE", "0.5")
    monkeypatch.setenv("GATE_MAX_UNEXPLAINED_GAPS", "7")
    limits = Thresholds.from_env()
    assert (limits.min_parse_rate, limits.min_balance_continuity, limits.max_unexplained_gaps) == (0.5, 0.98, 7)


def valid_frame():
    row = {
        "transaction_nk": "mtn_momo:1", "message_id": "a" * 16, "transaction_id": "1",
        "provider": "mtn_momo", "template": "payment_sent", "transaction_type": "transfer",
        "direction": "debit", "occurred_at": pd.Timestamp("2026-01-01", tz="UTC"),
        "date_key": 20260101, "hour": 0, "amount": 5.0, "signed_amount": -5.0, "fee": 0.0,
        "tax": 0.0, "total_cost": 0.0, "balance_after": None, "counterparty": None,
        "counterparty_phone": None, "counterparty_kind": "unknown", "counterparty_raw": None,
        "reference": None, "category": "Transfers-Personal", "category_rule": "default:person",
        "is_internal_transfer": False, "has_balance_gap": False,
        "balance_gap_amount": None, "balance_gap_reason": None, "sms_count": 1,
        "raw_text": "sms", "source_object": None,
    }
    return pd.DataFrame([row])


def test_schema_accepts_a_valid_frame():
    table = to_table(valid_frame())
    assert table.schema.names == OUTPUT_COLUMNS


def test_schema_rejects_missing_columns():
    with pytest.raises(SchemaError, match="Missing columns: \\['raw_text'\\]"):
        to_table(valid_frame().drop(columns="raw_text"))


def test_schema_rejects_nulls_in_required_columns():
    df = valid_frame()
    df["provider"] = None
    with pytest.raises(SchemaError, match="provider"):
        to_table(df)


def test_schema_rejects_wrong_types():
    df = valid_frame()
    df["amount"] = "five"
    with pytest.raises(SchemaError, match="types"):
        to_table(df)


def test_duplicate_tie_is_broken_by_message_id():
    copies = pd.DataFrame({
        "provider": ["mtn_momo"] * 2, "transaction_id": ["1"] * 2, "message_id": ["bbb", "aaa"],
        "counterparty": ["AMA"] * 2, "reference": ["x"] * 2, "balance_after": [1.0] * 2,
        "occurred_at": [pd.Timestamp("2026-01-01", tz="UTC")] * 2, "template": ["payment_sent"] * 2,
        "transaction_type": ["transfer"] * 2,
    })
    for order in (copies, copies.iloc[::-1]):
        result, _ = drop_duplicate_transactions(order.reset_index(drop=True))
        assert result["message_id"].tolist() == ["aaa"]


def test_report_config_identifies_owner_settings_without_revealing_them():
    owner = Owner(names=frozenset({"KWAME OWUSU"}), numbers=frozenset({"0240000001"}))
    config = TransformConfig(Path("in.json"), Path("out"), owner=owner, run_id="r1")
    described = config.describe()

    assert described["run_id"] == "r1"
    assert (described["owner_names"], described["owner_numbers"]) == (1, 1)
    assert "KWAME" not in str(described) and "0240000001" not in str(described)
    assert described["owner_fingerprint"] != TransformConfig(Path("in.json"), Path("out")).describe()["owner_fingerprint"]
