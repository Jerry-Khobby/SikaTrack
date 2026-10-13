"""Sending sign-in codes. The provider is chosen by OTP_PROVIDER; a real SMS provider plugs in
here as another OtpSender without touching the sign-in logic."""

import logging
import sys
from typing import Protocol

import httpx2

from sikatrack_api.auth.phone import mask
from sikatrack_api.config import Settings

log = logging.getLogger(__name__)


class OtpSender(Protocol):
    async def send(self, phone_e164: str, code: str) -> None:
        """Deliver the code, or raise OtpDeliveryError."""
        ...


class OtpDeliveryError(Exception):
    """The provider didn't accept the message (down, out of credit, number refused)."""


class ConsoleOtpSender:
    """Development only (refused in production by Settings): prints the code to the API's
    terminal instead of sending an SMS. Writes to stderr directly, never to the logs."""

    async def send(self, phone_e164: str, code: str) -> None:
        print(f"[DEV ONLY] sign-in code for {mask(phone_e164)}: {code}", file=sys.stderr, flush=True)


class DisabledOtpSender:
    """Sign-in switched off (e.g. during maintenance): codes are created but never sent."""

    async def send(self, phone_e164: str, code: str) -> None:
        log.warning("OTP sending is disabled; code not sent", extra={"phone": mask(phone_e164)})


class TwilioOtpSender:
    """Twilio's Messages API: one POST per code, Basic auth with the account SID and auth token."""

    API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

    def __init__(self, settings: Settings) -> None:
        assert settings.twilio_account_sid  # Settings refuses to start without them
        assert settings.twilio_auth_token
        self.url = self.API.format(sid=settings.twilio_account_sid)
        self.auth = (settings.twilio_account_sid, settings.twilio_auth_token.get_secret_value())
        self.sender = (
            {"MessagingServiceSid": settings.twilio_messaging_service_sid}
            if settings.twilio_messaging_service_sid
            else {"From": settings.twilio_from or ""}
        )
        self.template = settings.otp_message

    async def send(self, phone_e164: str, code: str) -> None:
        form = {"To": phone_e164, "Body": self.template.format(code=code), **self.sender}
        try:
            async with httpx2.AsyncClient(timeout=10) as client:
                response = await client.post(self.url, data=form, auth=self.auth)
        except httpx2.HTTPError as exc:
            raise OtpDeliveryError(type(exc).__name__) from exc
        if response.status_code >= 400:
            # Twilio's error code says why (e.g. 21211 invalid number, 21408 region not enabled);
            # logged without the number or the code
            error = (
                response.json().get("code")
                if response.headers.get("content-type", "").startswith("application/json")
                else None
            )
            log.warning(
                "Twilio refused a sign-in SMS", extra={"status": response.status_code, "twilio_error": error}
            )
            raise OtpDeliveryError(f"twilio {response.status_code}")


def create_otp_sender(settings: Settings) -> OtpSender:
    if settings.otp_provider == "twilio":
        return TwilioOtpSender(settings)
    return ConsoleOtpSender() if settings.otp_provider == "console" else DisabledOtpSender()
