import pandas as pd
import pytest

from src.transform.config import Owner
from src.transform.counterparty import classify, normalise_counterparties, split_name
from src.transform.enrich import (
    add_measures, add_natural_key, add_time_keys, flag_internal_transfers,
)

OWNER = Owner(names=frozenset({"KWAME OWUSU"}), numbers=frozenset({"0240000001"}))


@pytest.mark.parametrize("raw, expected", [
    ("  Sunshine   Laundry. ", ("SUNSHINE LAUNDRY", None)),
    ("0240000001 on MTN MOBILE MONEY", ("0240000001", "0240000001")),
    ("0240000002 MTN MOBILE MONEY", ("0240000002", "0240000002")),
    ("EDWINY PHARMACY LIMITED 233558000000", ("EDWINY PHARMACY LIMITED", "0558000000")),
    ("MTN AIRT", ("MTN AIRTIME", None)),
    ("VODA AIRT", ("TELECEL AIRTIME", None)),
    (None, (None, None)),
])
def test_split_name(raw, expected):
    assert split_name(raw) == expected


@pytest.mark.parametrize("name, phone, template, kind", [
    ("KWAME OWUSU", None, "payment_received", "own_wallet"),
    ("0240000001", "0240000001", "wallet_transfer_out", "own_wallet"),
    ("SOMEGAME VENTURES", None, "cash_out", "agent"),
    ("CALBANK PLC", None, "bank_transfer_in", "bank"),
    ("SAVINGS WALLET", None, "savings_deposit", "own_wallet"),
    ("MTN BUNDLE", None, "payment_sent", "telco"),
    ("OTHER NETWORKS", None, "refund", "telco"),
    ("MERCHANT 223691", None, "payment_sent", "merchant"),
    ("ADOMJOY FAST FOOD ENTERPRISE", None, "payment_sent", "merchant"),
    ("AMA SERWAA", None, "payment_sent", "person"),
    ("0240000009", "0240000009", "wallet_transfer_out", "person"),
    (None, None, "account_credited", "unknown"),
])
def test_classify(name, phone, template, kind):
    assert classify(name, phone, template, OWNER) == kind


def test_normalise_counterparties_keeps_the_raw_name():
    df = pd.DataFrame({"counterparty": ["MTN AIRT"], "template": ["airtime_topup"]})
    row = normalise_counterparties(df, OWNER).iloc[0]
    assert (row["counterparty"], row["counterparty_raw"], row["counterparty_kind"]) == (
        "MTN AIRTIME", "MTN AIRT", "telco")


def test_measures_sign_amounts_by_direction():
    df = pd.DataFrame({"direction": ["credit", "debit"], "amount": [10.0, 4.0],
                       "fee": [0.0, 0.5], "tax": [0.0, 0.1]})
    result = add_measures(df)
    assert result["signed_amount"].tolist() == [10.0, -4.0]
    assert result["total_cost"].tolist() == [0.0, 0.6]


def test_natural_key_falls_back_to_message_id():
    df = pd.DataFrame({"provider": ["mtn_momo", "ghanapay"],
                       "transaction_id": pd.array(["123", None], dtype="string"),
                       "message_id": ["aaaa", "bbbb"]})
    assert add_natural_key(df)["transaction_nk"].tolist() == ["mtn_momo:123", "ghanapay:msg:bbbb"]


def test_time_keys():
    df = pd.DataFrame({"occurred_at": [pd.Timestamp("2026-03-09T07:45:00", tz="UTC")]})
    row = add_time_keys(df).iloc[0]
    assert (row["date_key"], row["hour"]) == (20260309, 7)


@pytest.mark.parametrize("kind, reference, internal", [
    ("own_wallet", None, True),
    ("bank", "TRANSFER FROM KWAME OWUSU TO KWAME OWUSU FOOD", True),
    ("bank", "TRANSFER FROM KWAME OWUSU TO AMA SERWAA FOOD", False),
    ("person", "food", False),
])
def test_internal_transfer_flag(kind, reference, internal):
    df = pd.DataFrame({"counterparty_kind": [kind], "reference": [reference]})
    assert flag_internal_transfers(df)["is_internal_transfer"].iloc[0] == internal
