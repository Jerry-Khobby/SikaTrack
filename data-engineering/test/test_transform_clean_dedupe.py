import pandas as pd
import pytest

import samples as s
from src.transform.clean import clean
from src.transform.dedupe import drop_cross_provider_receipts, drop_duplicate_transactions


def test_clean_casts_types_and_fills_missing_fees(parsed_frame):
    df = clean(parsed_frame([(s.GHANAPAY, "2026-01-01T10:00:00", s.SAVINGS_DEPOSIT)]))

    row = df.iloc[0]
    assert row["occurred_at"] == pd.Timestamp("2026-01-01T10:00:00", tz="UTC")
    assert (row["fee"], row["tax"]) == (0.0, 0.0)  # SMS mentions neither
    assert {"timestamp", "parse_status"}.isdisjoint(df.columns)


def test_clean_turns_placeholder_text_into_null(parsed_frame):
    raw = parsed_frame([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)])
    raw.loc[0, "reference"] = " - "
    assert pd.isna(clean(raw).loc[0, "reference"])


@pytest.mark.parametrize("column, value", [
    ("amount", None), ("amount", 0), ("direction", "sideways"), ("provider", None),
])
def test_clean_rejects_invalid_rows(parsed_frame, column, value):
    raw = parsed_frame([(s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE)])
    raw.loc[0, column] = value
    with pytest.raises(ValueError, match="Invalid parsed transactions"):
        clean(raw)


def test_duplicate_sms_collapse_into_the_richest_copy(parsed_frame):
    df = clean(parsed_frame([
        (s.MTN, "2025-11-17T16:40:30", s.MERCHANT_PAID),
        (s.MTN, "2025-11-17T16:40:31", s.MERCHANT_CONFIRMED),
    ]))

    result, removed = drop_duplicate_transactions(df)

    assert removed == 1
    row = result.iloc[0]
    assert row["counterparty"] == "Sunshine Laundry"           # real name beats "Merchant 223691"
    assert (row["template"], row["transaction_type"]) == ("merchant_payment", "merchant")
    assert row["reference"] == "laundry"
    assert row["sms_count"] == 2
    assert row["occurred_at"] == pd.Timestamp("2025-11-17T16:40:30", tz="UTC")  # earliest copy


def test_distinct_transactions_are_kept(parsed_frame):
    df = clean(parsed_frame([
        (s.MTN, "2026-01-01T10:00:00", s.PAYMENT_MADE),
        (s.MTN, "2026-01-01T11:00:00", s.PAYMENT_RECEIVED),
    ]))
    result, removed = drop_duplicate_transactions(df)
    assert (removed, len(result)) == (0, 2)
    assert (result["sms_count"] == 1).all()


def test_receipt_from_a_second_provider_is_dropped(parsed_frame):
    df = clean(parsed_frame([
        (s.GHANAPAY, "2026-05-03T21:59:11", s.TOP_UP),
        (s.MTN, "2026-05-03T21:59:12", s.AIRTIME_RECEIPT),
    ]))

    result, removed = drop_cross_provider_receipts(df)

    assert removed == 1
    assert result["provider"].tolist() == ["ghanapay"]


def test_unrelated_receipt_is_kept(parsed_frame):
    df = clean(parsed_frame([
        (s.GHANAPAY, "2026-05-03T21:59:11", s.TOP_UP),
        (s.MTN, "2026-05-03T22:30:00", s.AIRTIME_RECEIPT),  # half an hour later
    ]))
    result, removed = drop_cross_provider_receipts(df)
    assert (removed, len(result)) == (0, 2)
