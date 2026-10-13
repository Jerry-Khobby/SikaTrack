"""The instant view: one SMS parsed on upload, with the pipeline's own code.

It makes the decisions that need only the SMS itself: parse, clean the counterparty, spot
transfers between the user's own wallets, categorise. What needs the user's history (merging
duplicate SMS, balance checks, recurring detection) is left to the pipeline, whose result
replaces this one.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from src.extraction.momo_parser import parse_message  # the pipeline's parser
from src.transform.categorise import categorise_row
from src.transform.config import Owner
from src.transform.counterparty import classify, split_name
from src.transform.enrich import is_self_reference


@dataclass(frozen=True)
class ParsedSms:
    parse_status: str  # parsed | unparsed | ignored
    occurred_at: datetime
    transaction_nk: str
    provider_code: str | None = None
    template: str | None = None
    transaction_type: str | None = None
    direction: str | None = None
    amount: Decimal | None = None
    fee: Decimal | None = None
    tax: Decimal | None = None
    balance_after: Decimal | None = None
    counterparty: str | None = None
    counterparty_kind: str | None = None
    reference: str | None = None
    is_own_transfer: bool = False
    category_name: str | None = None
    category_rule: str | None = None


def _money(value: float | None) -> Decimal | None:
    # The parser returns floats; money is stored exactly, to the pesewa
    return None if value is None else Decimal(str(value)).quantize(Decimal("0.01"))


def natural_key(provider: str | None, transaction_id: str | None, message_id: str) -> str:
    """Same formula as the pipeline (src/transform/enrich.py add_natural_key)."""
    return f"{provider}:{transaction_id or 'msg:' + message_id}"


def parse_sms(sender: str, date_ms: str, body: str, message_id: str, owner: Owner) -> ParsedSms:
    occurred_at = datetime.fromtimestamp(int(date_ms) / 1000, UTC)
    parsed = parse_message(body, sender, occurred_at.isoformat(), message_id)
    nk = natural_key(parsed["provider"], parsed["transaction_id"], message_id)
    if parsed["parse_status"] != "parsed":
        return ParsedSms(parse_status=parsed["parse_status"], occurred_at=occurred_at, transaction_nk=nk)

    name, phone = split_name(parsed["counterparty"])
    kind = classify(name, phone, parsed["template"], owner)
    own = kind == "own_wallet" or is_self_reference(parsed["reference"])
    category, rule = categorise_row(
        {
            "is_internal_transfer": own,
            "direction": parsed["direction"],
            "transaction_type": parsed["transaction_type"],
            "reference": parsed["reference"],
            "counterparty": name,
            "counterparty_kind": kind,
        }
    )
    return ParsedSms(
        parse_status="parsed",
        occurred_at=occurred_at,
        transaction_nk=nk,
        provider_code=parsed["provider"],
        template=parsed["template"],
        transaction_type=parsed["transaction_type"],
        direction=parsed["direction"],
        amount=_money(parsed["amount"]),
        fee=_money(parsed["fee"]) or Decimal("0.00"),
        tax=_money(parsed["tax"]) or Decimal("0.00"),
        balance_after=_money(parsed["balance_after"]),
        counterparty=name,
        counterparty_kind=kind,
        reference=(parsed["reference"] or None) and parsed["reference"][:255],
        is_own_transfer=own,
        category_name=category,
        category_rule=rule,
    )
