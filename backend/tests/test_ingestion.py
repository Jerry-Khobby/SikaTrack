"""Config, wallets, SMS uploads, the pipeline trigger and its callback, on a real database."""

import asyncio
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from src.extraction.filter_sms import iter_jsonl, make_message_id

from conftest import INTERNAL_TOKEN, CapturingSender, Clock, FakeTrigger, SignedIn, sign_in
from database import execute, fetch
from sikatrack_api.services import pipeline
from sms_samples import samples as s

pytestmark = pytest.mark.integration

PROVISIONAL_SQL = "SELECT amount, category_name FROM app.provisional_transaction ORDER BY occurred_at"
JAN_1 = int(datetime(2026, 1, 1, 9, tzinfo=UTC).timestamp() * 1000)


def sms(body: str, minutes: int = 0, sender: str = s.MTN) -> dict[str, str]:
    return {"sender": sender, "date_ms": str(JAN_1 + minutes * 60_000), "body": body}


def upload(
    api: TestClient, user: SignedIn, messages: list[dict[str, str]], key: str | None = None
) -> Response:
    return api.post(
        "/v1/sms/batches",
        headers={**user.headers, "Idempotency-Key": key or str(uuid.uuid4())},
        json={"device_id": user.device_id, "source": "initial_scan", "messages": messages},
    )


# ---- config ----------------------------------------------------------------------------


def test_config_is_public_and_comes_from_the_pipeline(api: TestClient) -> None:
    response = api.get("/v1/config")

    body = response.json()
    assert response.status_code == 200
    assert body["momo_senders"] == ["GhanaPay", "MobileMoney"]
    providers = {p["code"]: p for p in body["providers"]}
    assert providers["mtn_momo"] == {
        "code": "mtn_momo", "name": "MTN MoMo", "senders": ["MobileMoney"], "supported": True,
    }  # fmt: skip
    assert providers["telecel_cash"]["supported"] is False
    assert "max-age=3600" in response.headers["Cache-Control"]


# ---- wallets ---------------------------------------------------------------------------


def test_wallets_are_normalised_and_mark_onboarding(api: TestClient, user: SignedIn) -> None:
    response = api.post(
        "/v1/wallets",
        headers=user.headers,
        json={"provider": "mtn_momo", "phone_number": "024 000 0001", "account_name": "kwame  owusu"},
    )

    body = response.json()
    assert response.status_code == 201
    assert (body["phone_number"], body["account_name"]) == ("+233240000001", "KWAME OWUSU")
    assert body["id"].startswith("wal_")
    assert api.get("/v1/me", headers=user.headers).json()["onboarding"]["wallets_added"] is True


def test_wallet_rules(api: TestClient, sender: CapturingSender) -> None:
    owner = sign_in(api, sender, phone="0241234567")
    other = sign_in(api, sender, phone="0201234567")
    body = {"provider": "mtn_momo", "phone_number": "0240000001"}
    wallet_id = api.post("/v1/wallets", headers=owner.headers, json=body).json()["id"]

    assert api.post("/v1/wallets", headers=owner.headers, json=body).status_code == 409
    unsupported = api.post("/v1/wallets", headers=owner.headers, json={**body, "provider": "telecel_cash"})
    assert unsupported.json()["code"] == "unsupported_provider"
    assert (
        api.patch(f"/v1/wallets/{wallet_id}", headers=other.headers, json={"label": "x"}).status_code == 404
    )
    assert api.delete(f"/v1/wallets/{wallet_id}", headers=other.headers).status_code == 404

    renamed = api.patch(f"/v1/wallets/{wallet_id}", headers=owner.headers, json={"label": "Main"})
    assert renamed.json()["label"] == "Main"
    assert api.delete(f"/v1/wallets/{wallet_id}", headers=owner.headers).status_code == 204
    assert api.get("/v1/wallets", headers=owner.headers).json() == {"items": []}


# ---- uploads ---------------------------------------------------------------------------


