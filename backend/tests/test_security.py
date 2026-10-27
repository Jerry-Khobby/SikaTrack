"""Security hardening: the SMS provider, response headers, rate limits."""

import asyncio
import base64
import json
import urllib.parse
from dataclasses import dataclass, field
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from conftest import CapturingSender, sign_in
from sikatrack_api.auth import sms
from sikatrack_api.config import Settings

TWILIO = {
    "otp_provider": "twilio",
    "twilio_account_sid": "AC123",
    "twilio_auth_token": "secret-token",
    "twilio_from": "SikaTrack",
}


def _twilio(settings: Settings, **overrides: Any) -> Settings:
    return Settings.model_validate({**settings.model_dump(), **TWILIO, **overrides})


ARKESEL = {"otp_provider": "arkesel", "arkesel_api_key": "ark-key", "arkesel_sender": "SikaTrack"}


def _arkesel(settings: Settings, **overrides: Any) -> Settings:
    return Settings.model_validate({**settings.model_dump(), **ARKESEL, **overrides})


# ---- the SMS provider ----------------------------------------------------------------


def test_twilio_needs_its_credentials(settings: Settings) -> None:
    with pytest.raises(ValidationError, match="TWILIO_ACCOUNT_SID"):
        _twilio(settings, twilio_auth_token=None)
    with pytest.raises(ValidationError, match="TWILIO_FROM"):
        _twilio(settings, twilio_from=None)
    with pytest.raises(ValidationError, match="must contain"):
        _twilio(settings, otp_message="Your code")


def test_arkesel_needs_its_key_and_a_short_sender(settings: Settings) -> None:
    with pytest.raises(ValidationError, match="ARKESEL_API_KEY"):
        _arkesel(settings, arkesel_api_key=None)
    with pytest.raises(ValidationError, match="ARKESEL_SENDER"):
        _arkesel(settings, arkesel_sender=None)
    with pytest.raises(ValidationError, match="11 characters"):
        _arkesel(settings, arkesel_sender="SikaTrackApp1")


def test_production_refuses_printed_codes(settings: Settings) -> None:
    with pytest.raises(ValidationError, match="console"):
        Settings.model_validate({**settings.model_dump(), "environment": "production"})


@dataclass
class FakeTwilio:
    """Twilio, faked at the HTTP layer: records each request and answers with `status`."""

    status: int = 201
    requests: list[httpx2.Request] = field(default_factory=list)

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        body = {"sid": "SM1"} if self.status < 400 else {"code": 21211, "message": "Invalid 'To'"}
        return httpx2.Response(self.status, json=body)


@pytest.fixture
def twilio(monkeypatch: pytest.MonkeyPatch) -> FakeTwilio:
    fake = FakeTwilio()
    real = httpx2.AsyncClient
    monkeypatch.setattr(
        sms.httpx2, "AsyncClient", lambda **kw: real(transport=httpx2.MockTransport(fake.handle), **kw)
    )
    return fake


def test_twilio_sends_the_code_to_the_number(settings: Settings, twilio: FakeTwilio) -> None:
    sender = sms.create_otp_sender(_twilio(settings))

    asyncio.run(sender.send("+233241234567", "482913"))

    [request] = twilio.requests
    assert str(request.url) == "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"
    assert request.headers["Authorization"] == "Basic " + base64.b64encode(b"AC123:secret-token").decode()
    form = dict(urllib.parse.parse_qsl(request.content.decode()))
    assert form["To"] == "+233241234567"
    assert form["From"] == "SikaTrack"
    assert "482913" in form["Body"]


def test_a_refused_sms_is_a_delivery_error(settings: Settings, twilio: FakeTwilio) -> None:
    twilio.status = 400

    with pytest.raises(sms.OtpDeliveryError):
        asyncio.run(sms.create_otp_sender(_twilio(settings)).send("+233241234567", "482913"))


