"""`CurrentUserDep`: the one place every protected endpoint learns who is calling.

The access token proves who signed in; the database check proves the session is still live,
so signing out or deleting an account takes effect at once, not when the token expires.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import clock
from sikatrack_api.auth import credentials
from sikatrack_api.config import Settings
from sikatrack_api.db import get_session
from sikatrack_api.dependencies import get_settings_from_app
from sikatrack_api.errors import AppError
from sikatrack_api.models import Session, User
from sikatrack_api.ratelimit import limit_user

_bearer = HTTPBearer(auto_error=False, description="The access token from /v1/auth/otp/verify")


def unauthenticated() -> AppError:
    return AppError(
        401,
        "unauthenticated",
        "Sign in to continue",
        headers={"WWW-Authenticate": 'Bearer realm="sikatrack"'},
    )


@dataclass(frozen=True)
class CurrentUser:
    user: User
    session_id: uuid.UUID
    device_id: uuid.UUID

    @property
    def id(self) -> uuid.UUID:
        return self.user.id


async def get_current_user(
    request: Request,
    token: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings_from_app)],
) -> CurrentUser:
    if token is None:
        raise unauthenticated()
    try:
        claims = credentials.read_access_token(settings, token.credentials, clock.utcnow())
    except jwt.InvalidTokenError:
        raise unauthenticated() from None

    row = (
        await session.execute(
            select(User, Session.device_id)
            .join(Session, Session.user_id == User.id)
            .where(
                Session.id == claims.session_id,
                Session.user_id == claims.user_id,
                Session.revoked_at.is_(None),
                Session.expires_at > clock.utcnow(),
                User.status == "active",
            )
        )
    ).first()
    if row is None:
        raise unauthenticated()
    user, device_id = row
    request.state.user_id = user.id  # for the access log
    await limit_user(request, str(user.id))
    return CurrentUser(user=user, session_id=claims.session_id, device_id=device_id)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings_from_app)]
