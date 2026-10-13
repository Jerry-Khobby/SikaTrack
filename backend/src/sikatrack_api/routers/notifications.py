"""/v1/notifications: the in-app inbox. Push notifications land here too."""

import base64
import uuid
from datetime import datetime
from typing import Literal, cast

from fastapi import APIRouter, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func, select, tuple_, update

from sikatrack_api import clock, ids
from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep
from sikatrack_api.models import Notification
from sikatrack_api.services.warehouse import bad_request

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

Kind = Literal[
    "budget_warning", "budget_over", "low_balance", "new_recurring", "recurring_still_charging",
    "weekly_digest", "data_ready", "sync_problem",
]  # fmt: skip


class NotificationOut(BaseModel):
    id: str
    kind: Kind
    title: str
    body: str
    link: str | None
    created_at: datetime
    read_at: datetime | None


class NotificationPage(BaseModel):
    unread: int
    items: list[NotificationOut]
    next_cursor: str | None


def _cursor(n: Notification) -> str:
    return base64.urlsafe_b64encode(f"{n.created_at.isoformat()}|{n.id}".encode()).decode().rstrip("=")


@router.get("", summary="Your notifications, newest first")
async def list_notifications(
    me: CurrentUserDep,
    session: SessionDep,
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    cursor: str | None = None,
) -> NotificationPage:
    query = select(Notification).where(Notification.user_id == me.id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    if cursor:
        try:
            at, nid = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode().split("|")
            after = tuple_(datetime.fromisoformat(at), uuid.UUID(nid))
            query = query.where(tuple_(Notification.created_at, Notification.id) < after)
        except (ValueError, TypeError):
            raise bad_request("cursor", "Not a cursor from this API") from None
    rows = (
        (
            await session.execute(
                query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1)
            )
        )
        .scalars()
        .all()
    )
    unread = await session.scalar(
        select(func.count()).where(Notification.user_id == me.id, Notification.read_at.is_(None))
    )
    return NotificationPage(
        unread=unread or 0,
        items=[
            NotificationOut(
                id=ids.encode("ntf", n.id),
                kind=cast(Kind, n.kind),
                title=n.title,
                body=n.body,
                link=n.link,
                created_at=n.created_at,
                read_at=n.read_at,
            )
            for n in rows[:limit]
        ],
        next_cursor=_cursor(rows[limit - 1]) if len(rows) > limit else None,
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT, summary="Mark one as read")
async def mark_read(notification_id: str, me: CurrentUserDep, session: SessionDep) -> Response:
    notification = await session.get(Notification, ids.decode("ntf", notification_id))
    if notification is None or notification.user_id != me.id:
        raise ids.not_found()
    notification.read_at = notification.read_at or clock.utcnow()
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all as read")
async def mark_all_read(me: CurrentUserDep, session: SessionDep) -> Response:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == me.id, Notification.read_at.is_(None))
        .values(read_at=clock.utcnow())
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
