"""The user's own changes: categories, nicknames, recurring decisions, budgets."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from conftest import SEPTEMBER, SERIES, SignedIn, txn
from database import fetch

pytestmark = pytest.mark.integration


def test_a_corrected_category_shows_at_once_and_in_the_totals(api: TestClient, data: SignedIn) -> None:
    response = api.patch(f"/v1/transactions/{txn('s3')}", headers=data.headers, json={"category": "food"})

    body = response.json()
    assert response.status_code == 200
    assert (body["category"]["id"], body["category_source"]) == ("food", "user")
    assert body["category_explanation"] == "You chose this category"
    categories = api.get("/v1/summary/categories", headers=data.headers, params=SEPTEMBER).json()
    assert [c["category"]["id"] for c in categories["items"]] == ["food", "airtime_data"]


def test_removing_a_correction_goes_back_to_the_rule(
    api: TestClient, data: SignedIn, database_url: str
) -> None:
    api.patch(f"/v1/transactions/{txn('s3')}", headers=data.headers, json={"category": "food"})

    body = api.patch(f"/v1/transactions/{txn('s3')}", headers=data.headers, json={"category": None}).json()

    assert (body["category"]["id"], body["category_source"]) == ("cash_withdrawal", "rule")
    assert asyncio.run(fetch(database_url, "SELECT count(*) FROM app.category_override")) == [(0,)]


def test_a_note_alone_keeps_the_rule(api: TestClient, data: SignedIn) -> None:
    body = api.patch(
        f"/v1/transactions/{txn('s1')}", headers=data.headers, json={"note": "Data for work"}
    ).json()

    assert (body["note"], body["category_source"]) == ("Data for work", "rule")


def test_applying_to_the_counterparty_sets_its_default(api: TestClient, data: SignedIn) -> None:
    api.patch(
        f"/v1/transactions/{txn('s1')}",
        headers=data.headers,
        json={"category": "bills", "apply_to_counterparty": True},
    )

    other = api.get(f"/v1/transactions/{txn('s2')}", headers=data.headers).json()  # same counterparty
    assert (other["category"]["id"], other["category_source"]) == ("bills", "counterparty_default")


@pytest.mark.parametrize("category", ["own_transfers", "uncategorized", "crypto"])
def test_only_choosable_categories(api: TestClient, data: SignedIn, category: str) -> None:
    response = api.patch(f"/v1/transactions/{txn('s3')}", headers=data.headers, json={"category": category})

    assert response.status_code == 400
    assert response.json()["errors"][0]["field"] == "category"


def test_corrections_schedule_the_pipeline(api: TestClient, data: SignedIn, database_url: str) -> None:
    api.patch(f"/v1/transactions/{txn('s3')}", headers=data.headers, json={"category": "food"})

    assert asyncio.run(
        fetch(database_url, "SELECT pipeline_due_at IS NOT NULL FROM app.user WHERE id = :id", id=data.uuid)
    ) == [(True,)]


def test_another_users_transaction_cant_be_changed(api: TestClient, data: SignedIn) -> None:
    response = api.patch(f"/v1/transactions/{txn('b1')}", headers=data.headers, json={"category": "food"})

    assert response.status_code == 404


def test_a_nickname_replaces_the_sms_name(api: TestClient, data: SignedIn) -> None:
    people = api.get("/v1/counterparties", headers=data.headers, params={"q": "kofi"}).json()
    kofi = people["items"][0]["id"]

    response = api.patch(f"/v1/counterparties/{kofi}", headers=data.headers, json={"alias": "Uncle Kofi"})

    assert response.json()["name"] == "Uncle Kofi"
    assert response.json()["original_name"] == "KOFI MENSAH"
    august = api.get(
        "/v1/transactions", headers=data.headers, params={"from": "2026-08-01", "to": "2026-08-31"}
    )
    assert any(
        t["counterparty"] and t["counterparty"]["name"] == "Uncle Kofi" for t in august.json()["items"]
    )


def test_another_users_counterparty_is_not_found(api: TestClient, data: SignedIn) -> None:
    import base64

    secret = "cpt_" + base64.urlsafe_b64encode(b"SECRET SHOP").decode().rstrip("=")

    assert (
        api.patch(f"/v1/counterparties/{secret}", headers=data.headers, json={"alias": "x"}).status_code
        == 404
    )


def test_a_false_recurring_match_is_hidden_and_costs_nothing(api: TestClient, data: SignedIn) -> None:
    response = api.patch(
        f"/v1/recurring/rec_{SERIES}", headers=data.headers, json={"user_state": "not_recurring"}
    )

    assert response.json()["user_state"] == "not_recurring"
    listed = api.get("/v1/recurring", headers=data.headers).json()
    assert (listed["items"], listed["monthly_cost"]) == ([], "0.00")
    summary = api.get("/v1/summary", headers=data.headers, params=SEPTEMBER).json()
    assert summary["recurring_monthly_cost"] == "0.00"


def test_recurring_labels_and_plans(api: TestClient, data: SignedIn) -> None:
    body = api.patch(
        f"/v1/recurring/rec_{SERIES}",
        headers=data.headers,
        json={"user_state": "cancel_planned", "label": "Old data bundle"},
    ).json()

    assert (body["label"], body["user_state"], body["monthly_cost"]) == (
        "Old data bundle",
        "cancel_planned",
        "1500.00",
    )


def test_budgets(api: TestClient, data: SignedIn) -> None:
    put = api.put("/v1/budgets/cash_withdrawal", headers=data.headers, json={"limit": "150.00"})
    assert put.status_code == 200
    assert put.json()["alert_thresholds"] == ["0.800", "1.000"]

    september = api.get("/v1/budgets", headers=data.headers, params=SEPTEMBER).json()
    [budget] = september["items"]
    assert (budget["spent"], budget["remaining"], budget["used"], budget["state"]) == (
        "200.00", "0.00", "1.333", "over",
    )  # fmt: skip
    categories = api.get("/v1/summary/categories", headers=data.headers, params=SEPTEMBER).json()
    assert categories["items"][0]["budget"] == {"limit": "150.00", "used": "1.333"}

    assert api.delete("/v1/budgets/cash_withdrawal", headers=data.headers).status_code == 204
    assert api.delete("/v1/budgets/cash_withdrawal", headers=data.headers).status_code == 404


@pytest.mark.parametrize(
    "body", [{"limit": "0.00"}, {"limit": 150.5}, {"limit": "150.00", "alert_thresholds": []}]
)
def test_bad_budgets_are_refused(api: TestClient, data: SignedIn, body: dict[str, object]) -> None:
    assert api.put("/v1/budgets/food", headers=data.headers, json=body).status_code == 400
