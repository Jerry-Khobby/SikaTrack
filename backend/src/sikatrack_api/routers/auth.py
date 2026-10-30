"""/v1/auth: sign in with a phone number and a one-time code. No access token needed."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from sikatrack_api.auth.dependencies import SessionDep, SettingsDep
from sikatrack_api.auth.sms import OtpSender
from sikatrack_api.ratelimit import client_ip, limit_public
from sikatrack_api.schemas.auth import (
    GoogleSignInIn,
    OtpRequestIn,
    OtpRequestOut,
    OtpVerifyIn,
    RefreshIn,
    SignInOut,
    TokenPair,
)
from sikatrack_api.services import sign_in

router = APIRouter(prefix="/v1/auth", tags=["auth"], dependencies=[Depends(limit_public)])


def get_otp_sender(request: Request) -> OtpSender:
    sender: OtpSender = request.app.state.otp_sender
    return sender


@router.post(
    "/otp/request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Send a sign-in code by SMS",
    description="The same answer whether or not the number has an account.",
)
async def request_otp(
    body: OtpRequestIn,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    sender: Annotated[OtpSender, Depends(get_otp_sender)],
) -> OtpRequestOut:
    return await sign_in.request_code(session, settings, sender, body.phone_number, client_ip(request))


@router.post("/otp/verify", summary="Check the code; sign in (creating the account the first time)")
async def verify_otp(body: OtpVerifyIn, session: SessionDep, settings: SettingsDep) -> SignInOut:
    return await sign_in.verify_code(session, settings, body)


@router.post(
    "/google",
    summary="Sign in with a Google ID token (creating the account the first time)",
    description="The app signs in with Google on the phone and sends the ID token Google gave it. "
    "Available when GOOGLE_CLIENT_IDS is set (see `sign_in_methods` in /v1/config).",
)
async def google_sign_in(body: GoogleSignInIn, session: SessionDep, settings: SettingsDep) -> SignInOut:
    return await sign_in.sign_in_with_google(session, settings, body)


@router.post("/refresh", summary="Swap a refresh token for new tokens (the old one stops working)")
async def refresh(body: RefreshIn, session: SessionDep, settings: SettingsDep) -> TokenPair:
    return await sign_in.refresh_tokens(session, settings, body.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="End this device's session")
async def logout(body: RefreshIn, session: SessionDep) -> Response:
    await sign_in.sign_out(session, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
