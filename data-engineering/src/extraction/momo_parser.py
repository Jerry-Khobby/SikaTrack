import csv 
import json 
import re 
from collections import Counter
from pathlib import Path

from src.utils.constants import (SENDER_TO_PROVIDER,REQUIRED_FIELDS,_MONEY, _AMOUNT, _AIRTIME_WORDS,
                                _NON_TRANSACTION,_SENT_START,_RECEIVED_START,_TO,_FROM,_TXN_ID,
                                _REFERENCE,_TAX,_FEE,_BALANCE,_AMOUNT,_MONEY
                                ) 



def _to_float(value):
    if value is None:
        return None
    value = value.strip().replace(",", "")
    if value == "-":
        return 0.0  # "Tax was GHS -" means no tax
    try:
        return float(value)
    except ValueError:
        return None
 
 
def _first(pattern, text):
    m = pattern.search(text)
    return m.group(1) if m else None
 
 
def classify(text: str) -> str:
    if _NON_TRANSACTION.search(text):
        return "non_transaction"
    if _RECEIVED_START.match(text):
        return "received"
    if _SENT_START.match(text):
        return "sent"
    return "unknown"
 
 
def _clean_name(name):
    return " ".join(name.split()) if name else None
 
 
# ---------------------------------------------------------
# Main parse function
# ---------------------------------------------------------
 
def parse_message(raw_text: str, sender: str = "", received_at: str = "", message_id: str = "") -> dict:
    text = " ".join(raw_text.split())  # collapse whitespace/newlines
 
    result = {
        "message_id": message_id,
        "raw_text": raw_text,
        "provider": SENDER_TO_PROVIDER.get(sender.strip().lower()),
        "direction": None,
        "amount": None,
        "counterparty": None,
        "transaction_type": None,
        "balance_after": None,
        "fee": None,
        "tax": None,
        "reference": None,
        "transaction_id": None,
        "timestamp": received_at,
        "parse_status": "unparsed",
    }
 
    kind = classify(text)
 
    if kind == "non_transaction":
        result["parse_status"] = "ignored"
        return result
    if kind == "unknown":
        return result
 
    result["direction"] = "credit" if kind == "received" else "debit"
 
    name_match = (_FROM if kind == "received" else _TO).search(text)
    result["counterparty"] = _clean_name(name_match.group(1)) if name_match else None
    result["amount"] = _to_float(_first(_AMOUNT, text))
    result["balance_after"] = _to_float(_first(_BALANCE, text))
    result["fee"] = _to_float(_first(_FEE, text))
    result["tax"] = _to_float(_first(_TAX, text))
    result["transaction_id"] = _first(_TXN_ID, text)
 
    ref = _first(_REFERENCE, text)
    result["reference"] = None if ref in (None, "", "-") else ref.strip()
 
    # Transaction type: airtime/data purchases vs person-to-person
    cp = result["counterparty"] or ""
    result["transaction_type"] = "airtime" if _AIRTIME_WORDS.search(cp) else "transfer"
 
    missing = [f for f in REQUIRED_FIELDS if result[f] is None]
    if missing:
        result["missing_fields"] = missing  # shows exactly what to fix
    else:
        result["parse_status"] = "parsed"
 
    return result
 
 
# ---------------------------------------------------------
# Batch runner
# ---------------------------------------------------------
 
def main() -> None:
    base = Path(__file__).resolve().parents[2]
    input_file = base / "data" / "momo_sms.csv"
    parsed_file = base / "data" / "parsed_transactions.json"
    unparsed_file = base / "data" / "unparsed_sms.csv"
 
    with open(input_file, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
 
    results = [
        parse_message(r["raw_text"], r["sender"], r["received_at"], r.get("message_id", ""))
        for r in rows
    ]
    counts = Counter(r["parse_status"] for r in results)
    attempted = counts["parsed"] + counts["unparsed"]  # ignored OTPs don't count against you
 
    with open(parsed_file, "w", encoding="utf-8") as f:
        json.dump([r for r in results if r["parse_status"] == "parsed"], f, indent=2)
 
    unparsed = [r for r in results if r["parse_status"] == "unparsed"]
    with open(unparsed_file, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["message_id", "missing_fields", "raw_text"])
        for r in unparsed:
            w.writerow([r["message_id"], ",".join(r.get("missing_fields", [])), r["raw_text"]])
 
    print(f"Total messages:   {len(results)}")
    print(f"Parsed:           {counts['parsed']}")
    print(f"Ignored (OTP...): {counts['ignored']}")
    print(f"Unparsed:         {counts['unparsed']}")
    if attempted:
        print(f"Parse success rate: {counts['parsed'] / attempted:.1%}  (parsed / (parsed + unparsed))")
    print(f"\nParsed   -> {parsed_file}")
    print(f"Unparsed -> {unparsed_file}  (review these, add patterns, re-run)")
 
 
if __name__ == "__main__":
    main()
 