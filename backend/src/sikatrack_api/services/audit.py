"""The audit log: security-relevant events, with IDs and counts only (never codes, tokens or SMS)."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api.models import AuditEvent


def record(session: AsyncSession, action: str, user_id: uuid.UUID | None, **detail: Any) -> None:
    """Added to the caller's transaction: it's kept exactly when the change it describes is."""
    session.add(AuditEvent(action=action, user_id=user_id, detail=detail))
