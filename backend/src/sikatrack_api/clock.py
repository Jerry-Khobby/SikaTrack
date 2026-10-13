"""The current time, in one place, so tests can move it (monkeypatch `clock.utcnow`)."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)
