import csv
import json

import pytest

import samples as s
from src.extraction.momo_parser import parse_file, parse_message

# (sender, sms, expected fields). Only the listed fields are checked.
PARSED_CASES = {
    "payment_sent airtime": (s.MTN, s.PAYMENT_SENT_AIRTIME, dict(
        template="payment_sent", direction="debit", amount=5.0, counterparty="MTN AIRTIME",
        transaction_type="airtime", balance_after=97.23, fee=0.0, tax=0.0, reference=None,
        transaction_id="69042092287")),
    "payment_made to person": (s.MTN, s.PAYMENT_MADE, dict(
        template="payment_sent", direction="debit", amount=16.5, counterparty="AMA SERWAA",
        transaction_type="transfer", balance_after=75.73, reference="K", transaction_id="69065381661")),
    "merchant_payment": (s.MTN, s.MERCHANT_PAID, dict(
        template="merchant_payment", direction="debit", amount=47.5, counterparty="Merchant 223691",
        transaction_type="merchant", balance_after=235.62, fee=0.23, reference="laundry")),
    "cash_out": (s.MTN, s.CASH_OUT, dict(
        template="cash_out", direction="debit", amount=30.0, counterparty="SOMEGAME VENTURES",
        transaction_type="cashout", balance_after=24.85, fee=0.5, transaction_id="69079237453")),
    "cash_in": (s.MTN, s.CASH_IN, dict(
        template="cash_in", direction="credit", amount=303.0, counterparty="AA DELAPAT ENTERPRISE",
        transaction_type="cashin", balance_after=322.85, transaction_id="69128852154")),
    "payment_received": (s.MTN, s.PAYMENT_RECEIVED, dict(
        template="payment_received", direction="credit", amount=150.0, counterparty="KOFI MENSAH",
        transaction_type="transfer", balance_after=207.12, reference="NSS OFFICE")),
    "interest_credit": (s.MTN, s.INTEREST, dict(
        template="interest_credit", direction="credit", amount=1.23, counterparty="Wallet interest",
        transaction_type="interest", balance_after=4.2, transaction_id="75142967632")),
    "refund": (s.MTN, s.REFUND, dict(
        template="refund", direction="credit", amount=5.0, counterparty="Other Networks",
        transaction_type="refund", balance_after=89.8)),
    "reversal": (s.MTN, s.REVERSAL, dict(
        template="reversal", direction="credit", amount=3.0, counterparty="MTN BUNDLE",
        transaction_type="reversal", balance_after=8.13, transaction_id="81447854506")),
    "airtime receipt without balance": (s.MTN, s.AIRTIME_RECEIPT, dict(
        template="airtime_purchase", direction="debit", amount=2.0, counterparty="MTNONLINEAIRTIMEVENDOR",
        transaction_type="airtime", balance_after=None, transaction_id="80578323679",
        warnings=["balance_after"])),
    "savings_deposit": (s.GHANAPAY, s.SAVINGS_DEPOSIT, dict(
        template="savings_deposit", direction="debit", amount=2.0, counterparty="Savings wallet",
        transaction_type="savings", balance_after=0.15)),
    "savings_withdrawal ignores savings balance": (s.GHANAPAY, s.SAVINGS_WITHDRAWAL, dict(
        template="savings_withdrawal", direction="credit", amount=2.0, counterparty="Savings wallet",
        balance_after=None)),
    "bank_transfer_in": (s.GHANAPAY, s.BANK_IN, dict(
        template="bank_transfer_in", direction="credit", amount=2.0, counterparty="CalBank PLC",
        transaction_type="bank_transfer", balance_after=4.15, transaction_id="602807215466")),
    "bank_transfer_out": (s.GHANAPAY, s.BANK_OUT, dict(
        template="bank_transfer_out", direction="debit", amount=10.0, counterparty="CalBank PLC",
        balance_after=979.15, fee=0.0, tax=0.0)),
    "ghanapay_wallet_transfer_out": (s.GHANAPAY, s.GHANAPAY_TRANSFER_OUT, dict(
        template="ghanapay_wallet_transfer_out", direction="debit", amount=144.0,
        counterparty="0240000001 on MTN MOBILE MONEY", balance_after=835.15, reference="Tithes")),
    "airtime_topup": (s.GHANAPAY, s.TOP_UP, dict(
        template="airtime_topup", direction="debit", amount=2.0, counterparty="MTN AIRT",
        transaction_type="airtime", balance_after=104.03)),
    "wallet_transfer_out": (s.GHANAPAY, s.WALLET_TRANSFER_OUT, dict(
        template="wallet_transfer_out", direction="debit", amount=30.0,
        counterparty="0240000002 MTN MOBILE MONEY", balance_after=0.03, reference="Food")),
}


