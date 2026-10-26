"""The user's own mobile-money accounts.

A wallet counts as the user's own (for telling own transfers from spending) only once they've
proved they hold its number: at once for their sign-in number, otherwise with a code texted to
the wallet's number. The account name can't be checked (MoMo SMS never show the owner's name);
holding the SIM is what's verified.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from src.transform.config import Owner
from src.utils.constants import SENDER_TO_PROVIDER

from sikatrack_api import clock, ids
from sikatrack_api.auth.phone import InvalidPhoneNumber, mask, normalise_gh_mobile
from sikatrack_api.auth.sms import OtpSender
from sikatrack_api.config import Settings
from sikatrack_api.errors import AppError
from sikatrack_api.models import OtpRequest, User, Wallet
from sikatrack_api.schemas.ingestion import WalletCodeOut, WalletIn, WalletOut, WalletPatch
from sikatrack_api.services import pipeline, sign_in

log = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = frozenset(SENDER_TO_PROVIDER.values())


def _clean_name(name: str | None) -> str | None:
    """As the pipeline compares names: whitespace collapsed, upper case."""
    return " ".join(name.split()).upper() or None if name else None


def to_out(wallet: Wallet) -> WalletOut:
    return WalletOut(
        id=ids.encode("wal", wallet.id),
        provider=wallet.provider_code,
        phone_number=wallet.phone_number,
        account_name=wallet.account_name,
        label=wallet.label,
        verified=wallet.verified_at is not None,
        created_at=wallet.created_at,
    )


async def owner_of(session: AsyncSession, user_id: uuid.UUID) -> Owner:
    """The user's own names and numbers, in the pipeline's format (numbers as 0XXXXXXXXX).
    Verified wallets only: an unproved number mustn't turn someone else's payments into own transfers."""
    query = select(Wallet).where(Wallet.user_id == user_id, Wallet.verified_at.is_not(None))
    rows = (await session.execute(query)).scalars().all()
    return Owner(
        names=frozenset(w.account_name for w in rows if w.account_name),
        numbers=frozenset("0" + w.phone_number.removeprefix("+233") for w in rows),
    )


async def list_wallets(session: AsyncSession, user_id: uuid.UUID) -> list[Wallet]:
    query = select(Wallet).where(Wallet.user_id == user_id).order_by(Wallet.created_at)
    return list((await session.execute(query)).scalars())


async def get_wallet(session: AsyncSession, user_id: uuid.UUID, public_id: str) -> Wallet:
    wallet = await session.get(Wallet, ids.decode("wal", public_id))
    if wallet is None or wallet.user_id != user_id:
        raise ids.not_found()
    return wallet


async def add_wallet(session: AsyncSession, user: User, body: WalletIn) -> Wallet:
    if body.provider not in SUPPORTED_PROVIDERS:
        raise AppError(
            422, "unsupported_provider", "We can't read this provider's SMS yet",
            f"Supported: {', '.join(sorted(SUPPORTED_PROVIDERS))}.",
        )  # fmt: skip
    try:
        phone = normalise_gh_mobile(body.phone_number)
    except InvalidPhoneNumber as exc:
        raise AppError(
            400, "validation_error", "The request is invalid",
            errors=[{"field": "phone_number", "message": str(exc)}],
        ) from None  # fmt: skip
    wallet = Wallet(
        user_id=user.id,
        provider_code=body.provider,
        phone_number=phone,
        account_name=_clean_name(body.account_name),
        label=body.label,
        # Signing in already proved the user holds their own number; any other needs a code
        verified_at=clock.utcnow() if phone == user.phone_number else None,
    )
    session.add(wallet)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise AppError(409, "conflict", "This wallet is already on your account") from None
    if wallet.verified_at is not None:
        _now_verified(user)
    await session.commit()
    await session.refresh(wallet)
    return wallet


def _now_verified(user: User) -> None:
    user.onboarding = {**user.onboarding, "wallets_added": True}
    pipeline.mark_due(user)  # which transfers are "your own" changed: reprocess


def already_verified() -> AppError:
    return AppError(409, "conflict", "This wallet is already verified")


async def send_code(
    session: AsyncSession, settings: Settings, sender: OtpSender, wallet: Wallet, ip: str | None
) -> WalletCodeOut:
    """Texts a code to the wallet's number. A new one replaces any before it."""
    if wallet.verified_at is not None:
        raise already_verified()
    request_id = await sign_in.issue_code(
        session, settings, sender, wallet.phone_number, ip, purpose="wallet", wallet_id=wallet.id
    )
    log.info(
        "Wallet code sent", extra={"phone": mask(wallet.phone_number), "otp_request_id": str(request_id)}
    )
    return WalletCodeOut(expires_in=settings.otp_ttl_s, resend_after=settings.otp_resend_after_s)


async def verify(session: AsyncSession, settings: Settings, user: User, wallet: Wallet, code: str) -> Wallet:
    """Checks the latest code sent for this wallet; on a match the wallet is the user's own."""
    if wallet.verified_at is not None:
        raise already_verified()
    otp = await session.scalar(
        select(OtpRequest)
        .where(OtpRequest.wallet_id == wallet.id, OtpRequest.purpose == "wallet")
        .order_by(OtpRequest.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    await sign_in.use_code(session, settings, otp, code)
    wallet.verified_at = clock.utcnow()
    _now_verified(user)
    await session.commit()
    return wallet


async def update_wallet(session: AsyncSession, user: User, wallet: Wallet, patch: WalletPatch) -> Wallet:
    if "account_name" in patch.model_fields_set:
        wallet.account_name = _clean_name(patch.account_name)
        if wallet.verified_at is not None:
            pipeline.mark_due(user)
    if "label" in patch.model_fields_set:
        wallet.label = patch.label
    await session.commit()
    return wallet


async def remove_wallet(session: AsyncSession, user: User, wallet: Wallet) -> None:
    """The wallet's transactions stay; they're just no longer treated as your own transfers."""
    await session.delete(wallet)
    if wallet.verified_at is not None:
        pipeline.mark_due(user)
    await session.commit()
