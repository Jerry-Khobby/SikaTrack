"""Recurring detection on synthetic series, as the spec asks: clear patterns must be found,
noise and coincidences must not."""

import pandas as pd

from src.transform.recurring import amount_bands, find_series, flag_recurring, recurring_report

START = pd.Timestamp("2026-01-01 09:00", tz="UTC")


def payments(day_offsets, amount=20.0, counterparty="NETFLIX", direction="debit", internal=False):
    return [{"occurred_at": START + pd.Timedelta(days=d), "amount": amount, "counterparty": counterparty,
             "direction": direction, "is_internal_transfer": internal, "category": "Bills",
             "counterparty_kind": "merchant"} for d in day_offsets]


def frame(*groups):
    return pd.DataFrame([row for group in groups for row in group]).reset_index(drop=True)


def test_weekly_series_is_found():
    series = find_series(frame(payments([0, 7, 14, 21, 28])))
    assert series[["interval", "interval_days", "occurrences", "fit"]].values.tolist() == [["weekly", 7, 5, 1.0]]


def test_monthly_series_tolerates_uneven_month_lengths():
    series = find_series(frame(payments([0, 31, 59, 90, 120], amount=145.0)))
    assert series["interval"].tolist() == ["monthly"]


def test_daily_habit_with_a_skipped_day_is_found():
    series = find_series(frame(payments([0, 1, 2, 4, 5, 6, 7], amount=3.0)))
    assert series["interval"].tolist() == ["daily"]


def test_irregular_payments_are_not_recurring():
    assert find_series(frame(payments([0, 3, 17, 20, 45, 46, 80]))).empty


def test_two_matching_gaps_are_a_coincidence_not_a_pattern():
    assert find_series(frame(payments([0, 7, 14, 40]))).empty  # only 2 of 3 gaps are weekly


def test_too_few_payments_are_never_a_series():
    assert find_series(frame(payments([0, 7, 14]))).empty


def test_amounts_within_ten_percent_form_one_series():
    rows = frame(payments([0, 14], amount=20.0), payments([7, 21, 28], amount=21.5))  # +7.5%
    assert find_series(rows)["interval"].tolist() == ["weekly"]


def test_amounts_more_than_ten_percent_apart_are_separate_series():
    bands = amount_bands(pd.Series([3.0, 3.2, 15.0, 16.0, 30.0]))
    assert bands.tolist() == [3.0, 3.0, 15.0, 15.0, 30.0]


def test_money_in_and_own_transfers_are_ignored():
    rows = frame(payments([0, 7, 14, 21], direction="credit"),
                 payments([0, 7, 14, 21], counterparty="SAVINGS", internal=True))
    assert find_series(rows).empty


def test_several_payments_on_one_day_count_once():
    rows = frame(payments([0, 0, 0, 7, 7, 14, 21]))
    assert find_series(rows)["occurrences"].tolist() == [4]


def test_series_still_going_is_active():
    rows = frame(payments([0, 7, 14, 21]), payments([100], counterparty="SHOP"))
    series = find_series(rows, as_of=START + pd.Timedelta(days=25))
    assert series["active"].tolist() == [True]
    assert find_series(rows, as_of=START + pd.Timedelta(days=60))["active"].tolist() == [False]


def test_flag_recurring_marks_only_the_series_rows():
    rows = frame(payments([0, 7, 14, 21]), payments([3, 50], counterparty="SHOP"))
    flagged, series = flag_recurring(rows)

    netflix = flagged["counterparty"] == "NETFLIX"
    assert flagged.loc[netflix, "is_recurring"].all()
    assert set(flagged.loc[netflix, "recurring_interval_days"]) == {7}
    assert flagged.loc[netflix, "recurring_series"].nunique() == 1
    assert not flagged.loc[~netflix, "is_recurring"].any()
    assert flagged.loc[~netflix, "recurring_series"].isna().all()


def test_series_id_is_stable_across_runs():
    rows = frame(payments([0, 7, 14, 21]))
    assert find_series(rows)["series_id"].tolist() == find_series(rows.iloc[::-1])["series_id"].tolist()


def test_no_series_leaves_flags_empty():
    flagged, series = flag_recurring(frame(payments([0, 30])))
    assert series.empty and not flagged["is_recurring"].any()
    assert recurring_report(flagged, series)["series"] == 0


def test_report_summarises_without_counterparty_names():
    rows = frame(payments([0, 7, 14, 21], amount=10.0))
    flagged, series = flag_recurring(rows)
    report = recurring_report(flagged, series)

    assert (report["series"], report["transactions_flagged"]) == (1, 4)
    assert report["active_monthly_cost"] == round(10.0 * 30 / 7, 2)
    assert "NETFLIX" not in str(report)
