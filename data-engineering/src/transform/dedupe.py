"""Collapse the multiple SMS a provider sends for one transaction into one row.

MTN often sends two messages for the same payment (e.g. "You have Paid ... to Merchant 223691"
and "Your payment of ... to New Ariel Laundry"). Both carry the same transaction ID.
"""

import pandas as pd

KEY = ["provider", "transaction_id"]
_PLACEHOLDER_NAME = r"(?i)^merchant\s+\d+$"
# The copy with the best name may carry a vaguer template; these templates win regardless.
SPECIFIC_TEMPLATES = ["merchant_payment"]


def _richness(df: pd.DataFrame) -> pd.Series:
    """Higher = more useful copy: real counterparty name > has reference > has balance."""
    real_name = df["counterparty"].notna() & ~df["counterparty"].str.match(_PLACEHOLDER_NAME, na=False)
    return real_name * 4 + df["reference"].notna() * 2 + df["balance_after"].notna()


def drop_duplicate_transactions(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Returns (deduplicated frame, number of rows removed)."""
    keyed = df[df["transaction_id"].notna()].copy()
    unkeyed = df[df["transaction_id"].isna()].assign(sms_count=1)

    keyed["_richness"] = _richness(keyed)
    keyed = keyed.sort_values(["_richness", "occurred_at"], ascending=[False, True])
    groups = keyed.groupby(KEY, sort=False)

    best = groups.head(1).set_index(KEY)
    # Fill gaps in the chosen copy from its siblings; first() skips nulls.
    best["reference"] = best["reference"].fillna(groups["reference"].first())
    best["balance_after"] = best["balance_after"].fillna(groups["balance_after"].first())
    best["occurred_at"] = groups["occurred_at"].min()
    best["sms_count"] = groups.size()

    specific = keyed[keyed["template"].isin(SPECIFIC_TEMPLATES)].drop_duplicates(KEY).set_index(KEY)
    best.update(specific[["template", "transaction_type"]])

    result = pd.concat([best.reset_index().drop(columns="_richness"), unkeyed], ignore_index=True)
    result = result.sort_values(["occurred_at", "message_id"], ignore_index=True)
    return result, len(df) - len(result)


def drop_cross_provider_receipts(
    df: pd.DataFrame, window: pd.Timedelta = pd.Timedelta(minutes=2)
) -> tuple[pd.DataFrame, int]:
    """One purchase can be confirmed by two providers.

    E.g. a GhanaPay airtime top-up, then MTN's "You have successfully purchased GHS 2.00
    Airtime" receipt a second later. The receipt reports no balance because no money left
    that wallet, so it's the copy to drop.
    """
    receipts = df[df["balance_after"].isna()].reset_index()
    payers = df.loc[df["balance_after"].notna(), ["provider", "amount", "transaction_type", "occurred_at"]]

    pairs = receipts.merge(payers, on=["amount", "transaction_type"], suffixes=("", "_payer"))
    is_receipt = (pairs["provider"] != pairs["provider_payer"]) & (
        (pairs["occurred_at"] - pairs["occurred_at_payer"]).abs() <= window
    )
    to_drop = pairs.loc[is_receipt, "index"].unique()
    return df.drop(index=to_drop).reset_index(drop=True), len(to_drop)
