"""/v1/wallets: the user's own mobile-money accounts."""

from fastapi import APIRouter, Response, status

from sikatrack_api.auth.dependencies import CurrentUserDep, SessionDep
from sikatrack_api.schemas.ingestion import WalletIn, WalletList, WalletOut, WalletPatch
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
    description="Transfers between your wallets then count as your own money moving, not spending.",
)
async def add_wallet(body: WalletIn, me: CurrentUserDep, session: SessionDep) -> WalletOut:
    return wallets.to_out(await wallets.add_wallet(session, me.user, body))


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
