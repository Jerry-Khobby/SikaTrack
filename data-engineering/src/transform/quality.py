"""Data-quality checks: running-balance continuity and the run report."""

import pandas as pd


def flag_balance_gaps(df: pd.DataFrame, tolerance: float) -> pd.DataFrame:
    """Each balance should equal the previous balance plus every flow since then.

    A gap usually means a transaction with no SMS in the backup (deleted, or never sent),
    so the dataset is incomplete around that point. Rows without a balance still count
    as flows, they just can't be checked themselves.
    """
    df = df.sort_values(["occurred_at", "message_id"], ignore_index=True)
    flow = df["signed_amount"] - df["total_cost"]
    running = flow.groupby(df["provider"]).cumsum()

    # anchor = balance minus running flow; constant between two rows if nothing is missing
    anchor = df["balance_after"] - running
    previous_anchor = anchor.groupby(df["provider"]).transform(lambda s: s.ffill().shift())
    gap = (df["balance_after"] - (previous_anchor + running)).round(2)

    df["balance_gap_amount"] = gap.where(gap.abs() > tolerance, 0.0).where(gap.notna())
    df["has_balance_gap"] = gap.abs() > tolerance  # NaN compares False
    return df


def explain_balance_gaps(df: pd.DataFrame, tolerance: float) -> pd.DataFrame:
    """Label each gap with its most likely cause.

    own_transfer_leg_missing: another of your wallets sent/received exactly the gap amount
        since this wallet's last balance, but this wallet never got an SMS for its side.
        Needs OWNER_NAMES / OWNER_NUMBERS, otherwise nothing is flagged internal.
    unexplained: no matching flow in the data; an SMS is missing from the backup.
    """
    df = df.copy()
    balance_at = df["occurred_at"].where(df["balance_after"].notna())
    last_balance_at = balance_at.groupby(df["provider"]).transform(lambda s: s.ffill().shift())
    internal = df[df["is_internal_transfer"]]

    df["balance_gap_reason"] = pd.Series(pd.NA, index=df.index, dtype="string")
    for i in df.index[df["has_balance_gap"]]:
        row = df.loc[i]
        # The other wallet's debit is this wallet's missing credit, and vice versa.
        other_leg = internal[
            (internal["provider"] != row["provider"])
            & (internal["occurred_at"] > last_balance_at[i])
            & (internal["occurred_at"] <= row["occurred_at"])
            & ((internal["signed_amount"] + row["balance_gap_amount"]).abs() <= tolerance)
        ]
        df.at[i, "balance_gap_reason"] = "own_transfer_leg_missing" if len(other_leg) else "unexplained"
    return df


def build_report(rows_in: int, removed: dict[str, int], df: pd.DataFrame) -> dict:
    checked = df["balance_gap_amount"].notna()
    per_provider = {}
    for provider, g in df.groupby("provider"):
        g_checked = g["balance_gap_amount"].notna()
        per_provider[provider] = {
            "transactions": len(g),
            "balance_checked": int(g_checked.sum()),
            "balance_gaps": int(g["has_balance_gap"].sum()),
            "continuity_rate": round(1 - g["has_balance_gap"].sum() / max(g_checked.sum(), 1), 4),
        }

    return {
        "rows_in": rows_in,
        "removed": removed,
        "rows_out": len(df),
        "date_range": [df["occurred_at"].min(), df["occurred_at"].max()],
        "balance_checked": int(checked.sum()),
        "balance_gaps": int(df["has_balance_gap"].sum()),
        "balance_gap_reasons": df["balance_gap_reason"].value_counts().to_dict(),
        "providers": per_provider,
        "counterparty_kinds": df["counterparty_kind"].value_counts().to_dict(),
        "internal_transfers": int(df["is_internal_transfer"].sum()),
    }
