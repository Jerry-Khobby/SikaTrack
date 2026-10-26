"""/v1/wallets: the user's own mobile-money accounts."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep, SettingsDep
from sikatrack_api.auth.sms import OtpSender
from sikatrack_api.ratelimit import client_ip
from sikatrack_api.routers.auth import get_otp_sender
from sikatrack_api.schemas.ingestion import (
    WalletCodeOut,
    WalletIn,
    WalletList,
    WalletOut,
    WalletPatch,
    WalletVerifyIn,
)
from sikatrack_api.services import balances, wallets

router = APIRouter(prefix="/v1/wallets", tags=["wallets"])


@router.get("", summary="Your wallets")
async def list_wallets(me: CurrentUserDep, session: SessionDep) -> WalletList:
    latest = {b.wallet_id: b for b in (await balances.latest(session, me.id)).items if b.wallet_id}
    items = []
    for wallet in await wallets.list_wallets(session, me.id):
        out = wallets.to_out(wallet)
        if (balance := latest.get(out.id)) is not None:
            out.latest_balance, out.balance_as_of = balance.balance, balance.as_of
        items.append(out)
    return WalletList(items=items)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Add a wallet",
    description="Transfers between your wallets then count as your own money moving, not spending. "
    "A wallet on your sign-in number is verified at once; any other needs a code texted to it "
    "(`POST /v1/wallets/{id}/code`, then `/verify`).",
)
async def add_wallet(body: WalletIn, me: CurrentUserDep, session: SessionDep) -> WalletOut:
    return wallets.to_out(await wallets.add_wallet(session, me.user, body))


@router.post(
    "/{wallet_id}/code",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Text a code to the wallet's number",
    description="Proves you hold that SIM. Shares the sign-in code limits per number.",
)
async def send_wallet_code(
    wallet_id: str,
    request: Request,
    me: CurrentUserDep,
    session: SessionDep,
    settings: SettingsDep,
    sender: Annotated[OtpSender, Depends(get_otp_sender)],
) -> WalletCodeOut:
    wallet = await wallets.get_wallet(session, me.id, wallet_id)
    return await wallets.send_code(session, settings, sender, wallet, client_ip(request))


@router.post("/{wallet_id}/verify", summary="Check the code; the wallet then counts as yours")
async def verify_wallet(
    wallet_id: str, body: WalletVerifyIn, me: CurrentUserDep, session: SessionDep, settings: SettingsDep
) -> WalletOut:
    wallet = await wallets.get_wallet(session, me.id, wallet_id)
    return wallets.to_out(await wallets.verify(session, settings, me.user, wallet, body.code))


@router.patch("/{wallet_id}", summary="Rename a wallet or fix its account name")
async def patch_wallet(
    wallet_id: str, body: WalletPatch, me: CurrentUserDep, session: SessionDep
) -> WalletOut:
    wallet = await wallets.get_wallet(session, me.id, wallet_id)
    return wallets.to_out(await wallets.update_wallet(session, me.user, wallet, body))


@router.delete("/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove a wallet")
async def delete_wallet(wallet_id: str, me: CurrentUserDep, session: SessionDep) -> Response:
    wallet = await wallets.get_wallet(session, me.id, wallet_id)
    await wallets.remove_wallet(session, me.user, wallet)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