def test_an_upload_stores_momo_sms_and_shows_them_at_once(
    api: TestClient, user: SignedIn, raw_bucket: Any, database_url: str
) -> None:
    messages = [
        sms(s.PAYMENT_MADE),
        sms(s.MERCHANT_PAID, 1),
        sms(s.OTP, 2),  # ignored, not a transaction
        sms("Your bank balance is GHS 5", 3, sender="CalBank"),  # not MoMo: never stored
    ]

    response = upload(api, user, messages)

    body = response.json()
    assert response.status_code == 202
    assert {k: body[k] for k in ("received", "accepted", "rejected_senders", "parsed", "ignored")} == {
        "received": 4, "accepted": 3, "rejected_senders": 1, "parsed": 2, "ignored": 1,
    }  # fmt: skip
    assert body["provisional_transactions"] == 2
    assert body["sync"] == {"latest_date_ms": str(JAN_1 + 2 * 60_000), "pipeline": "scheduled"}

    # The raw zone holds exactly the MoMo SMS, readable by the pipeline's own reader
    user_uuid = uuid.UUID(hex=user.user_id.removeprefix("usr_"))
    [key] = [o["Key"] for o in raw_bucket.list_objects_v2(Bucket="sikatrack-raw")["Contents"]]
    assert key.startswith(f"users/{user_uuid}/sms/")
    assert key.endswith(".jsonl")
    obj = raw_bucket.get_object(Bucket="sikatrack-raw", Key=key)["Body"]
    rows = list(iter_jsonl(obj))
    assert len(rows) == 3
    assert "CalBank" not in str(rows)
    # Same IDs as the pipeline computes from a backup of the same SMS
    first = json.loads(raw_bucket.get_object(Bucket="sikatrack-raw", Key=key)["Body"].read().splitlines()[0])
    assert first["message_id"] == make_message_id(s.MTN, str(JAN_1), s.PAYMENT_MADE)

    provisional = asyncio.run(fetch(database_url, PROVISIONAL_SQL))
    assert [(str(a), c) for a, c in provisional] == [
        ("16.50", "Transfers-Personal"),
        ("47.50", "Personal Care"),
    ]


def test_sms_already_uploaded_are_duplicates(api: TestClient, user: SignedIn, raw_bucket: Any) -> None:
    upload(api, user, [sms(s.PAYMENT_MADE)])

    again = upload(api, user, [sms(s.PAYMENT_MADE), sms(s.PAYMENT_MADE), sms(s.CASH_OUT, 5)]).json()

    assert (again["accepted"], again["duplicates"]) == (1, 2)
    assert len(raw_bucket.list_objects_v2(Bucket="sikatrack-raw")["Contents"]) == 2


def test_a_retry_with_the_same_key_changes_nothing(api: TestClient, user: SignedIn, raw_bucket: Any) -> None:
    key = str(uuid.uuid4())
    first = upload(api, user, [sms(s.PAYMENT_MADE)], key=key)

    retry = upload(api, user, [sms(s.PAYMENT_MADE)], key=key)

    assert retry.status_code == 202
    assert retry.json() == first.json()  # the same answer, not "1 duplicate"
    assert len(raw_bucket.list_objects_v2(Bucket="sikatrack-raw")["Contents"]) == 1


def test_a_key_reused_for_different_sms_is_a_conflict(api: TestClient, user: SignedIn) -> None:
    key = str(uuid.uuid4())
    upload(api, user, [sms(s.PAYMENT_MADE)], key=key)

    response = upload(api, user, [sms(s.CASH_OUT)], key=key)

    assert response.status_code == 409
    assert response.json()["code"] == "idempotency_mismatch"


def test_users_keys_and_sms_are_separate(api: TestClient, sender: CapturingSender) -> None:
    first = sign_in(api, sender, phone="0241234567")
    second = sign_in(api, sender, phone="0201234567")
    key = str(uuid.uuid4())

    upload(api, first, [sms(s.PAYMENT_MADE)], key=key)
    response = upload(api, second, [sms(s.PAYMENT_MADE)], key=key)

    # The same SMS reached both phones (sender and receiver): each user stores their copy
    assert response.json()["accepted"] == 1


