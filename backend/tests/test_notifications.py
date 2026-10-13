"""Alerts and the inbox, on the hand-checkable dataset (see conftest.py).

The clock is frozen at 10 September 2026, so September is "this month": GHS 200 cash-out,
a daily GHS 50 bundle, a latest balance of GHS 378.
"""

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import INTERNAL_TOKEN, FakePusher, SignedIn
from database import fetch
from sikatrack_api.services import alerts

pytestmark = pytest.mark.integration

SEP_10 = datetime(2026, 9, 10, 12, tzinfo=UTC)


@pytest.fixture
def september(data: SignedIn, frozen_clock: Callable[[datetime], None], api: TestClient) -> SignedIn:
    frozen_clock(SEP_10)
    api.put(
        f"/v1/devices/{data.device_id}",
        headers=data.headers,
        json={"platform": "android", "app_version": "1.0.0", "push_token": "ExponentPushToken[phone]"},
    )
    return data


def run_finished(api: TestClient, user: SignedIn, status: str = "succeeded", run_id: str = "run-1") -> None:
    response = api.post(
        "/internal/pipeline-events",
        headers={"Authorization": f"Bearer {INTERNAL_TOKEN}"},
        json={
            "run_id": run_id, "user_id": user.uuid, "status": status,
            "started_at": (SEP_10 - timedelta(minutes=5)).isoformat(), "finished_at": SEP_10.isoformat(),
        },
    )  # fmt: skip
    assert response.status_code == 204


def inbox(api: TestClient, user: SignedIn, **params: Any) -> dict[str, Any]:
    body: dict[str, Any] = api.get("/v1/notifications", headers=user.headers, params=params).json()
    return body


def kinds(api: TestClient, user: SignedIn) -> list[str]:
    return sorted(n["kind"] for n in inbox(api, user)["items"])


def test_a_run_brings_budget_balance_and_recurring_alerts(
    api: TestClient, september: SignedIn, pusher: FakePusher
) -> None:
    api.put("/v1/budgets/cash_withdrawal", headers=september.headers, json={"limit": "150.00"})
    api.patch("/v1/me", headers=september.headers, json={"settings": {"low_balance_threshold": "500.00"}})

    run_finished(api, september)

    assert kinds(api, september) == ["budget_over", "low_balance", "new_recurring"]
    budget = next(n for n in inbox(api, september)["items"] if n["kind"] == "budget_over")
    # 80% and 100% were both crossed at once: one alert, for the highest
    assert budget["title"] == "Cash Withdrawal budget is used up"
    assert budget["body"] == "GHS 200 of GHS 150 spent, 20 days left."
    assert {m.token for m in pusher.sent} == {"ExponentPushToken[phone]"}
    assert len(pusher.sent) == 3


def test_an_alert_is_sent_once(api: TestClient, september: SignedIn, pusher: FakePusher) -> None:
    api.put("/v1/budgets/cash_withdrawal", headers=september.headers, json={"limit": "150.00"})

    run_finished(api, september, run_id="run-1")
    run_finished(api, september, run_id="run-2")

    assert kinds(api, september).count("budget_over") == 1
    assert sum(1 for m in pusher.sent if "budget" in m.title) == 1


def test_a_higher_threshold_alerts_after_a_lower_one(
    api: TestClient, september: SignedIn, database_url: str
) -> None:
    api.put("/v1/budgets/cash_withdrawal", headers=september.headers, json={"limit": "240.00"})
    run_finished(api, september, run_id="run-1")  # 200 of 240 = 83%: the 80% warning
    api.put("/v1/budgets/cash_withdrawal", headers=september.headers, json={"limit": "180.00"})

    run_finished(api, september, run_id="run-2")  # now 111%: over

    titles = [n["title"] for n in inbox(api, september)["items"] if n["kind"].startswith("budget")]
    assert sorted(titles) == ["Cash Withdrawal budget at 80%", "Cash Withdrawal budget is used up"]


def test_switched_off_alerts_stay_off(api: TestClient, september: SignedIn) -> None:
    api.put("/v1/budgets/cash_withdrawal", headers=september.headers, json={"limit": "150.00"})
    api.patch(
        "/v1/me",
        headers=september.headers,
        json={"settings": {"notify": {"budget": False, "recurring": False, "low_balance": False}}},
    )

    run_finished(api, september)

    assert kinds(api, september) == []


def test_data_ready_when_asked_for_and_sync_problems_always(api: TestClient, september: SignedIn) -> None:
    api.patch("/v1/me", headers=september.headers, json={"settings": {"notify": {"data_ready": True}}})

    run_finished(api, september, run_id="run-1")
    run_finished(api, september, status="failed", run_id="run-2")

    assert {"data_ready", "sync_problem"} <= set(kinds(api, september))


def test_dead_push_tokens_are_forgotten(
    api: TestClient, september: SignedIn, pusher: FakePusher, database_url: str
) -> None:
    pusher.dead = {"ExponentPushToken[phone]"}

    run_finished(api, september)

    rows = asyncio.run(
        fetch(database_url, "SELECT push_token FROM app.device WHERE id = :id", id=september.device_id)
    )
    assert rows == [(None,)]


def test_the_inbox(api: TestClient, september: SignedIn, data: SignedIn) -> None:
    run_finished(api, september)  # one new_recurring alert
    [only] = inbox(api, september)["items"]

    assert inbox(api, september)["unread"] == 1
    assert api.post(f"/v1/notifications/{only['id']}/read", headers=september.headers).status_code == 204
    assert inbox(api, september)["unread"] == 0
    assert inbox(api, september, unread_only="true")["items"] == []
    api.post("/v1/notifications/read-all", headers=september.headers)
    assert (
        api.post("/v1/notifications/ntf_" + "0" * 32 + "/read", headers=september.headers).status_code == 404
    )


def test_another_users_alerts_are_hidden(api: TestClient, september: SignedIn, sender: Any) -> None:
    from conftest import sign_in

    run_finished(api, september)
    [mine] = inbox(api, september)["items"]
    other = sign_in(api, sender, phone="0551234567")

    assert inbox(api, other)["items"] == []
    assert api.post(f"/v1/notifications/{mine['id']}/read", headers=other.headers).status_code == 404


def test_the_weekly_digest(
    api: TestClient, data: SignedIn, frozen_clock: Callable[[datetime], None], pusher: FakePusher
) -> None:
    monday = datetime(2026, 9, 7, 8, tzinfo=UTC)  # covers 31 Aug - 6 Sep: GHS 300 spent
    assert monday.isoweekday() == 1
    frozen_clock(monday)
    state = api.app.state  # type: ignore[attr-defined]
    assert api.portal is not None

    first = api.portal.call(alerts.weekly_digests, state.session_factory, state.push_sender, state.settings)
    again = api.portal.call(alerts.weekly_digests, state.session_factory, state.push_sender, state.settings)

    assert (first, again) == (2, 0)  # both users spent that week; each gets theirs, once
    [digest] = inbox(api, data)["items"]
    assert digest["body"].startswith("You spent GHS 300")  # not the other user's GHS 999
