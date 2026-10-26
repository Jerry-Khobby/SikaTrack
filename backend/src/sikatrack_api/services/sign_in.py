"""Phone-number sign-in: request a code, verify it, refresh tokens, sign out.

Security rules this module keeps:
- Requesting a code says nothing about whether the number has an account.
- Every way a code can be wrong (unknown, expired, used, too many tries, mismatch) gives the
  same `otp_invalid`, so attackers learn nothing from the error.
- Wrong guesses are committed before the error, so retries can't dodge the attempt limit.
- One session per device; each refresh rotates the token, and reusing an old one (it was
  copied) revokes the session.
"""

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from sikatrack_api import clock, ids
from sikatrack_api.auth import credentials
from sikatrack_api.auth.phone import InvalidPhoneNumber, mask, normalise_gh_mobile
from sikatrack_api.auth.sms import OtpDeliveryError, OtpSender
from sikatrack_api.config import Settings
from sikatrack_api.errors import AppError
from sikatrack_api.models import Device, OtpRequest, Session, User
from sikatrack_api.schemas.auth import OtpRequestOut, OtpVerifyIn, SignInOut, TokenPair
from sikatrack_api.schemas.common import version_tuple
from sikatrack_api.services import audit
from sikatrack_api.services.users import to_me

log = logging.getLogger(__name__)


def otp_invalid() -> AppError:
    return AppError(
        400, "otp_invalid", "The code is wrong or has expired", "Request a new code and try again."
    )


def refresh_invalid() -> AppError:
    return AppError(401, "refresh_invalid", "Please sign in again")


def rate_limited(retry_after_s: float) -> AppError:
    seconds = max(1, int(retry_after_s) + 1)
    return AppError(
        429, "rate_limited", "Too many requests", f"Try again in {seconds} seconds.",
        headers={"Retry-After": str(seconds)},
    )  # fmt: skip


def app_update_required(settings: Settings) -> AppError:
    return AppError(
        426, "app_update_required", "Please update SikaTrack", f"This version is no longer supported "
        f"(minimum {settings.min_app_version}).",
    )  # fmt: skip


def check_app_version(settings: Settings, app_version: str) -> None:
    if version_tuple(app_version) < version_tuple(settings.min_app_version):
        raise app_update_required(settings)


async def request_code(
    session: AsyncSession, settings: Settings, sender: OtpSender, phone_raw: str, ip: str | None
) -> OtpRequestOut:
    try:
        phone = normalise_gh_mobile(phone_raw)
    except InvalidPhoneNumber as exc:
        raise AppError(
            400,
            "validation_error",
            "The request is invalid",
            errors=[{"field": "phone_number", "message": str(exc)}],
        ) from None
    request_id = await issue_code(session, settings, sender, phone, ip)
    log.info("Sign-in code sent", extra={"phone": mask(phone), "otp_request_id": str(request_id)})
    return OtpRequestOut(
        otp_request_id=ids.encode("otp", request_id),
        expires_in=settings.otp_ttl_s,
        resend_after=settings.otp_resend_after_s,
    )


async def issue_code(
    session: AsyncSession,
    settings: Settings,
    sender: OtpSender,
    phone: str,
    ip: str | None,
    *,
    purpose: str = "sign_in",
    wallet_id: uuid.UUID | None = None,
) -> uuid.UUID:
    """Texts a new code to `phone` for `purpose`, within the rate limits. Sign-in and wallet
    codes share the limits, so neither can be used to flood a number with SMS."""
    now = clock.utcnow()

    # Limits per phone (stops SMS bombing a number) and per IP (stops sweeping many numbers)
    window_start = now - timedelta(seconds=settings.otp_phone_window_s)
    count, oldest, newest = (
        await session.execute(
            select(func.count(), func.min(OtpRequest.created_at), func.max(OtpRequest.created_at)).where(
                OtpRequest.phone_number == phone, OtpRequest.created_at > window_start
            )
        )
    ).one()
    if newest is not None and (wait := settings.otp_resend_after_s - (now - newest).total_seconds()) > 0:
        raise rate_limited(wait)
    if count >= settings.otp_max_per_phone:
        raise rate_limited(settings.otp_phone_window_s - (now - oldest).total_seconds())
    if ip is not None:
        per_ip = await session.scalar(
            select(func.count()).where(
                OtpRequest.requested_ip == ip, OtpRequest.created_at > now - timedelta(hours=1)
            )
        )
        if (per_ip or 0) >= settings.otp_max_per_ip:
            raise rate_limited(3600)

    request_id = uuid.uuid4()
    code = credentials.new_code()
    session.add(
        OtpRequest(
            id=request_id,
            phone_number=phone,
            code_hash=credentials.hash_code(settings, request_id, code),
            expires_at=now + timedelta(seconds=settings.otp_ttl_s),
            requested_ip=ip,
            purpose=purpose,
            wallet_id=wallet_id,
            created_at=now,
        )
    )
    await session.commit()  # recorded before sending, so the rate limits count it even if sending fails
    try:
        await sender.send(phone, code)
    except OtpDeliveryError:
        raise AppError(
            503, "dependency_unavailable", "We couldn't send your code", "Please try again in a minute."
        ) from None
    return request_id


