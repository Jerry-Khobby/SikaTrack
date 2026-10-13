"""Sign-in end to end, on a real database."""

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response

from conftest import CapturingSender, Clock, SignedIn, sign_in
from database import execute, fetch

pytestmark = pytest.mark.integration


def _request(api: TestClient, phone: str = "0241234567") -> str:
    response = api.post("/v1/auth/otp/request", json={"phone_number": phone})
    assert response.status_code == 202, response.text
    otp_id: str = response.json()["otp_request_id"]
    return otp_id


def _verify(api: TestClient, otp_id: str, code: str, app_version: str = "1.0.0") -> Response:
    return api.post(
        "/v1/auth/otp/verify",
        json={
            "otp_request_id": otp_id,
            "code": code,
            "device": {"device_id": str(uuid.uuid4()), "platform": "android", "app_version": app_version},
        },
    )


def test_first_sign_in_creates_the_account(api: TestClient, sender: CapturingSender) -> None:
    response = api.post("/v1/auth/otp/request", json={"phone_number": "024 123 4567"})

    assert response.status_code == 202
    assert response.json()["expires_in"] == 300
    assert sender.sent[-1][0] == "+233241234567"

    verified = _verify(api, response.json()["otp_request_id"], sender.last_code())
    body = verified.json()
    assert verified.status_code == 200
    assert body["is_new_user"] is True
    assert body["token_type"] == "Bearer"
    assert body["user"]["phone_number"] == "+233241234567"
    assert body["user"]["settings"]["low_balance_threshold"] == "5.00"


def test_signing_in_again_finds_the_same_account(
    api: TestClient, sender: CapturingSender, fake_clock: Clock
) -> None:
    first = sign_in(api, sender)
    fake_clock.advance(seconds=61)  # past the resend limit, instead of waiting
    otp_id = _request(api)
    second = _verify(api, otp_id, sender.last_code()).json()

    assert second["is_new_user"] is False
    assert second["user"]["id"] == first.user_id


def test_the_answer_is_the_same_for_unknown_numbers(api: TestClient, sender: CapturingSender) -> None:
    sign_in(api, sender, phone="0241234567")
    known = api.post("/v1/auth/otp/request", json={"phone_number": "0201234567"}).json()
    unknown = api.post("/v1/auth/otp/request", json={"phone_number": "0551234567"}).json()

    assert known.keys() == unknown.keys()


def test_bad_phone_numbers_name_the_field(api: TestClient) -> None:
    response = api.post("/v1/auth/otp/request", json={"phone_number": "0311234567"})

    assert response.status_code == 400
    assert response.json()["errors"][0]["field"] == "phone_number"


def test_a_wrong_code_is_refused_and_counted(api: TestClient, database_url: str) -> None:
    otp_id = _request(api)

    response = _verify(api, otp_id, "000000")

    assert response.status_code == 400
    assert response.json()["code"] == "otp_invalid"
    assert asyncio.run(fetch(database_url, "SELECT attempts FROM app.otp_request")) == [(1,)]


def test_five_wrong_guesses_burn_the_code(api: TestClient, sender: CapturingSender) -> None:
    otp_id = _request(api)
    real = sender.last_code()
    wrong = "111111" if real != "111111" else "222222"
    for _ in range(5):
        _verify(api, otp_id, wrong)

    response = _verify(api, otp_id, real)

    assert response.json()["code"] == "otp_invalid"


def test_a_code_works_once(api: TestClient, sender: CapturingSender) -> None:
    otp_id = _request(api)
    code = sender.last_code()

    assert _verify(api, otp_id, code).status_code == 200
    assert _verify(api, otp_id, code).json()["code"] == "otp_invalid"


def test_an_expired_code_is_refused(api: TestClient, sender: CapturingSender, database_url: str) -> None:
    otp_id = _request(api)
    asyncio.run(execute(database_url, "UPDATE app.otp_request SET expires_at = now() - interval '1 second'"))

    assert _verify(api, otp_id, sender.last_code()).json()["code"] == "otp_invalid"


@pytest.mark.parametrize("otp_id", ["otp_nothex", "usr_" + uuid.uuid4().hex, "otp_" + uuid.uuid4().hex])
def test_unknown_requests_look_like_wrong_codes(api: TestClient, otp_id: str) -> None:
    assert _verify(api, otp_id, "123456").json()["code"] == "otp_invalid"


