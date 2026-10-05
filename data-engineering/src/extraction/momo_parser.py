"""
MoMo SMS parser: template table + field-level extraction.

Flow: raw text -> (OTP / failed check) -> match a TEMPLATE row -> extract fields -> validate

Statuses:
    parsed    template recognised and all REQUIRED fields found.
              Missing OPTIONAL fields are listed in 'warnings' (record is still kept).
    ignored   not a transaction (otp / failed_transaction / promo / customer_message);
              see 'ignore_reason'
    unparsed  unrecognised format (missing_fields empty), or a REQUIRED field
              missing (missing_fields lists which). Written to unparsed_sms.csv.

Run:  python -m src.extraction.momo_parser
"""

import csv
import json
import logging
from collections import Counter
from pathlib import Path

from src.utils.constants import (
    IGNORE_RULES, OPTIONAL_FIELDS, REQUIRED_FIELDS, SENDER_TO_PROVIDER, TEMPLATES,
    _AIRTIME_WORDS, _AMOUNT, _BALANCE, _FAILED, _FEE, _OTP, _REFERENCE, _REFERENCE_ALT,
    _TAX, _TXN_ID, _TXN_ID_ALT,
)
from src.utils.logging_config import setup_logging

# __spec__.name keeps the module path in log lines even when run with `python -m`.
log = logging.getLogger(__spec__.name if __spec__ else __name__)


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


def _clean_name(name):
    return " ".join(name.split()) if name else None


def parse_message(raw_text: str, sender: str = "", received_at: str = "", message_id: str = "") -> dict:
    text = " ".join(raw_text.split())  # collapse whitespace/newlines

    result = {
        "message_id": message_id,
        "raw_text": raw_text,
        "provider": SENDER_TO_PROVIDER.get(sender.strip().lower()),
        "template": None,
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

    # 1. OTPs first: never treat these as anything else
    if _OTP.search(text):
        result.update(parse_status="ignored", ignore_reason="otp")
        return result

    # 2. Failed transactions moved no money
    if _FAILED.search(text):
        result.update(parse_status="ignored", ignore_reason="failed_transaction")
        return result

    # 3. Find the template this message belongs to
    template = next((t for t in TEMPLATES if t["start"].match(text)), None)

    if template is None:
        # Only hide promos/notices if the message shows no balance: a real
        # transaction in an unknown format must stay visible as 'unparsed'.
        if not _BALANCE.search(text):
            for reason, pattern in IGNORE_RULES:
                if pattern.search(text):
                    result.update(parse_status="ignored", ignore_reason=reason)
                    return result
        return result  # stays 'unparsed' with no missing_fields = new format

    # 4. Extract fields
    result["template"] = template["name"]
    result["direction"] = template["direction"]

    cp = template["counterparty"]
    if isinstance(cp, str):                       # fixed label, e.g. "Savings wallet"
        result["counterparty"] = cp
    elif cp is not None:                          # regex
        m = cp.search(text)
        result["counterparty"] = _clean_name(m.group(1)) if m else None

    # The amount must come BEFORE the balance in the message; otherwise a missing
    # amount would silently be replaced by the balance figure.
    balance_match = _BALANCE.search(text)
    limit = balance_match.start() if balance_match else len(text)
    amount_match = next((m for m in _AMOUNT.finditer(text) if m.start() < limit), None)
    result["amount"] = _to_float(amount_match.group(1)) if amount_match else None
    if template.get("wallet_balance", True):  # some messages report another wallet's balance
        result["balance_after"] = _to_float(balance_match.group(1)) if balance_match else None
    result["fee"] = _to_float(_first(_FEE, text))
    result["tax"] = _to_float(_first(_TAX, text))
    result["transaction_id"] = _first(_TXN_ID, text) or _first(_TXN_ID_ALT, text)

    ref = _first(_REFERENCE, text) or _first(_REFERENCE_ALT, text)
    result["reference"] = None if ref in (None, "", "-") else ref.strip()

    if template["type"]:
        result["transaction_type"] = template["type"]
    else:
        name = result["counterparty"] or ""
        result["transaction_type"] = "airtime" if _AIRTIME_WORDS.search(name) else "transfer"

    # 5. Validate
    missing = [f for f in REQUIRED_FIELDS if result[f] is None]
    if missing:
        result["missing_fields"] = missing        # status stays 'unparsed'
        return result

    result["parse_status"] = "parsed"
    warnings = [f for f in OPTIONAL_FIELDS if result[f] is None]
    if warnings:
        result["warnings"] = warnings
    return result


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = BASE_DIR / "data" / "momo_sms.csv"
DEFAULT_PARSED = BASE_DIR / "data" / "parsed_transactions.json"
DEFAULT_UNPARSED = BASE_DIR / "data" / "unparsed_sms.csv"


def parse_file(
    input_file: Path = DEFAULT_INPUT,
    parsed_file: Path = DEFAULT_PARSED,
    unparsed_file: Path = DEFAULT_UNPARSED,
) -> dict:
    """Parse every message in the filtered CSV; write parsed JSON + unparsed CSV; return stats."""
    with open(input_file, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    results = [
        parse_message(r["raw_text"], r["sender"], r["received_at"], r.get("message_id", ""))
        for r in rows
    ]
    counts = Counter(r["parse_status"] for r in results)
    attempted = counts["parsed"] + counts["unparsed"]  # ignored messages don't count against you

    for r in results:
        if r["parse_status"] == "unparsed":
            missing = ",".join(r.get("missing_fields", [])) or "unknown format"
            log.warning("Unparsed %s (%s): %.100s", r["message_id"], missing, r["raw_text"])
        elif r["parse_status"] == "ignored":
            log.debug("Ignored %s as %s", r["message_id"], r["ignore_reason"])
        elif "warnings" in r:
            log.info("Parsed %s via %s without %s", r["message_id"], r["template"], ",".join(r["warnings"]))

    parsed = [r for r in results if r["parse_status"] == "parsed"]
    parsed_file.parent.mkdir(parents=True, exist_ok=True)
    with open(parsed_file, "w", encoding="utf-8") as f:
        json.dump(parsed, f, indent=2)

    unparsed = [r for r in results if r["parse_status"] == "unparsed"]
    with open(unparsed_file, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["message_id", "missing_fields", "raw_text"])
        for r in unparsed:
            w.writerow([r["message_id"], ",".join(r.get("missing_fields", [])), r["raw_text"]])

    stats = {
        "total": len(results),
        "parsed": counts["parsed"],
        "parsed_with_warnings": sum("warnings" in r for r in parsed),
        "ignored": counts["ignored"],
        "ignored_by_reason": dict(Counter(r["ignore_reason"] for r in results if r["parse_status"] == "ignored")),
        "unparsed": counts["unparsed"],
        "parse_success_rate": counts["parsed"] / attempted if attempted else None,
        "parsed_by_template": dict(Counter(r["template"] for r in parsed).most_common()),
        "parsed_file": str(parsed_file),
        "unparsed_file": str(unparsed_file),
    }
    log.info(
        "Parsed %d messages: %d parsed, %d ignored %s, %d unparsed (success rate %s)",
        stats["total"], stats["parsed"], stats["ignored"], stats["ignored_by_reason"], stats["unparsed"],
        f"{stats['parse_success_rate']:.1%}" if stats["parse_success_rate"] is not None else "n/a",
    )
    log.info("Parsed by template: %s", stats["parsed_by_template"])
    log.info("Wrote %s and %s", parsed_file, unparsed_file)
    return stats


def main() -> None:
    setup_logging()
    parse_file()


if __name__ == "__main__":
    main()
