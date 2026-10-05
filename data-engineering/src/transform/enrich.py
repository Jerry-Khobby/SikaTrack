"""Derived columns: measures, time keys and internal-transfer flags."""

import re

import pandas as pd

# "TRANSFER FROM JOHN DOE TO JOHN DOE FOOD": moving money between your own accounts
_SELF_TRANSFER = re.compile(r"TRANSFER FROM (.+?) TO \1\b", re.I)


def add_natural_key(df: pd.DataFrame) -> pd.DataFrame:
    """Warehouse upsert key: one per real transaction, stable across runs."""
    df = df.copy()
    fallback = "msg:" + df["message_id"].astype("string")
    df["transaction_nk"] = df["provider"] + ":" + df["transaction_id"].fillna(fallback)
    return df


def add_measures(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    sign = df["direction"].map({"credit": 1, "debit": -1})
    df["signed_amount"] = (df["amount"] * sign).round(2)
    df["total_cost"] = (df["fee"] + df["tax"]).round(2)
    return df


def add_time_keys(df: pd.DataFrame) -> pd.DataFrame:
    """Ghana is UTC+0 all year, so UTC timestamps are already local time."""
    df = df.copy()
    df["date_key"] = df["occurred_at"].dt.strftime("%Y%m%d").astype(int)
    df["hour"] = df["occurred_at"].dt.hour
    return df


def flag_internal_transfers(df: pd.DataFrame) -> pd.DataFrame:
    """Money moved between your own wallets/accounts: not income, not spending."""
    df = df.copy()
    self_reference = df["reference"].map(
        lambda ref: bool(_SELF_TRANSFER.search(ref)) if isinstance(ref, str) else False
    )
    df["is_internal_transfer"] = (df["counterparty_kind"] == "own_wallet") | self_reference
    return df