def test_uploads_need_an_idempotency_key(api: TestClient, user: SignedIn) -> None:
    response = api.post(
        "/v1/sms/batches",
        headers=user.headers,
        json={"device_id": user.device_id, "source": "live", "messages": [sms(s.PAYMENT_MADE)]},
    )

    assert response.status_code == 400
    assert response.json()["errors"][0]["field"] == "idempotency-key"


def test_too_many_sms_in_one_batch(api: TestClient, user: SignedIn) -> None:
    messages = [sms(s.PAYMENT_MADE, i) for i in range(501)]

    assert upload(api, user, messages).status_code == 413


def test_a_raw_zone_outage_records_nothing(
    api: TestClient, user: SignedIn, raw_bucket: Any, database_url: str
) -> None:
    raw_bucket.delete_bucket(Bucket="sikatrack-raw")

    response = upload(api, user, [sms(s.PAYMENT_MADE)])

    assert response.status_code == 503
    assert response.json()["code"] == "dependency_unavailable"
    assert asyncio.run(fetch(database_url, "SELECT count(*) FROM app.sms_batch")) == [(0,)]


def test_transfers_to_your_own_wallet_are_recognised(
    api: TestClient, user: SignedIn, database_url: str
) -> None:
    api.post("/v1/wallets", headers=user.headers, json={"provider": "mtn_momo", "phone_number": "0240000002"})

    upload(api, user, [sms(s.WALLET_TRANSFER_OUT, sender=s.GHANAPAY)])

    rows = asyncio.run(
        fetch(database_url, "SELECT is_own_transfer, category_name FROM app.provisional_transaction")
    )
    assert rows == [(True, "Own Transfers")]


def test_batch_status_and_sync_status(api: TestClient, user: SignedIn, sender: CapturingSender) -> None:
    batch_id = upload(api, user, [sms(s.PAYMENT_MADE), sms(s.CASH_OUT, 10)]).json()["batch_id"]

    status = api.get(f"/v1/sms/batches/{batch_id}", headers=user.headers).json()
    sync = api.get("/v1/sync/status", headers=user.headers).json()

    assert (status["status"], status["accepted"]) == ("received", 2)
    assert sync["latest_date_ms"] == str(JAN_1 + 10 * 60_000)
    assert (sync["pending_messages"], sync["provisional_transactions"]) == (2, 2)
    other = sign_in(api, sender, phone="0201234567")
    assert api.get(f"/v1/sms/batches/{batch_id}", headers=other.headers).status_code == 404


# ---- the pipeline ------------------------------------------------------------------------


def _scheduler_pass(api: TestClient, trigger: FakeTrigger) -> int:
    """One pass of the scheduler, on the app's own event loop (its database pool lives there)."""
    state = api.app.state  # type: ignore[attr-defined]
    assert api.portal is not None
    return api.portal.call(pipeline.trigger_due_runs, state.session_factory, state.settings, trigger)


def test_runs_are_debounced_then_triggered(
    api: TestClient, user: SignedIn, trigger: FakeTrigger, fake_clock: Clock, database_url: str
) -> None:
    upload(api, user, [sms(s.PAYMENT_MADE)])
    upload(api, user, [sms(s.CASH_OUT, 5)])

    assert _scheduler_pass(api, trigger) == 0  # still inside the 2-minute window
    fake_clock.advance(seconds=121)
    assert _scheduler_pass(api, trigger) == 1  # one run for both uploads
    assert _scheduler_pass(api, trigger) == 0

    statuses = asyncio.run(fetch(database_url, "SELECT DISTINCT status, pipeline_run_id FROM app.sms_batch"))
    assert statuses == [("processing", "api__" + trigger.triggered[0].hex[:8] + "__1")]


