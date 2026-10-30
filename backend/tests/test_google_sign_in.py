"""Sign in with Google: the ID token is checked against Google's keys (faked with a test key),
and the account is keyed on Google's account ID."""

import asyncio
import json
import time
import uuid
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from sikatrack_api.auth import google
from sikatrack_api.config import Settings
from sikatrack_api.services import sign_in

pytestmark = pytest.mark.integration

CLIENT_ID = "1234-web.apps.googleusercontent.com"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeGoogleKeys(google.GoogleKeys):
    """Google's key set holding only the test key ("k1"); counts how often it's fetched."""

    def __init__(self) -> None:
        super().__init__()
        self.fetches = 0

    async def _fetch(self) -> tuple[list[dict[str, Any]], float]:
        self.fetches += 1
        jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(GOOGLE_KEY.public_key()))
        return [{**jwk, "kid": "k1", "alg": "RS256", "use": "sig"}], 3600.0


@pytest.fixture
def db_settings(db_settings: Settings) -> Settings:
    return db_settings.model_copy(update={"google_client_ids": CLIENT_ID, "wallet_verification": "trust"})


@pytest.fixture(autouse=True)
def google_keys(monkeypatch: pytest.MonkeyPatch) -> FakeGoogleKeys:
    keys = FakeGoogleKeys()
    monkeypatch.setattr(sign_in, "GOOGLE_KEYS", keys)
    return keys


def id_token(sub: str = "google-sub-1", key: Any = GOOGLE_KEY, kid: str = "k1", **claims: Any) -> str:
    now = int(time.time())
    body = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": sub,
        "iat": now,
        "exp": now + 3600,
        "email": "kwame@example.com",
        "email_verified": True,
        "given_name": "Kwame",
        **claims,
    }
    return jwt.encode(body, key, algorithm="RS256", headers={"kid": kid})


def sign_in_google(api: TestClient, token: str, device_id: str | None = None) -> Any:
    device = {"device_id": device_id or str(uuid.uuid4()), "platform": "android", "app_version": "1.0.0"}
    return api.post("/v1/auth/google", json={"id_token": token, "device": device})


def test_config_offers_google_sign_in(api: TestClient) -> None:
    assert api.get("/v1/config").json()["sign_in_methods"] == ["google", "phone"]


def test_first_sign_in_creates_the_account_and_the_next_finds_it(api: TestClient) -> None:
    first = sign_in_google(api, id_token())
    body = first.json()

    assert first.status_code == 200, first.text
    assert body["is_new_user"] is True
    assert (body["user"]["phone_number"], body["user"]["email"]) == (None, "kwame@example.com")
    me = api.get("/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200

    # Same Google account, even with a changed email: the same SikaTrack account
    again = sign_in_google(api, id_token(email="kwame.new@example.com")).json()
    assert again["is_new_user"] is False
    assert again["user"]["id"] == body["user"]["id"]
    assert again["user"]["email"] == "kwame.new@example.com"


def test_an_unverified_email_isnt_kept(api: TestClient) -> None:
    body = sign_in_google(api, id_token(email="x@example.com", email_verified=False)).json()

    assert body["user"]["email"] is None


@pytest.mark.parametrize(
    ("label", "token"),
    [
        ("signed with another key", lambda: id_token(key=OTHER_KEY)),
        ("for another app", lambda: id_token(aud="someone-else.apps.googleusercontent.com")),
        ("not issued by Google", lambda: id_token(iss="https://evil.example.com")),
        ("expired", lambda: id_token(exp=int(time.time()) - 3600, iat=int(time.time()) - 7200)),
        ("an unknown key ID", lambda: id_token(kid="k-unknown")),
        ("not a JWT", lambda: "this-is-not-a-google-token-at-all"),
    ],
)
def test_tokens_google_didnt_issue_for_this_app_are_refused(api: TestClient, label: str, token: Any) -> None:
    response = sign_in_google(api, token())

    assert response.status_code == 401, label
    assert response.json()["code"] == "google_token_invalid"


def test_googles_keys_are_fetched_once_and_cached(api: TestClient, google_keys: FakeGoogleKeys) -> None:
    sign_in_google(api, id_token(sub="a"))
    sign_in_google(api, id_token(sub="b"))
    sign_in_google(api, id_token(kid="k-unknown"))  # an unknown key may refetch, but not right away

    assert google_keys.fetches == 1


def test_wallets_count_at_once_when_codes_cant_be_sent(api: TestClient) -> None:
    token = sign_in_google(api, id_token()).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    wallet = api.post(
        "/v1/wallets", headers=headers, json={"provider": "mtn_momo", "phone_number": "0241234567"}
    )

    assert wallet.status_code == 201
    assert wallet.json()["verified"] is True
    assert api.get("/v1/me", headers=headers).json()["onboarding"]["wallets_added"] is True


def test_google_sign_in_is_off_without_client_ids(settings: Settings) -> None:
    from sikatrack_api.errors import AppError
    from sikatrack_api.schemas.auth import GoogleSignInIn

    body = GoogleSignInIn.model_validate(
        {
            "id_token": id_token(),
            "device": {"device_id": str(uuid.uuid4()), "platform": "android", "app_version": "1.0.0"},
        }
    )
    with pytest.raises(AppError) as refused:
        asyncio.run(sign_in.sign_in_with_google(None, settings, body))  # type: ignore[arg-type]
    assert refused.value.status == 404
