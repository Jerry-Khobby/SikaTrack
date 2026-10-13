"""/v1/me and /v1/devices, on a real database."""

import asyncio
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import CapturingSender, Clock, SignedIn, sign_in
from database import fetch

pytestmark = pytest.mark.integration


def test_me_has_defaults_for_a_new_user(api: TestClient, user: SignedIn) -> None:
    body = api.get("/v1/me", headers=user.headers).json()

    assert body["id"] == user.user_id
    assert body["settings"] == {
        "low_balance_threshold": "5.00",
        "notify": {
            "budget": True,
            "low_balance": True,
            "recurring": True,
            "weekly_digest": True,
            "data_ready": False,
        },
    }
    assert body["onboarding"]["sms_permission"] == "unknown"


def test_patch_changes_only_what_was_sent(api: TestClient, user: SignedIn) -> None:
    api.patch("/v1/me", headers=user.headers, json={"settings": {"notify": {"budget": False}}})
    response = api.patch(
        "/v1/me",
        headers=user.headers,
        json={"display_name": "Jerry", "settings": {"low_balance_threshold": "10.50"}},
    )

    body = response.json()
    assert response.status_code == 200
    assert body["display_name"] == "Jerry"
    assert body["settings"]["low_balance_threshold"] == "10.50"
    assert body["settings"]["notify"]["budget"] is False  # kept from the first change
    assert body["settings"]["notify"]["low_balance"] is True


@pytest.mark.parametrize(
    "patch",
    [
        {"settings": {"low_balance_threshold": 10.5}},  # money as a float
        {"settings": {"low_balance_threshold": "-1.00"}},
        {"settings": {"low_balance_thresold": "5.00"}},  # typo: refused, not ignored
        {"display_name": ""},
        {"onboarding": {"sms_permission": "maybe"}},
    ],
)
def test_bad_patches_are_refused(api: TestClient, user: SignedIn, patch: dict[str, object]) -> None:
    response = api.patch("/v1/me", headers=user.headers, json=patch)

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_users_only_ever_see_and_change_themselves(api: TestClient, sender: CapturingSender) -> None:
    first = sign_in(api, sender, phone="0241234567")
    second = sign_in(api, sender, phone="0201234567")

    api.patch("/v1/me", headers=second.headers, json={"display_name": "Second"})

    assert api.get("/v1/me", headers=first.headers).json()["display_name"] is None
    assert api.get("/v1/me", headers=second.headers).json()["id"] == second.user_id


def test_deleting_the_account_signs_out_everywhere(api: TestClient, user: SignedIn) -> None:
    response = api.delete("/v1/me", headers=user.headers)

    assert response.status_code == 202
    assert "deletion_scheduled_for" in response.json()
    assert api.get("/v1/me", headers=user.headers).status_code == 401
    assert api.post("/v1/auth/refresh", json={"refresh_token": user.refresh_token}).status_code == 401


def test_signing_in_again_cancels_the_deletion(
    api: TestClient, sender: CapturingSender, fake_clock: Clock, database_url: str
) -> None:
    first = sign_in(api, sender)
    api.delete("/v1/me", headers=first.headers)
    fake_clock.advance(seconds=61)

    again = sign_in(api, sender)

    assert again.user_id == first.user_id
    assert api.get("/v1/me", headers=again.headers).status_code == 200
    assert asyncio.run(fetch(database_url, "SELECT status, delete_after FROM app.user")) == [("active", None)]


def test_devices_register_their_push_token(api: TestClient, user: SignedIn) -> None:
    response = api.put(
        f"/v1/devices/{user.device_id}",
        headers=user.headers,
        json={"platform": "android", "app_version": "1.0.3", "push_token": "ExponentPushToken[abc]"},
    )

    assert response.status_code == 200
    assert response.json()["push_enabled"] is True
    assert api.delete(f"/v1/devices/{user.device_id}", headers=user.headers).status_code == 204


