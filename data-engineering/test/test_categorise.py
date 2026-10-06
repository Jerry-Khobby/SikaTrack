import re
from pathlib import Path

import pandas as pd
import pytest

from src.transform.categorise import CATEGORIES, UNCATEGORIZED, categorise, categorise_row, category_report, purpose


def tx(direction="debit", transaction_type="transfer", reference=None, counterparty="AMA SERWAA",
       counterparty_kind="person", internal=False, amount=10.0):
    return {"direction": direction, "transaction_type": transaction_type, "reference": reference,
            "counterparty": counterparty, "counterparty_kind": counterparty_kind,
            "is_internal_transfer": internal, "amount": amount}


@pytest.mark.parametrize("reference, expected", [
    ("food", "food"),
    ("Kofi Mensah,233200000000,food", "food"),  # name,phone,purpose: only the purpose counts
    ("  ", None),
    (None, None),
])
def test_purpose(reference, expected):
    assert purpose(reference) == expected


@pytest.mark.parametrize("row, category, rule", [
    # own money comes first, whatever else the row says
    (tx(internal=True, transaction_type="savings"), "Savings", "own:savings"),
    (tx(internal=True, reference="food"), "Own Transfers", "own:transfer"),
    # money in, by type
    (tx(direction="credit", transaction_type="cashin"), "Cash Deposit", "money_in:cashin"),
    (tx(direction="credit", transaction_type="refund"), "Refunds", "money_in:refund"),
    (tx(direction="credit", reference="food"), "Income", "money_in:transfer"),
    # debit types that are a category on their own
    (tx(transaction_type="airtime"), "Airtime/Data", "type:airtime"),
    (tx(transaction_type="cashout", reference="food"), "Cash Withdrawal", "type:cashout"),
    # reference purpose words, including run-together ones
    (tx(reference="Kofi,233200000000,food"), "Food", "reference:food"),
    (tx(reference="friedrice"), "Food", "reference:rice"),
    (tx(reference="tithesandoffering"), "Giving", "reference:tithe"),
    (tx(reference="water bill"), "Bills", "reference:water bill"),  # Bills is checked before Food
    (tx(reference="water"), "Food", "reference:water"),
    (tx(reference="medicine"), "Health", "reference:medic"),
    (tx(reference="car"), "Transport", "reference:car"),
    (tx(reference="card"), "Transfers-Personal", "default:person"),  # "car" must be a whole word
    # counterparty names when the reference says nothing useful
    (tx(reference="k", counterparty="EDWINY PHARMACY LIMITED", counterparty_kind="merchant"),
     "Health", "counterparty:pharmacy"),
    (tx(counterparty="OTHER NETWORKS", counterparty_kind="telco"), "Airtime/Data", "counterparty:other networks"),
    # defaults
    (tx(counterparty_kind="merchant", counterparty="WISDOM ENTERPRISE"), "Transfers-Business", "default:merchant"),
    (tx(counterparty_kind="person"), "Transfers-Personal", "default:person"),
    (tx(counterparty_kind="bank", counterparty="CALBANK PLC", transaction_type="bank_transfer"), UNCATEGORIZED, "none"),
])
def test_categorise_row(row, category, rule):
    assert categorise_row(row) == (category, rule)


def test_categorise_adds_both_columns():
    df = categorise(pd.DataFrame([tx(reference="food"), tx(transaction_type="airtime")]))
    assert df["category"].tolist() == ["Food", "Airtime/Data"]
    assert df["category_rule"].tolist() == ["reference:food", "type:airtime"]


def test_report_measures_coverage_over_spending_only():
    df = categorise(pd.DataFrame([
        tx(reference="food", amount=30.0),
        tx(counterparty_kind="bank", counterparty="CALBANK PLC", transaction_type="bank_transfer", amount=10.0),
        tx(direction="credit", amount=500.0),  # money in: not spending
        tx(internal=True, amount=100.0),       # own money: not spending
    ]))
    report = category_report(df)

    assert report["spending_transactions"] == 2
    assert report["coverage"] == 0.5
    assert report["by_rule_layer"] == {"reference": 1, "none": 1}
    assert report["spend_by_category"] == {"Food": 30.0, UNCATEGORIZED: 10.0}


def test_every_category_exists_in_the_warehouse_migrations():
    """The loader fails on a category dw.dim_category doesn't have; catch that drift here."""
    sql = "\n".join(p.read_text(encoding="utf-8")
                    for p in sorted((Path(__file__).parents[1] / "sql" / "migrations").glob("*.sql")))
    seeded = set(re.findall(r"\('([^']+)'\)", sql)) | {UNCATEGORIZED}
    assert set(CATEGORIES) <= seeded, set(CATEGORIES) - seeded
