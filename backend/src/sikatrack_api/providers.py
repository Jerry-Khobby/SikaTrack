"""Push notifications to phones. The provider is chosen by PUSH_PROVIDER; another one (FCM
directly, say) plugs in as another PushSender without touching the alert rules."""

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx2

from sikatrack_api.config import Settings

log = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@dataclass(frozen=True)
class PushMessage:
    token: str
    title: str
    body: str
    link: str | None


class PushSender(Protocol):
    async def send(self, messages: list[PushMessage]) -> set[str]:
        """Deliver; return the tokens the provider says are dead (uninstalled apps)."""
        ...


class DisabledPushSender:
    async def send(self, messages: list[PushMessage]) -> set[str]:
        if messages:
            log.info("Push disabled; %d message(s) kept in the inbox only", len(messages))
        return set()


class ExpoPushSender:
    def __init__(self, settings: Settings) -> None:
        self.headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if settings.expo_access_token is not None:
            self.headers["Authorization"] = f"Bearer {settings.expo_access_token.get_secret_value()}"

    async def send(self, messages: list[PushMessage]) -> set[str]:
        if not messages:
            return set()
        payload = [
            {"to": m.token, "title": m.title, "body": m.body, "data": {"link": m.link}, "sound": "default"}
            for m in messages
        ]
        async with httpx2.AsyncClient(timeout=10) as client:
            response = await client.post(EXPO_PUSH_URL, json=payload, headers=self.headers)
            response.raise_for_status()
        tickets = response.json().get("data", [])
        dead = {
            m.token
            for m, ticket in zip(messages, tickets, strict=False)
            if ticket.get("status") == "error"
            and ticket.get("details", {}).get("error") == "DeviceNotRegistered"
        }
        failed = sum(1 for t in tickets if t.get("status") == "error")
        if failed:
            log.warning("Expo refused %d of %d pushes", failed, len(messages))
        return dead


def create_push_sender(settings: Settings) -> PushSender:
    return ExpoPushSender(settings) if settings.push_provider == "expo" else DisabledPushSender()
