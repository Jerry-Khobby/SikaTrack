import re

MOMO_KEYWORDS = [
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
    "GhanaPay",
}

SENDER_TO_PROVIDER = {
    "mobilemoney": "mtn_momo",
    "ghanapay": "ghanapay",
    # add more as you discover them, e.g. "t-cash": "airteltigo"
}

# A message missing a REQUIRED field is 'unparsed' (goes to unparsed_sms.csv).
# A message missing an OPTIONAL field is still 'parsed', with a warning attached.
REQUIRED_FIELDS = ("amount",)
OPTIONAL_FIELDS = ("counterparty", "balance_after")

# ---------------------------------------------------------
# Field patterns (case-insensitive). Each one searches the WHOLE
# message, so it works no matter which template the message is.
# ---------------------------------------------------------

_MONEY = r"([\d,]+(?:\.\d+)?|-)"

# First GHS amount in the message is always the transaction amount.
_AMOUNT = re.compile(r"GHS\s?([\d,]+(?:\.\d+)?)", re.I)

# "Current Balance: GHS 43.99" | "Wallet Balance is: GHS 4.15" | "Balance: GHS 0.03"
# "Your new balance is GHS8.13" | "new balance:89.80 GHS"   (\b keeps "XtraBalance" out)
_BALANCE = re.compile(r"\bbalance(?:\s+is)?\s*:?\s*(?:GHS\s?)?([\d,]+(?:\.\d+)?)", re.I)

# "Fee was GHS 0.38" | "Fee charged: GHS0.50" | "TRANSACTION FEE: 0.00"
# "Transaction fees: 0.00" | "TRANSACTION FEE IS 0" | "Transaction fee is GHS0."
_FEE = re.compile(
    r"(?:fee\s+was|fee\s+charged:?|transaction\s+fees?(?:\s+is)?:?)\s*(?:GHS)?\s?" + _MONEY, re.I
)

# "Tax was GHS -" | "Tax Charged 0" | "E-Levy: 0.00"
_TAX = re.compile(r"(?:tax\s+(?:was|charged:?)|e-?levy:?)\s*(?:GHS)?\s?" + _MONEY, re.I)

# "Reference: FOOD." | "Ref: Food." | "Reference:TRANSFER FROM ... FOOD ."
_REFERENCE = re.compile(
    r"\bref(?:erence)?:\s*(.*?)\s*\.\s*(?:financial|transaction|fee|your)", re.I
)

# "Message from sender: laundry." | "Message from refunder: ..." | "Message:Interest for ..."
_REFERENCE_ALT = re.compile(
    r"\bmessage(?:\s+from\s+\w+)?:\s*(.*?)\s*\.\s*(?:your|fee|financial|current)", re.I
)

# "Financial Transaction Id: 123" | "Transaction ID: 123" | "with transaction ID: 123"
_TXN_ID = re.compile(r"(?:financial\s+)?transaction\s+id:?\s*(\d+)", re.I)

# Fallback when the ID is labelled as the reference: "Ref: 80578323679." | "Reference: 602712275575 at:"
_TXN_ID_ALT = re.compile(r"\bref(?:erence)?:\s*(\d{8,})", re.I)

# ---------------------------------------------------------
# Counterparty patterns (group 1 = the other party)
# ---------------------------------------------------------

# Where a name ends: balance, "has been completed/reversed", Ref/Reference, Transaction Id...
# (deliberately NOT a bare "." so names like "J. K. VENTURES" survive)
_STOP = (
    r"(?=\s*\.?\s*(?:"
    r"(?:current|new|wallet|available)\s+balance|balance\s*:|"
    r"has\s+been\s+(?:completed|reversed)|"
    r"ref(?:erence)?\b|transaction\s+id|financial\s+transaction|fee\s+charged|"
    r"on\s+your\s+mobile\s+money\s+account"
    r"))"
)

_FROM = re.compile(r"\bfrom\s+(.+?)" + _STOP, re.I)
_TO = re.compile(r"\bto\s+(.+?)" + _STOP, re.I)

# "You have Paid GHS 47.5 to Merchant 223691 on your mobile money account"
_TO_MERCHANT = re.compile(r"\bto\s+(.+?)\s+on\s+your\s+mobile\s+money\s+account", re.I)

# "...transferred GHS 10.00 to CalBank PLC account number 0009536789******789."
_TO_BANK = re.compile(r"\bto\s+(.+?)\s+account\s+number", re.I)

# "...transferred GHS 144.00 to 0241154464 on MTN MOBILE MONEY. Reference: Tithes."
_TO_BEFORE_REF = re.compile(r"\bto\s+(.+?)\s*\.\s*(?:reference|ref)\b", re.I)

# "...received GHS 2.00 from: 1400****789, CalBank PLC. Reference:..."
_FROM_BANK = re.compile(r"\bfrom:\s*(?:[\d*]+,\s*)?(.+?)\s*\.\s*(?:reference|ref)\b", re.I)

# "purchased GHS 14.00 from: TELECEL Airtime. Transaction ID" | "...from MTNVENDOR on 2026-05-03.Ref:"
_FROM_PURCHASE = re.compile(
    r"\bfrom:?\s*(.+?)(?=\s*\.\s*(?:transaction|ref|balance)|\s+on\s+\d)", re.I
)

# "Hello, Other Networks (one4all.sp) has successfully refunded GHS 5.00..."
_REFUNDER = re.compile(
    r"^hello,\s*(.+?)(?:\s*\([^)]*\))?\s+has\s+successfully\s+refunded", re.I
)

# "the transfer of GHS 3.00 to MTN BUNDLE has been reversed on ..."
_REVERSED_TO = re.compile(r"\bto\s+(.+?)\s+has\s+been\s+reversed", re.I)