def test_a_failed_trigger_is_retried_later(
    api: TestClient, user: SignedIn, trigger: FakeTrigger, fake_clock: Clock
) -> None:
    upload(api, user, [sms(s.PAYMENT_MADE)])
    fake_clock.advance(seconds=121)
    trigger.fail = True

    assert _scheduler_pass(api, trigger) == 0
    trigger.fail = False
    assert _scheduler_pass(api, trigger) == 0  # backing off, not hammering Airflow
    fake_clock.advance(seconds=301)
    assert _scheduler_pass(api, trigger) == 1


def _event(user: SignedIn, status: str, started: datetime, token: str = INTERNAL_TOKEN) -> dict[str, Any]:
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "json": {
            "run_id": "manual__1",
            "user_id": str(uuid.UUID(hex=user.user_id.removeprefix("usr_"))),
            "status": status,
            "started_at": started.isoformat(),
            "finished_at": (started + timedelta(minutes=1)).isoformat(),
        },
    }


def test_a_finished_run_replaces_the_provisional_view(
    api: TestClient, user: SignedIn, database_url: str
) -> None:
    batch_id = upload(api, user, [sms(s.PAYMENT_MADE)]).json()["batch_id"]
    started = datetime.now(UTC) + timedelta(seconds=1)  # the run started after the upload

    response = api.post("/internal/pipeline-events", **_event(user, "succeeded", started))

    assert response.status_code == 204
    assert api.get(f"/v1/sms/batches/{batch_id}", headers=user.headers).json()["status"] == "loaded"
    sync = api.get("/v1/sync/status", headers=user.headers).json()
    assert (sync["pending_messages"], sync["provisional_transactions"]) == (0, 0)
    assert sync["last_pipeline_run"]["status"] == "succeeded"


def test_uploads_after_a_run_started_wait_for_the_next(api: TestClient, user: SignedIn) -> None:
    started = datetime.now(UTC) - timedelta(minutes=5)
    upload(api, user, [sms(s.PAYMENT_MADE)])

    api.post("/internal/pipeline-events", **_event(user, "succeeded", started))

    sync = api.get("/v1/sync/status", headers=user.headers).json()
    assert sync["pending_messages"] == 1  # not covered by that run


def test_a_failed_run_puts_the_batch_back_in_the_queue(
    api: TestClient, user: SignedIn, database_url: str
) -> None:
    upload(api, user, [sms(s.PAYMENT_MADE)])
    asyncio.run(execute(database_url, "UPDATE app.sms_batch SET status = 'processing'"))

    api.post("/internal/pipeline-events", **_event(user, "failed", datetime.now(UTC) + timedelta(seconds=1)))

    assert asyncio.run(fetch(database_url, "SELECT status FROM app.sms_batch")) == [("received",)]
    sync = api.get("/v1/sync/status", headers=user.headers).json()
    assert sync["provisional_transactions"] == 1  # still shown while waiting


@pytest.mark.parametrize("token", ["", "wrong-token-of-the-right-length-0000000000"])
def test_the_internal_endpoint_needs_the_service_token(api: TestClient, user: SignedIn, token: str) -> None:
    response = api.post("/internal/pipeline-events", **_event(user, "succeeded", datetime.now(UTC), token))

    assert response.status_code == 403


def test_the_internal_endpoint_is_not_in_the_public_docs(api: TestClient) -> None:
    assert not any(path.startswith("/internal") for path in api.get("/openapi.json").json()["paths"])


def test_uploads_stuck_in_processing_are_requeued(
    api: TestClient, user: SignedIn, trigger: FakeTrigger, database_url: str
) -> None:
    """A run that never reported back (lost callback) must not leave uploads stuck forever."""
    upload(api, user, [sms(s.PAYMENT_MADE)])
    asyncio.run(execute(
        database_url,
        "UPDATE app.sms_batch SET status = 'processing', created_at = now() - interval '3 hours'",
        "UPDATE app.user SET pipeline_due_at = NULL",
    ))  # fmt: skip

    assert _scheduler_pass(api, trigger) == 1  # requeued and triggered again
    assert asyncio.run(fetch(database_url, "SELECT status FROM app.sms_batch")) == [("processing",)]
