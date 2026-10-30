"""The signed-in user's own account: read, change, delete."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import clock, ids
from sikatrack_api.config import Settings
from sikatrack_api.models import Device, Session, User
from sikatrack_api.schemas.me import DataSummary, DeletionOut, MeOut, MePatch, Onboarding, UserSettings
from sikatrack_api.services import audit
from sikatrack_api.services.warehouse import scope


def to_me(user: User, data: DataSummary | None = None) -> MeOut:
    # Stored JSON only holds what the user changed; the models fill in the defaults
    return MeOut(
        id=ids.encode("usr", user.id),
        phone_number=user.phone_number,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        onboarding=Onboarding.model_validate(user.onboarding),
        settings=UserSettings.model_validate(user.settings),
        data=data or DataSummary(),
    )


async def data_summary(session: AsyncSession, user_id: uuid.UUID) -> DataSummary:
    """The user's confirmed data in the warehouse: first and last transaction, and how many."""
    await scope(session, user_id)
    first, last, count = (
        await session.execute(
            text("SELECT min(occurred_at), max(occurred_at), count(*) FROM api.transaction")
        )
    ).one()
    return DataSummary(first_transaction_at=first, last_transaction_at=last, transactions=count)


def _merge(stored: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    merged = dict(stored)
    for key, value in changes.items():
        merged[key] = _merge(merged.get(key, {}), value) if isinstance(value, dict) else value
    return merged


async def update_me(session: AsyncSession, user: User, patch: MePatch) -> User:
    if "display_name" in patch.model_fields_set:
        user.display_name = patch.display_name
    # mode="json" stores money as "5.00"; exclude_unset keeps fields the app didn't send
    if patch.settings is not None:
        user.settings = _merge(user.settings, patch.settings.model_dump(mode="json", exclude_unset=True))
    if patch.onboarding is not None:
        user.onboarding = _merge(
            user.onboarding, patch.onboarding.model_dump(mode="json", exclude_unset=True)
        )
    await session.commit()
    await session.refresh(user)
    return user


async def schedule_deletion(session: AsyncSession, settings: Settings, user: User) -> DeletionOut:
    """Signs out every device now and hides the account; the data is purged after the grace
    period unless the user signs in again (which cancels it)."""
    now = clock.utcnow()
    user.status = "deleting"
    user.delete_after = now + timedelta(days=settings.account_deletion_grace_days)
    await session.execute(
        update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now)
    )
    await session.execute(update(Device).where(Device.user_id == user.id).values(push_token=None))
    audit.record(session, "account_deletion_scheduled", user.id, delete_after=user.delete_after.isoformat())
    await session.commit()
    return DeletionOut(deletion_scheduled_for=user.delete_after)