def test_another_users_device_is_not_found(api: TestClient, sender: CapturingSender) -> None:
    first = sign_in(api, sender, phone="0241234567")
    second = sign_in(api, sender, phone="0201234567")
    body = {"platform": "android", "app_version": "1.0.0", "push_token": "ExponentPushToken[steal]"}

    assert api.put(f"/v1/devices/{first.device_id}", headers=second.headers, json=body).status_code == 404
    assert api.delete(f"/v1/devices/{first.device_id}", headers=second.headers).status_code == 404


def test_old_app_versions_must_update_before_registering(api: TestClient, user: SignedIn) -> None:
    response = api.put(
        f"/v1/devices/{uuid.uuid4()}",
        headers=user.headers,
        json={"platform": "android", "app_version": "0.1.0"},
    )

    assert response.status_code == 426


def test_logout_stops_push_to_that_phone(api: TestClient, user: SignedIn, database_url: str) -> None:
    api.put(
        f"/v1/devices/{user.device_id}",
        headers=user.headers,
        json={"platform": "android", "app_version": "1.0.0", "push_token": "ExponentPushToken[abc]"},
    )

    api.post("/v1/auth/logout", json={"refresh_token": user.refresh_token})

    assert asyncio.run(fetch(database_url, "SELECT push_token FROM app.device")) == [(None,)]


def test_the_audit_log_records_sign_ins_without_secrets(
    api: TestClient, user: SignedIn, database_url: str
) -> None:
    rows = asyncio.run(fetch(database_url, "SELECT action, detail::text FROM app.audit_event ORDER BY id"))

    assert [action for action, _ in rows] == ["account_created", "signed_in"]
    assert user.refresh_token not in str(rows)
    assert user.phone not in str(rows)


def test_an_account_is_erased_everywhere_after_the_grace_period(
    api: TestClient, data: SignedIn, raw_bucket: Any, fake_clock: Clock, database_url: str
) -> None:
    from sikatrack_api.services import maintenance
    from sms_samples import samples as s

    other = asyncio.run(fetch(database_url, "SELECT id FROM app.user WHERE id <> :id", id=data.uuid))
    api.post(
        "/v1/sms/batches",
        headers={**data.headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"device_id": data.device_id, "source": "live",
              "messages": [{"sender": s.MTN, "date_ms": "1790000000000", "body": s.PAYMENT_MADE}]},
    )  # fmt: skip
    raw_bucket.put_object(
        Bucket="sikatrack-processed", Key=f"users/{data.uuid}/transactions/x.parquet", Body=b"x"
    )
    api.delete("/v1/me", headers=data.headers)
    state = api.app.state  # type: ignore[attr-defined]
    assert api.portal is not None

    assert (
        api.portal.call(maintenance.erase_due_accounts, state.session_factory, raw_bucket, state.settings)
        == 0
    )
    fake_clock.advance(days=8)  # past the 7-day grace period
    assert (
        api.portal.call(maintenance.erase_due_accounts, state.session_factory, raw_bucket, state.settings)
        == 1
    )

    for bucket in ("sikatrack-raw", "sikatrack-processed"):
        assert raw_bucket.list_objects_v2(Bucket=bucket, Prefix=f"users/{data.uuid}/").get("KeyCount") == 0
    count = "SELECT count(*) FROM {} WHERE {} = :id"
    assert asyncio.run(fetch(database_url, count.format("app.user", "id"), id=data.uuid)) == [(0,)]
    assert asyncio.run(fetch(database_url, count.format("dw.dim_user", "user_id"), id=data.uuid)) == [(0,)]
    assert asyncio.run(fetch(database_url, "SELECT count(*) FROM dw.fact_transaction")) == [
        (1,)
    ]  # the other user's
    assert asyncio.run(fetch(database_url, "SELECT id FROM app.user")) == other
    events = asyncio.run(
        fetch(database_url, "SELECT action FROM app.audit_event WHERE user_id = :id", id=data.uuid)
    )
    assert ("account_erased",) in events
