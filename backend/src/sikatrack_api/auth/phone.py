"""Ghanaian mobile numbers, normalised to E.164 (+233XXXXXXXXX) before they're stored or compared."""

import re

# Mobile network prefixes (the digits after the leading 0): MTN, Telecel, AirtelTigo, ...
GH_MOBILE_PREFIXES = frozenset(
    {"20", "23", "24", "25", "26", "27", "28", "50", "53", "54", "55", "56", "57", "59"}
)

_SEPARATORS = re.compile(r"[\s().-]")


class InvalidPhoneNumber(ValueError):
    pass


def normalise_gh_mobile(raw: str) -> str:
    """'024 123 4567', '0241234567', '233241234567', '+233 24 123 4567' -> '+233241234567'."""
    digits = _SEPARATORS.sub("", raw.strip())
    if digits.startswith("+"):
        digits = digits[1:]
    if not digits.isdigit():
        raise InvalidPhoneNumber("Use digits only, e.g. 024 123 4567")
    if digits.startswith("233"):
        national = digits[3:]
    elif digits.startswith("0"):
        national = digits[1:]
    else:
        raise InvalidPhoneNumber("Start with 0 or +233, e.g. 024 123 4567")
    if len(national) != 9 or national[:2] not in GH_MOBILE_PREFIXES:
        raise InvalidPhoneNumber("Enter a Ghanaian mobile number, e.g. 024 123 4567")
    return "+233" + national


def mask(phone_e164: str) -> str:
    """+233241234567 -> +23324*****67, for logs and messages."""
    return phone_e164[:6] + "*" * (len(phone_e164) - 8) + phone_e164[-2:]