@dataclass
class FakeArkesel:
    """Arkesel, faked at the HTTP layer: records each request and answers with `status` and `body`."""

    status: int = 200
    body: dict[str, Any] = field(default_factory=lambda: {"status": "success", "data": [{"id": "1"}]})
    requests: list[httpx2.Request] = field(default_factory=list)

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        return httpx2.Response(self.status, json=self.body)


@pytest.fixture
def arkesel(monkeypatch: pytest.MonkeyPatch) -> FakeArkesel:
    fake = FakeArkesel()
    real = httpx2.AsyncClient
    monkeypatch.setattr(
        sms.httpx2, "AsyncClient", lambda **kw: real(transport=httpx2.MockTransport(fake.handle), **kw)
    )
    return fake


def test_arkesel_sends_the_code_to_the_number(settings: Settings, arkesel: FakeArkesel) -> None:
    sender = sms.create_otp_sender(_arkesel(settings))

    asyncio.run(sender.send("+233241234567", "482913"))

    [request] = arkesel.requests
    assert str(request.url) == "https://sms.arkesel.com/api/v2/sms/send"
    assert request.headers["api-key"] == "ark-key"
    body = json.loads(request.content)
    assert body["recipients"] == ["233241234567"]  # Arkesel's format: no leading +
    assert body["sender"] == "SikaTrack"
    assert "482913" in body["message"]


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (401, {"status": "error", "message": "Invalid API key"}),
        (200, {"status": "error", "message": "Insufficient balance"}),  # refused with a 200
    ],
)
def test_an_sms_arkesel_refuses_is_a_delivery_error(
    settings: Settings, arkesel: FakeArkesel, status: int, body: dict[str, Any]
) -> None:
    arkesel.status, arkesel.body = status, body

    with pytest.raises(sms.OtpDeliveryError):
        asyncio.run(sms.create_otp_sender(_arkesel(settings)).send("+233241234567", "482913"))


# ---- response headers ----------------------------------------------------------------


def test_responses_are_not_cached_or_sniffed(client: TestClient) -> None:
    for path in ("/health", "/v1/nothing-here"):
        response = client.get(path)
        assert response.headers["Cache-Control"] == "no-store"
        assert response.headers["X-Content-Type-Options"] == "nosniff"


# ---- rate limits (need the database) ----------------------------------------------------


@pytest.fixture
def client_address() -> tuple[str, int]:
    return ("203.0.113.7", 50000)  # a documentation address, so per-IP limits apply


@pytest.fixture
def limited_api(api: TestClient) -> TestClient:
    state = api.app.state  # type: ignore[attr-defined]
    state.settings = state.settings.model_copy(
        update={"rate_limit_enabled": True, "rate_limit_per_user": 5, "rate_limit_per_ip": 3}
    )
    return api


@pytest.mark.integration
def test_signed_in_requests_are_limited_per_user(limited_api: TestClient, sender: CapturingSender) -> None:
    limited_api.app.state.settings = limited_api.app.state.settings.model_copy(  # type: ignore[attr-defined]
        update={"rate_limit_per_ip": 100}  # sign-in itself is per IP; give it room here
    )
    first = sign_in(limited_api, sender, phone="0241234567")
    second = sign_in(limited_api, sender, phone="0201234567")

    codes = [limited_api.get("/v1/me", headers=first.headers).status_code for _ in range(6)]

    assert codes == [200] * 5 + [429]
    response = limited_api.get("/v1/me", headers=first.headers)
    assert response.json()["code"] == "rate_limited"
    assert 1 <= int(response.headers["Retry-After"]) <= 61
    assert limited_api.get("/v1/me", headers=second.headers).status_code == 200  # a separate budget


@pytest.mark.integration
def test_public_endpoints_are_limited_per_ip(limited_api: TestClient) -> None:
    codes = [limited_api.get("/v1/config").status_code for _ in range(4)]

    assert codes == [200, 200, 200, 429]


@pytest.mark.integration
def test_limits_reset_in_the_next_window(limited_api: TestClient, fake_clock: Any) -> None:
    for _ in range(4):
        limited_api.get("/v1/config")

    fake_clock.advance(seconds=61)

    assert limited_api.get("/v1/config").status_code == 200
