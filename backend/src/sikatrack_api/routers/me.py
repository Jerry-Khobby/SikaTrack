"""/v1/me: the signed-in user's own account."""

from fastapi import APIRouter, status

from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep, SettingsDep
from sikatrack_api.schemas.me import DeletionOut, MeOut, MePatch
from sikatrack_api.services import users

router = APIRouter(prefix="/v1/me", tags=["me"])


@router.get("", summary="Your profile, settings and data summary")
async def get_me(me: CurrentUserDep, session: SessionDep) -> MeOut:
    return users.to_me(me.user, await users.data_summary(session, me.id))


@router.patch("", summary="Change your name, settings or onboarding state (only the fields you send)")
async def patch_me(body: MePatch, me: CurrentUserDep, session: SessionDep) -> MeOut:
    user = await users.update_me(session, me.user, body)
    return users.to_me(user, await users.data_summary(session, me.id))


@router.delete(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete your account",
    description="Signs out every device now. Your data is deleted after the grace period; "
    "signing in again before then cancels the deletion.",
)
async def delete_me(me: CurrentUserDep, session: SessionDep, settings: SettingsDep) -> DeletionOut:
    return await users.schedule_deletion(session, settings, me.user)
