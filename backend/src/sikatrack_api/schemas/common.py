"""Types shared by many schemas."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Any

from pydantic import BeforeValidator, Field, PlainSerializer, WithJsonSchema

TWO_PLACES = Decimal("0.01")


def _parse_money(value: Any) -> Any:
    # Floats can't hold 0.10 exactly; the contract sends money as strings, so refuse them
    if isinstance(value, float):
        raise ValueError('Send money as a string, e.g. "125.50"')
    return value


def _format_money(value: Decimal) -> str:
    return str(value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


Money = Annotated[
    Decimal,
    BeforeValidator(_parse_money),
    Field(max_digits=14, decimal_places=2),
    PlainSerializer(_format_money, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "pattern": r"^-?\d+\.\d{2}$", "examples": ["125.50"]}),
]
"""GHS amount: a decimal string with two places in JSON ("125.50"), a Decimal in Python."""


def to_pesewa(value: Decimal) -> Decimal:
    """Round a computed amount (an average, a projection) to two places, half up."""
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


AppVersion = Annotated[str, Field(pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}$", examples=["1.0.0"])]


def version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def _format_ratio(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


Ratio = Annotated[
    Decimal,
    PlainSerializer(_format_ratio, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "pattern": r"^-?\d+\.\d{3}$", "examples": ["-0.305"]}),
]
"""A fraction as a decimal string with three places ("0.412" = 41.2%)."""
