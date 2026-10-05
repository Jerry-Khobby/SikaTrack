"""Type casting, null handling and validation of raw parser output."""

import pandas as pd

MONEY_COLUMNS = ["amount", "fee", "tax", "balance_after"]
TEXT_COLUMNS = ["counterparty", "reference", "transaction_id"]
DROP_COLUMNS = ["timestamp", "parse_status", "warnings"]


def _strip_text(series: pd.Series) -> pd.Series:
    cleaned = series.astype("string").str.strip()
    return cleaned.mask(cleaned.isin(["", "-"]))


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["occurred_at"] = pd.to_datetime(df["timestamp"], utc=True, format="ISO8601")

    for col in MONEY_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").round(2)
    # A missing fee/tax means the SMS didn't mention one, i.e. none was charged.
    df[["fee", "tax"]] = df[["fee", "tax"]].fillna(0.0)

    for col in TEXT_COLUMNS:
        df[col] = _strip_text(df[col])

    _validate(df)
    return df.drop(columns=[c for c in DROP_COLUMNS if c in df.columns])


def _validate(df: pd.DataFrame) -> None:
    """Fail loudly: bad rows here mean a parser bug, not something to patch over."""
    problems = {
        "missing amount": df["amount"].isna(),
        "non-positive amount": df["amount"] <= 0,
        "bad direction": ~df["direction"].isin(["credit", "debit"]),
        "missing timestamp": df["occurred_at"].isna(),
        "missing provider": df["provider"].isna(),
    }
    found = {name: int(mask.sum()) for name, mask in problems.items() if mask.any()}
    if found:
        raise ValueError(f"Invalid parsed transactions: {found}")
