"""Public IDs: a type prefix plus the database UUID (usr_3f2a...). The app treats them as opaque.

An ID that doesn't parse is the same as one that doesn't exist: callers get 404, never 400,
so IDs can't be probed for their format.
"""

import uuid

from sikatrack_api.errors import AppError


def encode(prefix: str, value: uuid.UUID) -> str:
    return f"{prefix}_{value.hex}"


def decode(prefix: str, public_id: str) -> uuid.UUID:
    head, _, tail = public_id.partition("_")
    try:
        if head != prefix:
            raise ValueError(public_id)
        return uuid.UUID(hex=tail)
    except ValueError:
        raise not_found() from None


def not_found() -> AppError:
    return AppError(404, "not_found", "Not found")