# ---------------------------------------------------------
# Message kinds. TO SUPPORT A NEW FORMAT: ADD ONE ROW HERE.
#   start         regex the message begins with
#   direction     credit | debit
#   type          transaction_type, or None to infer (airtime vs transfer)
#   counterparty  regex with the name in group 1, OR a fixed string, OR None
# Rows are tried in order; first match wins, so put specific rows first.
# ---------------------------------------------------------

TEMPLATES = [
    # --- money in -------------------------------------------------------
    {"name": "payment_received",
     "start": re.compile(r"^(?:payment received|you have received|you received|received|money received)", re.I),
     "direction": "credit", "type": "transfer", "counterparty": _FROM},

    {"name": "cash_in",
     "start": re.compile(r"^cash\s*in\s+(?:received|successful|completed)", re.I),
     "direction": "credit", "type": "cashin", "counterparty": _FROM},

    {"name": "bank_transfer_in",
     "start": re.compile(r"^hello\s+[^,]+,\s*you\s+have\s+received", re.I),
     "direction": "credit", "type": "bank_transfer", "counterparty": _FROM_BANK},

    {"name": "interest_credit",
     "start": re.compile(
         r"^an\s+amount\s+of\s+ghs\s*[\d,.]+\s+has\s+been\s+credited.*?(?:message|ref(?:erence)?):\s*interest", re.I),
     "direction": "credit", "type": "interest", "counterparty": "Wallet interest"},

    {"name": "account_credited",
     "start": re.compile(r"^an\s+amount\s+of\s+ghs\s*[\d,.]+\s+has\s+been\s+credited", re.I),
     "direction": "credit", "type": "other", "counterparty": None},

    {"name": "refund",
     "start": re.compile(r"^hello,\s*.+?\s+has\s+successfully\s+refunded", re.I),
     "direction": "credit", "type": "refund", "counterparty": _REFUNDER},

    {"name": "reversal",
     "start": re.compile(r"^y\W?ello\s+valued\s+customer,\s*the\s+transfer\s+of\b.*\bhas\s+been\s+reversed", re.I),
     "direction": "credit", "type": "reversal", "counterparty": _REVERSED_TO},

    # --- money out ------------------------------------------------------
    {"name": "cash_out",
     "start": re.compile(r"^cash\s*out\s+(?:made|successful|completed)", re.I),
     "direction": "debit", "type": "cashout", "counterparty": _TO},

    {"name": "merchant_payment",
     "start": re.compile(r"^(?:y\W?ello\W*)?you\s+have\s+paid", re.I),
     "direction": "debit", "type": "merchant", "counterparty": _TO_MERCHANT},

    {"name": "bank_transfer_out",
     "start": re.compile(r"^hello\s+[^,]+,\s*you\s+have\s+transferred\b.*\baccount\s+number", re.I),
     "direction": "debit", "type": "bank_transfer", "counterparty": _TO_BANK},

    {"name": "ghanapay_wallet_transfer_out",
     "start": re.compile(r"^hello\s+[^,]+,\s*you\s+have\s+transferred", re.I),
     "direction": "debit", "type": "transfer", "counterparty": _TO_BEFORE_REF},

    {"name": "airtime_topup",
     "start": re.compile(r"^hello\s+[^,]+,\s*you\s+have\s+performed\s+a\s+top\s*up\s+purchase", re.I),
     "direction": "debit", "type": "airtime", "counterparty": _FROM_PURCHASE},

    {"name": "wallet_transfer_out",
     "start": re.compile(r"^you\s+have\s+transferred", re.I),
     "direction": "debit", "type": "transfer", "counterparty": _TO},

    {"name": "airtime_purchase",
     "start": re.compile(r"^you\s+have\s+(?:successfully\s+)?purchased", re.I),
     "direction": "debit", "type": "airtime", "counterparty": _FROM_PURCHASE},

    {"name": "savings_transfer",
     "start": re.compile(r"^your\s+instruction\s+to\s+transfer\b.*\bhonou?red", re.I),
     "direction": "debit", "type": "savings", "counterparty": "Savings wallet"},

    {"name": "payment_sent",
     "start": re.compile(
         r"^(?:your\s+payment\s+of|payment\s+(?:made\s+)?for|you\s+sent|money\s+sent|transfer\s+to)", re.I),
     "direction": "debit", "type": None, "counterparty": _TO},   # type None -> airtime vs transfer
]

# ---------------------------------------------------------
# Messages that are not transactions (kept out of the success rate)
# ---------------------------------------------------------

# Checked FIRST, for safety: these contain login codes.
_OTP = re.compile(r"\botp\b|fraud alert|enter code|one\s+time\s+password", re.I)

# Marketing text.
_PROMO = re.compile(
    r"download momoapp now|enjoy zero fees|switch to momoapp|free \d+\s?mb|\d+\s?mb free|"
    r"free cash|momo loan|receive money from abroad|claim your (?:reward|bonus)|dial \*170#|t&?cs?\s+apply",
    re.I,
)

# Announcements / general customer messages ("Y'ello Valued Customer, ...", "Dear Customer, ...")
_CUSTOMER_MESSAGE = re.compile(r"^(?:y\W?ello\b|dear\s+customer)", re.I)

# Tried in order, ONLY if no transaction template matched AND the message has no balance
# (anything that mentions a balance might be a real transaction: don't hide it).
IGNORE_RULES = [("promo", _PROMO), ("customer_message", _CUSTOMER_MESSAGE)]

# Counterparty keywords that indicate airtime/data rather than a person
_AIRTIME_WORDS = re.compile(r"airtime|bundle|\bdata\b", re.I)