async def use_code(
    session: AsyncSession, settings: Settings, otp: OtpRequest | None, code: str
) -> OtpRequest:
    """Checks `code` against `otp` (locked FOR UPDATE by the caller) and marks it used. Every
    way it can be wrong is the same `otp_invalid`; a wrong guess is committed before refusing."""
    if (
        otp is None
        or otp.consumed_at is not None
        or otp.expires_at <= clock.utcnow()
        or otp.attempts >= settings.otp_max_attempts
    ):
        raise otp_invalid()
    if not credentials.code_matches(settings, otp.id, code, otp.code_hash):
        otp.attempts += 1
        await session.commit()  # the failed attempt counts even though we refuse
        raise otp_invalid()
    otp.consumed_at = clock.utcnow()
    return otp


async def verify_code(session: AsyncSession, settings: Settings, body: OtpVerifyIn) -> SignInOut:
    check_app_version(settings, body.device.app_version)
    now = clock.utcnow()
    try:
        request_id = ids.decode("otp", body.otp_request_id)
    except AppError:
        raise otp_invalid() from None

    # FOR UPDATE: two verifies of the same code at once can't both succeed. Only sign-in codes:
    # a code texted to verify a wallet must not sign anyone in to that number's account.
    otp = await use_code(
        session,
        settings,
        await session.scalar(
            select(OtpRequest)
            .where(OtpRequest.id == request_id, OtpRequest.purpose == "sign_in")
            .with_for_update()
        ),
        body.code,
    )

    user = await session.scalar(select(User).where(User.phone_number == otp.phone_number).with_for_update())
    is_new_user = user is None
    if user is None:
        user = User(id=uuid.uuid4(), phone_number=otp.phone_number, settings={}, onboarding={})
        session.add(user)
        await session.flush()
        audit.record(session, "account_created", user.id)
    elif user.status == "deleting":
        user.status, user.delete_after = "active", None  # signing in again cancels a pending deletion
        audit.record(session, "account_deletion_cancelled", user.id)

    device = await _attach_device(session, user, body, now)
    tokens = await _start_session(session, settings, user.id, device.id, now)
    audit.record(session, "signed_in", user.id, device_id=str(device.id), new_user=is_new_user)
    await session.commit()
    await session.refresh(user)
    return SignInOut(**tokens.model_dump(), is_new_user=is_new_user, user=to_me(user))


async def _attach_device(session: AsyncSession, user: User, body: OtpVerifyIn, now: datetime) -> Device:
    info = body.device
    device = await session.get(Device, info.device_id, with_for_update=True)
    if device is None:
        device = Device(id=info.device_id, user_id=user.id, platform=info.platform)
        session.add(device)
    elif device.user_id != user.id:
        # A phone changing hands: the previous account loses this device and its push token
        await session.execute(
            update(Session)
            .where(Session.device_id == device.id, Session.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        device.user_id, device.push_token = user.id, None
    device.platform, device.app_version, device.model = info.platform, info.app_version, info.model
    device.last_seen_at = now
    await session.flush()
    return device


async def _start_session(
    session: AsyncSession, settings: Settings, user_id: uuid.UUID, device_id: uuid.UUID, now: datetime
) -> TokenPair:
    # One session per device: signing in again replaces the old one
    await session.execute(
        update(Session)
        .where(Session.device_id == device_id, Session.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    refresh = credentials.new_refresh_token()
    session_id = uuid.uuid4()
    started = clock.utcnow()
    session.add(
        Session(
            id=session_id,
            user_id=user_id,
            device_id=device_id,
            refresh_token_hash=credentials.hash_refresh_token(refresh),
            expires_at=started + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    return _pair(settings, user_id, session_id, refresh)


def _pair(settings: Settings, user_id: uuid.UUID, session_id: uuid.UUID, refresh: str) -> TokenPair:
    access = credentials.new_access_token(
        settings, credentials.AccessClaims(user_id, session_id), clock.utcnow()
    )
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=settings.access_token_ttl_s)


async def refresh_tokens(session: AsyncSession, settings: Settings, refresh_token: str) -> TokenPair:
    now = clock.utcnow()
    token_hash = credentials.hash_refresh_token(refresh_token)
    current = await session.scalar(
        select(Session).where(Session.refresh_token_hash == token_hash).with_for_update()
    )
    if current is None:
        reused = await session.scalar(
            select(Session).where(Session.previous_token_hash == token_hash).with_for_update()
        )
        if reused is not None and reused.revoked_at is None:
            # An old token came back after being rotated away: it was copied. End the session.
            reused.revoked_at = now
            audit.record(session, "refresh_token_reused", reused.user_id, session_id=str(reused.id))
            await session.commit()
            log.warning("Refresh token reuse: session revoked", extra={"session_id": str(reused.id)})
        raise refresh_invalid()

    user = await session.get(User, current.user_id)
    if current.revoked_at is not None or current.expires_at <= now or user is None or user.status != "active":
        raise refresh_invalid()

    new_token = credentials.new_refresh_token()
    current.previous_token_hash, current.refresh_token_hash = (
        token_hash,
        credentials.hash_refresh_token(new_token),
    )
    await session.commit()
    return _pair(settings, current.user_id, current.id, new_token)


async def sign_out(session: AsyncSession, refresh_token: str) -> None:
    """Always succeeds, so it can't be used to test whether a token is valid."""
    token_hash = credentials.hash_refresh_token(refresh_token)
    current = await session.scalar(select(Session).where(Session.refresh_token_hash == token_hash))
    if current is None or current.revoked_at is not None:
        return
    current.revoked_at = clock.utcnow()
    await session.execute(update(Device).where(Device.id == current.device_id).values(push_token=None))
    audit.record(session, "signed_out", current.user_id, session_id=str(current.id))
    await session.commit()
