"""Flag recurring payments: same counterparty, similar amount, steady rhythm.

A series is the spending to one counterparty within an amount band (±10%). It's recurring
when its gaps (between distinct days) fit one rhythm:

    rhythm        nominal  a gap fits if it's
    daily            1     1-2 days
    weekly           7     5-9 days
    fortnightly     14     12-17 days
    monthly         30     26-35 days

...for at least MIN_FIT of its gaps, with at least MIN_MATCHING_GAPS of them, so two lucky
coincidences don't count. Every transaction in a recurring series gets is_recurring,
recurring_interval_days and a stable recurring_series ID.
"""

import hashlib

import pandas as pd

INTERVALS = {
    "daily": (1, 1, 2),
    "weekly": (7, 5, 9),
    "fortnightly": (14, 12, 17),
    "monthly": (30, 26, 35),
}
AMOUNT_TOLERANCE = 0.10
MIN_OCCURRENCES = 4     # distinct days
MIN_MATCHING_GAPS = 3
MIN_FIT = 0.6           # share of gaps that fit the rhythm


def amount_bands(amounts: pd.Series) -> pd.Series:
    """Band index per amount: a new band starts when an amount is more than 10% above the
    band's smallest amount. Returns the band's smallest amount, used as its label."""
    labels, start = {}, None
    for amount in sorted(amounts.unique()):
        if start is None or amount > start * (1 + AMOUNT_TOLERANCE):
            start = amount
        labels[amount] = start
    return amounts.map(labels)


def _series_id(counterparty: str, band: float, interval: str) -> str:
    return hashlib.sha256(f"{counterparty}|{band:.2f}|{interval}".encode()).hexdigest()[:12]


def find_series(df: pd.DataFrame, as_of: pd.Timestamp | None = None) -> pd.DataFrame:
    """One row per recurring series found in the spending rows of df."""
    spending = df[(df["direction"] == "debit") & ~df["is_internal_transfer"] & df["counterparty"].notna()].copy()
    columns = ["series_id", "counterparty", "band", "interval", "interval_days", "fit",
               "occurrences", "median_amount", "category", "counterparty_kind", "last_seen", "active"]
    if spending.empty:
        return pd.DataFrame(columns=columns)

    as_of = (as_of or df["occurred_at"].max()).normalize()
    spending["day"] = spending["occurred_at"].dt.normalize()
    spending["band"] = spending.groupby("counterparty", group_keys=False)["amount"].apply(amount_bands)

    found = []
    for (counterparty, band), g in spending.groupby(["counterparty", "band"], sort=True):
        days = g["day"].drop_duplicates().sort_values()
        if len(days) < MIN_OCCURRENCES:
            continue
        gaps = days.diff().dt.days.dropna()
        for interval, (nominal, low, high) in INTERVALS.items():
            if not low <= gaps.median() <= high:
                continue
            matching = int(gaps.between(low, high).sum())
            fit = matching / len(gaps)
            if matching >= MIN_MATCHING_GAPS and fit >= MIN_FIT:
                found.append({
                    "series_id": _series_id(counterparty, band, interval),
                    "counterparty": counterparty,
                    "band": band,
                    "interval": interval,
                    "interval_days": nominal,
                    "fit": round(fit, 2),
                    "occurrences": len(days),
                    "median_amount": round(float(g["amount"].median()), 2),
                    "category": g["category"].mode().iloc[0],
                    "counterparty_kind": g["counterparty_kind"].iloc[0],
                    "last_seen": days.max(),
                    # still going: last payment within two rhythm-lengths of the latest data
                    "active": (as_of - days.max()).days <= 2 * high,
                })
            break  # a median gap fits at most one rhythm
    return pd.DataFrame(found, columns=columns)


def flag_recurring(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (df with is_recurring / recurring_interval_days / recurring_series, series)."""
    series = find_series(df)
    df = df.copy()
    df["is_recurring"] = False
    df["recurring_interval_days"] = pd.Series(pd.NA, index=df.index, dtype="Int16")
    df["recurring_series"] = pd.Series(pd.NA, index=df.index, dtype="string")
    if series.empty:
        return df, series

    spending = (df["direction"] == "debit") & ~df["is_internal_transfer"] & df["counterparty"].notna()
    bands = pd.Series(pd.NA, index=df.index, dtype="Float64")
    bands[spending] = df[spending].groupby("counterparty", group_keys=False)["amount"].apply(amount_bands)
    keys = pd.Series(list(zip(df["counterparty"], bands)), index=df.index)

    lookup = {(s.counterparty, s.band): s for s in series.itertuples()}
    for i in df.index[spending]:
        s = lookup.get(keys[i])
        if s is not None:
            df.at[i, "is_recurring"] = True
            df.at[i, "recurring_interval_days"] = s.interval_days
            df.at[i, "recurring_series"] = s.series_id
    return df, series


def recurring_report(df: pd.DataFrame, series: pd.DataFrame) -> dict:
    """Summary for the run report. No counterparty names: they can be people."""
    active = series[series["active"]] if not series.empty else series
    monthly = lambda s: round(float((s["median_amount"] * 30 / s["interval_days"]).sum()), 2) if not s.empty else 0.0
    return {
        "series": len(series),
        "active_series": len(active),
        "transactions_flagged": int(df["is_recurring"].sum()),
        "by_interval": series["interval"].value_counts().to_dict() if not series.empty else {},
        "active_monthly_cost": monthly(active),
        "series_detail": [
            {"series_id": s.series_id, "interval": s.interval, "median_amount": s.median_amount,
             "occurrences": s.occurrences, "fit": s.fit, "category": s.category,
             "counterparty_kind": s.counterparty_kind, "active": bool(s.active)}
            for s in series.itertuples()
        ],
    }