def test_asking_again_too_soon_is_rate_limited(api: TestClient) -> None:
    _request(api)

    response = api.post("/v1/auth/otp/request", json={"phone_number": "0241234567"})

    assert response.status_code == 429
    assert response.json()["code"] == "rate_limited"
    assert 1 <= int(response.headers["Retry-After"]) <= 61


def test_three_codes_per_ten_minutes_per_phone(api: TestClient, fake_clock: Clock) -> None:
    for _ in range(3):
        _request(api)
        fake_clock.advance(minutes=2)  # minutes 0, 2, 4; now at 6

    assert api.post("/v1/auth/otp/request", json={"phone_number": "0241234567"}).status_code == 429

    fake_clock.advance(minutes=5)  # minute 11: the first code has left the 10-minute window
    assert api.post("/v1/auth/otp/request", json={"phone_number": "0241234567"}).status_code == 202


def test_old_app_versions_must_update(api: TestClient, sender: CapturingSender) -> None:
    otp_id = _request(api)

    response = _verify(api, otp_id, sender.last_code(), app_version="0.9.0")

    assert response.status_code == 426
    assert response.json()["code"] == "app_update_required"


def test_refresh_rotates_the_token(api: TestClient, user: SignedIn) -> None:
    response = api.post("/v1/auth/refresh", json={"refresh_token": user.refresh_token})

    assert response.status_code == 200
    new = response.json()
    assert new["refresh_token"] != user.refresh_token
    assert api.get("/v1/me", headers={"Authorization": f"Bearer {new['access_token']}"}).status_code == 200


def test_reusing_an_old_refresh_token_ends_the_session(
    api: TestClient, user: SignedIn, database_url: str
) -> None:
    rotated = api.post("/v1/auth/refresh", json={"refresh_token": user.refresh_token}).json()

    reused = api.post("/v1/auth/refresh", json={"refresh_token": user.refresh_token})

    assert reused.status_code == 401
    assert reused.json()["code"] == "refresh_invalid"
    # The thief's copy is dead, and so is the legitimate newer token
    assert api.post("/v1/auth/refresh", json={"refresh_token": rotated["refresh_token"]}).status_code == 401
    assert (
        api.get("/v1/me", headers={"Authorization": f"Bearer {rotated['access_token']}"}).status_code == 401
    )
    events = asyncio.run(fetch(database_url, "SELECT action FROM app.audit_event ORDER BY id"))
    assert ("refresh_token_reused",) in events


def test_unknown_refresh_tokens_are_refused(api: TestClient) -> None:
    response = api.post("/v1/auth/refresh", json={"refresh_token": "rt_" + "x" * 43})

    assert response.status_code == 401


def test_logout_ends_the_session_at_once(api: TestClient, user: SignedIn) -> None:
    assert api.post("/v1/auth/logout", json={"refresh_token": user.refresh_token}).status_code == 204

    assert api.get("/v1/me", headers=user.headers).status_code == 401  # the access token is dead too
    assert api.post("/v1/auth/refresh", json={"refresh_token": user.refresh_token}).status_code == 401
    assert api.post("/v1/auth/logout", json={"refresh_token": user.refresh_token}).status_code == 204


def test_signing_in_again_on_a_device_replaces_its_session(
    api: TestClient, sender: CapturingSender, fake_clock: Clock
) -> None:
    first = sign_in(api, sender)
    fake_clock.advance(seconds=61)
    otp_id = _request(api)
    api.post(
        "/v1/auth/otp/verify",
        json={
            "otp_request_id": otp_id,
            "code": sender.last_code(),
            "device": {"device_id": first.device_id, "platform": "android", "app_version": "1.0.0"},
        },
    )

    assert api.get("/v1/me", headers=first.headers).status_code == 401


@pytest.mark.parametrize(
    "header",
    ["", "Bearer", "Bearer not-a-jwt", "Basic dXNlcjpwYXNz", "Bearer " + "e30.e30.e30"],
)
def test_protected_endpoints_need_a_valid_token(api: TestClient, header: str) -> None:
    response = api.get("/v1/me", headers={"Authorization": header} if header else {})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"
    assert response.headers["WWW-Authenticate"].startswith("Bearer")


def test_no_code_or_token_is_stored_in_plain_text(
    api: TestClient, user: SignedIn, sender: CapturingSender, database_url: str
) -> None:
    rows = asyncio.run(
        fetch(
            database_url,
            "SELECT o.code_hash, s.refresh_token_hash FROM app.otp_request o, app.session s",
        )
    )
    stored = " ".join(str(v) for row in rows for v in row)

    assert sender.last_code() not in stored
    assert user.refresh_token not in stored