@pytest.mark.parametrize("sender, sms, expected", PARSED_CASES.values(), ids=PARSED_CASES.keys())
def test_parses_every_template(sender, sms, expected):
    result = parse_message(sms, sender, "2026-01-01T00:00:00+00:00", "id")

    assert result["parse_status"] == "parsed"
    assert {k: result.get(k) for k in expected} == expected


@pytest.mark.parametrize("sender, expected", [
    (s.MTN, "mtn_momo"), (s.GHANAPAY, "ghanapay"), ("Unknown", None),
])
def test_provider_comes_from_sender(sender, expected):
    assert parse_message(s.PAYMENT_MADE, sender)["provider"] == expected


@pytest.mark.parametrize("sms, reason", [
    (s.OTP, "otp"),
    (s.FAILED, "failed_transaction"),
    (s.PROMO, "promo"),
    (s.CUSTOMER_MESSAGE, "customer_message"),
])
def test_non_transactions_are_ignored(sms, reason):
    result = parse_message(sms, s.MTN)
    assert result["parse_status"] == "ignored"
    assert result["ignore_reason"] == reason


def test_unknown_format_is_unparsed_not_dropped():
    result = parse_message("Something completely new happened to your wallet.", s.MTN)
    assert result["parse_status"] == "unparsed"
    assert "missing_fields" not in result


def test_promo_mentioning_a_balance_stays_visible():
    # Anything with a balance could be a real transaction in a new format: never hide it.
    result = parse_message("Free cash! Your balance: GHS 5.00. T&Cs apply.", s.MTN)
    assert result["parse_status"] == "unparsed"


def test_balance_is_never_mistaken_for_the_amount():
    result = parse_message("Payment received from KOFI MENSAH. Current Balance: GHS 10.00", s.MTN)
    assert result["parse_status"] == "unparsed"
    assert result["missing_fields"] == ["amount"]


def test_parse_file_writes_outputs_and_stats(tmp_path):
    source = tmp_path / "momo_sms.csv"
    with open(source, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["message_id", "raw_text", "sender", "received_at"])
        w.writeheader()
        w.writerow({"message_id": "a", "raw_text": s.PAYMENT_MADE, "sender": s.MTN, "received_at": "t"})
        w.writerow({"message_id": "b", "raw_text": s.OTP, "sender": s.MTN, "received_at": "t"})
        w.writerow({"message_id": "c", "raw_text": "Brand new format.", "sender": s.MTN, "received_at": "t"})

    stats = parse_file(source, tmp_path / "parsed.json", tmp_path / "unparsed.csv")

    assert (stats["parsed"], stats["ignored"], stats["unparsed"]) == (1, 1, 1)
    assert stats["parse_success_rate"] == 0.5  # ignored messages don't count against it
    assert [r["message_id"] for r in json.loads((tmp_path / "parsed.json").read_text())] == ["a"]
    with open(tmp_path / "unparsed.csv", encoding="utf-8") as f:
        assert [r["message_id"] for r in csv.DictReader(f)] == ["c"]
