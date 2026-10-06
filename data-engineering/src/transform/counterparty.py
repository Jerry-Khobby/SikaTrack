"""Normalise counterparty names and classify who the other party is."""

import re

import pandas as pd

from src.transform.config import Owner

# "0240000001 on MTN MOBILE MONEY" | "0240000001 MTN MOBILE MONEY"
_WALLET_SUFFIX = re.compile(r"\s+(?:ON\s+)?MTN\s+MOBILE\s+MONEY$")
# "EXAMPLE PHARMACY LIMITED 233550000000"
_TRAILING_PHONE = re.compile(r"\s+(233\d{9})$")
_LOCAL_PHONE = re.compile(r"^0\d{9}$")
_MERCHANT_ID = re.compile(r"^MERCHANT\s+\d+$")
_TELCO = re.compile(r"^(?:MTN|TELECEL|VODA|AIRTELTIGO|OTHER NETWORKS)\b")
_BUSINESS = re.compile(
    r"\b(?:LTD|LIMITED|VENTURES?|ENTERPRISES?|PHARMACY|CHEMIST|CATERING|SHOP|STORES?|SERVICES?)\b"
)

ALIASES = {
    "MTN AIRT": "MTN AIRTIME",
    "MTNONLINEAIRTIMEVENDOR": "MTN AIRTIME",
    "VODA AIRT": "TELECEL AIRTIME",
}

KIND_BY_TEMPLATE = {
    "merchant_payment": "merchant",
    "cash_in": "agent",
    "cash_out": "agent",
    "bank_transfer_in": "bank",
    "bank_transfer_out": "bank",
    "savings_deposit": "own_wallet",
    "savings_withdrawal": "own_wallet",
    "interest_credit": "provider",
}


def _to_local(phone: str) -> str:
    return "0" + phone[3:] if phone.startswith("233") else phone


def split_name(raw: str | None) -> tuple[str | None, str | None]:
    """Raw counterparty -> (normalised name, phone number in local format)."""
    if raw is None or pd.isna(raw):
        return None, None
    name = " ".join(str(raw).split()).upper().rstrip(" .,")

    name = _WALLET_SUFFIX.sub("", name)
    if _LOCAL_PHONE.match(name):
        return name, name

    phone = None
    m = _TRAILING_PHONE.search(name)
    if m:
        phone = _to_local(m.group(1))
        name = name[: m.start()]

    return ALIASES.get(name, name) or None, phone


def classify(name: str | None, phone: str | None, template: str, owner: Owner) -> str:
    if name is None:
        return "unknown"
    if name in owner.names or (phone and phone in owner.numbers):
        return "own_wallet"
    if template in KIND_BY_TEMPLATE:
        return KIND_BY_TEMPLATE[template]
    if _TELCO.match(name):
        return "telco"
    if _MERCHANT_ID.match(name) or _BUSINESS.search(name):
        return "merchant"
    return "person"  # includes bare phone numbers: someone's wallet


def normalise_counterparties(df: pd.DataFrame, owner: Owner) -> pd.DataFrame:
    df = df.copy()
    parts = df["counterparty"].map(split_name)
    df["counterparty_raw"] = df["counterparty"]
    df["counterparty"] = parts.str[0]
    df["counterparty_phone"] = parts.str[1]
    df["counterparty_kind"] = [
        classify(name, phone, template, owner)
        for name, phone, template in zip(df["counterparty"], df["counterparty_phone"], df["template"])
    ]
    return df
