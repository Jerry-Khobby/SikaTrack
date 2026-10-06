"""Give every transaction a category, and record the rule that chose it.

Rules run in order; the first match wins:
    own money     savings moves and transfers between your own wallets
    money in      credits, by transaction type (interest, refunds, cash deposits, received)
    type          debit types that are a category on their own (airtime, cash-out, savings)
    reference     purpose words the sender typed: "food", "tithes", "medicine"
    counterparty  business and telco names: "... PHARMACY", "OTHER NETWORKS"
    default       transfers to a person or business with no stated purpose
    Uncategorized nothing matched; logged, so new keywords can be added

The rules are data: improving coverage means adding a keyword below, not code.
Every category used here must exist in dw.dim_category (sql/migrations).
"""

import re

import pandas as pd

UNCATEGORIZED = "Uncategorized"

MONEY_IN = {
    "interest": "Income",
    "transfer": "Income",
    "bank_transfer": "Income",
    "other": "Income",
    "cashin": "Cash Deposit",
    "refund": "Refunds",
    "reversal": "Refunds",
}

DEBIT_TYPES = {
    "airtime": "Airtime/Data",
    "cashout": "Cash Withdrawal",
    "savings": "Savings",
}

# Matched anywhere in the purpose, so "friedrice" and "tithesandoffering" count.
# Checked in this order: "water bill" is Bills before "water" is Food.
PURPOSE_KEYWORDS = {
    "Bills": r"\becg\b|prepaid|electric|light bill|water bill|dstv|gotv|wifi|internet|\brent\b",
    "Giving": r"tithe|offering|church|donation|charity|harvest",
    "Health": r"medic|drug|hospital|clinic|pharm|chemist",
    "Transport": r"transport|\bcar\b|taxi|trotro|uber|\bbolt\b|\bfare\b|fuel|petrol",
    "Education": r"school|tuition|\bfees\b|\bbooks?\b|exam",
    "Personal Care": r"barber|\bhair|salon|laundry|brush|soap|pomade",
    "Shopping": r"shirt|cloth|shoe|dress|screen|repair|print|gift",
    "Airtime/Data": r"airtime|\bdata\b|bundle",
    "Food": r"food|foid|\bfoo\b|\bchop|banku|rice|waakye|\byam\b|pie\b|yog(h)?urt|indomie|"
            r"\bmalt\b|kenkey|fufu|bread|chicken|\bfish|\bmeat|snack|lunch|breakfast|supper|"
            r"dinner|\bwater\b",
}

COUNTERPARTY_KEYWORDS = {
    "Health": r"pharmacy|chemist|hospital|clinic",
    "Food": r"food|catering|restaurant|\bchop|bakery",
    "Personal Care": r"laundry|salon|barber",
    "Airtime/Data": r"other networks|airtime|bundle",
    "Bills": r"\becg\b|dstv|gotv|ghana water",
    "Shopping": r"paystack|\bmall\b|\bmart\b|supermarket",
}

DEFAULT_BY_KIND = {
    "person": "Transfers-Personal",
    "telco": "Transfers-Personal",   # e.g. sending to a Telecel Cash wallet
    "merchant": "Transfers-Business",
}

_PURPOSE = {category: re.compile(pattern, re.I) for category, pattern in PURPOSE_KEYWORDS.items()}
_COUNTERPARTY = {category: re.compile(pattern, re.I) for category, pattern in COUNTERPARTY_KEYWORDS.items()}

CATEGORIES = sorted(
    {UNCATEGORIZED, "Own Transfers"} | set(MONEY_IN.values()) | set(DEBIT_TYPES.values())
    | set(PURPOSE_KEYWORDS) | set(COUNTERPARTY_KEYWORDS) | set(DEFAULT_BY_KIND.values())
)


def purpose(reference) -> str | None:
    """The purpose part of a reference: "Name,233200000000,food" -> "food"."""
    if not isinstance(reference, str) or not reference.strip():
        return None
    return reference.split(",")[-1].strip() or None


def _first_match(text, patterns: dict) -> tuple[str, str] | None:
    if not isinstance(text, str):
        return None
    for category, pattern in patterns.items():
        m = pattern.search(text)
        if m:
            return category, m.group(0).lower()
    return None


def categorise_row(row) -> tuple[str, str]:
    """(category, rule) for one transaction."""
    if row["is_internal_transfer"]:
        if row["transaction_type"] == "savings":
            return "Savings", "own:savings"
        return "Own Transfers", "own:transfer"

    if row["direction"] == "credit":
        category = MONEY_IN.get(row["transaction_type"])
        return (category, f"money_in:{row['transaction_type']}") if category else (UNCATEGORIZED, "none")

    if row["transaction_type"] in DEBIT_TYPES:
        return DEBIT_TYPES[row["transaction_type"]], f"type:{row['transaction_type']}"

    match = _first_match(purpose(row["reference"]), _PURPOSE)
    if match:
        return match[0], f"reference:{match[1]}"

    match = _first_match(row["counterparty"], _COUNTERPARTY)
    if match:
        return match[0], f"counterparty:{match[1]}"

    kind = row["counterparty_kind"]
    if kind in DEFAULT_BY_KIND:
        return DEFAULT_BY_KIND[kind], f"default:{kind}"
    return UNCATEGORIZED, "none"


def categorise(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    results = [categorise_row(row) for _, row in df.iterrows()]
    df["category"] = [category for category, _ in results]
    df["category_rule"] = [rule for _, rule in results]
    return df


def category_report(df: pd.DataFrame) -> dict:
    """Coverage over spending (your own debits): the metric the rules are tuned against."""
    spending = df[(df["direction"] == "debit") & ~df["is_internal_transfer"]]
    layer = spending["category_rule"].str.split(":").str[0]
    total = max(len(spending), 1)
    return {
        "spending_transactions": len(spending),
        "coverage": round(float((spending["category"] != UNCATEGORIZED).sum() / total), 4),
        "by_rule_layer": layer.value_counts().to_dict(),
        "spend_by_category": spending.groupby("category")["amount"].sum().round(2)
                                     .sort_values(ascending=False).to_dict(),
    }
