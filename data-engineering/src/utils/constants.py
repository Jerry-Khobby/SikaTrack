import re

MOMO_KEYWORDS=[
    "mobile money",
    "momo",
    "mobilemoney",
    "mtn momo",
    "mtn mobile money",
    "vodafone cash",
    "telecel cash",
    "airteltigo money",
    "airtel money",
    "tigo cash",
    "cash out",
    "cashout",
    "you have received",
    "you have sent",
    "transaction",
    "new balance",
]


MOMO_SENDERS = {
    "MobileMoney",
    "GhanaPay"
}


SENDER_TO_PROVIDER = {
    "mobilemoney": "mtn_momo",
    # add more as you discover them, e.g. "t-cash": "airteltigo"
}

REQUIRED_FIELDS = ("amount", "counterparty")

# ---------------------------------------------------------
# Field patterns (case-insensitive)
# ---------------------------------------------------------
 
_MONEY = r"([\d,]+(?:\.\d+)?|-)"
 
# First GHS amount in the message is always the transaction amount.
_AMOUNT = re.compile(r"GHS\s?([\d,]+(?:\.\d+)?)", re.I)
 
# "Current Balance: GHS 43.99" / "Your new balance: GHS 97.23"
_BALANCE = re.compile(r"(?:current|new)\s+balance:?\s*GHS\s?([\d,]+(?:\.\d+)?)", re.I)
 
# "Fee was GHS 0.38" / "Fee charged: GHS0.50" / "TRANSACTION FEE: 0.00"
_FEE = re.compile(r"(?:fee\s+was|fee\s+charged:?|transaction\s+fee:?)\s*(?:GHS)?\s?" + _MONEY, re.I)
 
# "Tax was GHS -" / "Tax Charged 0" / "Tax charged: 0"
_TAX = re.compile(r"tax\s+(?:was|charged:?)\s*(?:GHS)?\s?" + _MONEY, re.I)
 
# "Reference: FOOD." / "Reference: -." (value runs until the next sentence label)
_REFERENCE = re.compile(r"reference:\s*(.*?)\s*\.\s*(?:financial|transaction|fee)", re.I)
 
# "Financial Transaction Id: 123" / "Transaction ID: 123" / "Transaction Id: 123"
_TXN_ID = re.compile(r"(?:financial\s+)?transaction\s+id:?\s*(\d+)", re.I)
 
# Counterparty sits between "from"/"to" and the balance (or "has been completed")
_FROM = re.compile(
    r"\bfrom\s+(.+?)\s*\.?\s*(?:current\s+balance|new\s+balance)", re.I
)
_TO = re.compile(
    r"\bto\s+(.+?)\s*\.?\s*(?:has\s+been\s+completed|current\s+balance|new\s+balance)", re.I
)
 
# Message kinds, anchored at the start of the message
_RECEIVED_START = re.compile(r"^(?:payment received|you have received)", re.I)
_SENT_START = re.compile(r"^(?:your payment of|payment (?:made )?for)", re.I)
_NON_TRANSACTION = re.compile(r"\botp\b|fraud alert|enter code", re.I)
 
# Counterparty keywords that indicate airtime/data rather than a person
_AIRTIME_WORDS = re.compile(r"airtime|bundle|\bdata\b", re.I)