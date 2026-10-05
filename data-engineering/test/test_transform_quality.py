import pandas as pd

from src.transform.quality import explain_balance_gaps, flag_balance_gaps

TOLERANCE = 0.02


def ledger(rows):
    """rows: (provider, minute, signed_amount, balance_after, is_internal_transfer)"""
    return pd.DataFrame([
        {"provider": p, "occurred_at": pd.Timestamp("2026-01-01", tz="UTC") + pd.Timedelta(minutes=m),
         "message_id": f"m{i}", "signed_amount": amt, "total_cost": 0.0,
         "balance_after": bal, "is_internal_transfer": internal}
        for i, (p, m, amt, bal, internal) in enumerate(rows)
    ])


def test_consistent_balances_have_no_gaps():
    df = flag_balance_gaps(ledger([
        ("mtn", 0, 100.0, 100.0, False),
        ("mtn", 1, -10.0, 90.0, False),
        ("mtn", 2, 5.0, None, False),      # no balance, but its flow still counts
        ("mtn", 3, -20.0, 75.0, False),    # 90 + 5 - 20
    ]), TOLERANCE)

    assert not df["has_balance_gap"].any()
    assert pd.isna(df.loc[0, "balance_gap_amount"])  # nothing to compare the first row with
    assert pd.isna(df.loc[2, "balance_gap_amount"])  # no balance to check
    assert df.loc[3, "balance_gap_amount"] == 0.0


def test_missing_transaction_shows_up_as_a_gap():
    df = flag_balance_gaps(ledger([
        ("mtn", 0, 100.0, 100.0, False),
        ("mtn", 1, -10.0, 87.0, False),    # expected 90: GHS 3 left with no SMS
    ]), TOLERANCE)

    assert df["has_balance_gap"].tolist() == [False, True]
    assert df.loc[1, "balance_gap_amount"] == -3.0


def test_fees_are_part_of_the_expected_balance():
    df = ledger([("mtn", 0, 100.0, 100.0, False), ("mtn", 1, -30.0, 69.5, False)])
    df["total_cost"] = [0.0, 0.5]
    assert not flag_balance_gaps(df, TOLERANCE)["has_balance_gap"].any()


def test_providers_are_checked_independently():
    df = flag_balance_gaps(ledger([
        ("mtn", 0, 100.0, 100.0, False),
        ("ghanapay", 1, 50.0, 50.0, False),
        ("mtn", 2, -10.0, 90.0, False),
    ]), TOLERANCE)
    assert not df["has_balance_gap"].any()


def test_gap_matching_your_own_transfer_is_explained():
    df = ledger([
        ("mtn", 0, 0.0, 0.08, False),
        ("ghanapay", 1, -40.0, 60.0, True),   # sent to your own MTN wallet
        ("mtn", 2, -3.0, 37.08, False),       # MTN never sent the "received 40" SMS
    ])
    df = explain_balance_gaps(flag_balance_gaps(df, TOLERANCE), TOLERANCE)

    assert df.loc[2, "balance_gap_amount"] == 40.0
    assert df.loc[2, "balance_gap_reason"] == "own_transfer_leg_missing"


def test_gap_without_a_matching_flow_is_unexplained():
    df = ledger([
        ("mtn", 0, 100.0, 100.0, False),
        ("ghanapay", 1, -25.0, 60.0, True),   # amount doesn't match the gap
        ("mtn", 2, -10.0, 87.0, False),
    ])
    df = explain_balance_gaps(flag_balance_gaps(df, TOLERANCE), TOLERANCE)

    assert df.loc[2, "balance_gap_reason"] == "unexplained"
    assert df["balance_gap_reason"].isna().sum() == 2  # only gap rows get a reason
