"""The read API on a small warehouse whose every number can be checked by hand.

August: GHS 100 spent, GHS 300 received.
September: a daily GHS 50 bundle (twice), a GHS 200 cash-out with a GHS 2 fee, a GHS 100
transfer to the user's own wallet (not spending), GHS 80 received.
Another user has a GHS 999 payment that must never appear.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from conftest import SEPTEMBER, SERIES, SignedIn, ids_of, txn

pytestmark = pytest.mark.integration

# ---- transactions ----------------------------------------------------------------------


def test_transactions_newest_first_without_own_transfers(api: TestClient, data: SignedIn) -> None:
    page = api.get(
        "/v1/transactions", headers=data.headers, params={"from": "2026-09-01", "to": "2026-09-30"}
    ).json()

    assert ids_of(page) == [txn("s5"), txn("s3"), txn("s2"), txn("s1")]
    s3 = page["items"][1]
    assert (s3["amount"], s3["fee"], s3["direction"], s3["status"]) == ("200.00", "2.00", "out", "final")
    assert s3["category"] == {"id": "cash_withdrawal", "name": "Cash Withdrawal", "group": "spending"}
    assert s3["counterparty"]["name"] == "Agent X"


def test_own_transfers_on_request_and_filters(api: TestClient, data: SignedIn) -> None:
    sep = {"from": "2026-09-01", "to": "2026-09-30"}
    get = lambda **p: api.get("/v1/transactions", headers=data.headers, params={**sep, **p}).json()  # noqa: E731

    assert len(get(include_own_transfers="true")["items"]) == 5
    assert ids_of(get(direction="in")) == [txn("s5")]
    assert ids_of(get(category="cash_withdrawal")) == [txn("s3")]
    assert ids_of(get(q="bundle")) == [txn("s2"), txn("s1")]
    assert ids_of(get(min_amount="100")) == [txn("s3")]


def test_pages_follow_the_cursor(api: TestClient, data: SignedIn) -> None:
    params = {"from": "2026-08-01", "to": "2026-09-30", "limit": 2}
    seen, cursor = [], None
    while True:
        page = api.get(
            "/v1/transactions",
            headers=data.headers,
            params={**params, **({"cursor": cursor} if cursor else {})},
        ).json()
        seen += ids_of(page)
        cursor = page["next_cursor"]
        if cursor is None:
            break

    assert seen == [txn(n) for n in ("s5", "s3", "s2", "s1", "a2", "a1")]


def test_another_users_data_never_appears(api: TestClient, data: SignedIn) -> None:
    page = api.get(
        "/v1/transactions", headers=data.headers, params={"from": "2026-01-01", "to": "2026-12-31"}
    ).json()

    assert txn("b1") not in ids_of(page)
    assert api.get(f"/v1/transactions/{txn('b1')}", headers=data.headers).status_code == 404
    assert "999" not in api.get("/v1/summary", headers=data.headers, params=SEPTEMBER).text


def test_a_transaction_with_its_sms_and_why_its_category(api: TestClient, data: SignedIn) -> None:
    detail = api.get(f"/v1/transactions/{txn('s3')}", headers=data.headers).json()

    assert detail["sms_text"] == "SMS for s3"
    assert detail["category_explanation"] == "Every cashout transaction goes here"
    assert api.get("/v1/transactions/txn_bm9wZQ", headers=data.headers).status_code == 404
    assert api.get("/v1/transactions/not-an-id", headers=data.headers).status_code == 404


def test_just_uploaded_sms_show_as_provisional(api: TestClient, data: SignedIn) -> None:
    from sms_samples import samples as s

    api.post(
        "/v1/sms/batches",
        headers={**data.headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"device_id": data.device_id, "source": "live",
              "messages": [{"sender": s.MTN, "date_ms": "1790000000000", "body": s.PAYMENT_MADE}]},
    )  # fmt: skip

    page = api.get(
        "/v1/transactions", headers=data.headers, params={"from": "2026-09-01", "to": "2026-12-31"}
    ).json()

    assert page["items"][0]["status"] == "provisional"
    assert page["items"][0]["amount"] == "16.50"


# ---- summaries -------------------------------------------------------------------------


def test_the_home_summary(api: TestClient, data: SignedIn) -> None:
    body = api.get("/v1/summary", headers=data.headers, params=SEPTEMBER).json()

    assert (body["money_out"], body["money_in"], body["net"], body["fees"]) == (
        "300.00",
        "80.00",
        "-220.00",
        "2.00",
    )
    assert body["spending_transactions"] == 3
    assert body["avg_daily_spend"] == "50.00"  # 300 over the 6 September days inside the data
    assert body["compare"]["money_out"] == "100.00"  # the 30 days before: August's GHS 100
    assert body["compare"]["money_out_change"] == "2.000"
    assert body["top_category"] == {"id": "cash_withdrawal", "name": "Cash Withdrawal", "share": "0.667"}
    assert body["recurring_monthly_cost"] == "1500.00"  # GHS 50 a day, still active
    assert body["period"] == {"from": "2026-09-01", "to": "2026-09-30", "days": 30}


def test_categories_trend_counterparties_and_habits(api: TestClient, data: SignedIn) -> None:
    categories = api.get("/v1/summary/categories", headers=data.headers, params=SEPTEMBER).json()
    trend = api.get(
        "/v1/summary/trend", headers=data.headers, params={"from": "2026-08-01", "to": "2026-09-30"}
    ).json()
    people = api.get("/v1/summary/counterparties", headers=data.headers, params=SEPTEMBER).json()
    habits = api.get("/v1/summary/habits", headers=data.headers, params=SEPTEMBER).json()

    assert [(c["category"]["id"], c["amount"], c["share"]) for c in categories["items"]] == [
        ("cash_withdrawal", "200.00", "0.667"),
        ("airtime_data", "100.00", "0.333"),
    ]
    assert trend["items"] == [
        {"period": "2026-08", "money_out": "100.00", "money_in": "300.00", "fees": "0.00"},
        {"period": "2026-09", "money_out": "300.00", "money_in": "80.00", "fees": "2.00"},
    ]
    assert [(p["counterparty"]["name"], p["amount"]) for p in people["items"]] == [
        ("Agent X", "200.00"),
        ("Mtn Bundle", "100.00"),
    ]
    assert habits["median_payment"] == "50.00"
    assert len(habits["by_hour"]) == 24
    assert habits["peak"]["day_part"] == "afternoon"  # the 13:00 cash-out


def test_bad_periods_are_refused(api: TestClient, data: SignedIn) -> None:
    for params in ({"month": "2026-13"}, {"from": "2026-09-30", "to": "2026-09-01"}):
        response = api.get("/v1/summary", headers=data.headers, params=params)
        assert response.status_code == 400, params


# ---- balances, catalogue, recurring, insights ------------------------------------------


def test_balances_now_and_over_time(api: TestClient, data: SignedIn) -> None:
    api.patch("/v1/me", headers=data.headers, json={"settings": {"low_balance_threshold": "500.00"}})

    latest = api.get("/v1/balances", headers=data.headers).json()
    history = api.get(
        "/v1/balances/history", headers=data.headers, params={"from": "2026-09-01", "to": "2026-09-30"}
    ).json()

    assert latest["total"] == "378.00"
    assert [(d["date"], d["balance"]) for d in history["items"]] == [
        ("2026-09-01", "650.00"),
        ("2026-09-02", "600.00"),
        ("2026-09-03", "398.00"),
        ("2026-09-04", "398.00"),
        ("2026-09-05", "298.00"),
        ("2026-09-06", "378.00"),
    ]  # fmt: skip  (carried forward on the 4th; stops at the last data day)
    assert (history["days_below_threshold"], history["threshold"]) == (4, "500.00")


def test_categories_and_counterparties(api: TestClient, data: SignedIn) -> None:
    categories = {c["id"]: c for c in api.get("/v1/categories", headers=data.headers).json()["items"]}
    people = api.get("/v1/counterparties", headers=data.headers).json()

    assert categories["airtime_data"]["user_selectable"] is True
    assert categories["own_transfers"]["user_selectable"] is False
    names = [p["original_name"] for p in people["items"]]
    assert names[:2] == ["AGENT X", "MTN BUNDLE"]  # biggest spending first
    assert "SECRET SHOP" not in names


def test_recurring_series(api: TestClient, data: SignedIn) -> None:
    body = api.get("/v1/recurring", headers=data.headers).json()

    [series] = body["items"]
    assert series["id"] == f"rec_{SERIES}"
    assert (series["rhythm"], series["typical_amount"], series["payments"], series["status"]) == (
        "daily", "50.00", 2, "active",
    )  # fmt: skip
    assert body["monthly_cost"] == "1500.00"
    payments = api.get(f"/v1/recurring/rec_{SERIES}/transactions", headers=data.headers).json()
    assert ids_of(payments) == [txn("s2"), txn("s1")]
    assert api.get("/v1/recurring/rec_ffffffffffff", headers=data.headers).status_code == 404


def test_insights(api: TestClient, data: SignedIn) -> None:
    cards = {
        c["id"]: c for c in api.get("/v1/insights", headers=data.headers, params=SEPTEMBER).json()["items"]
    }

    assert cards["spending_up"]["severity"] == "warning"
    assert cards["fees_cashout"]["body"].startswith("100% of your fees come from cash-outs")
    assert cards["top_category"]["title"] == "Cash Withdrawal leads"
    assert "GHS 1,500 a month" in cards["recurring"]["body"]


def test_me_and_sync_show_the_confirmed_data(api: TestClient, data: SignedIn) -> None:
    me = api.get("/v1/me", headers=data.headers).json()
    sync = api.get("/v1/sync/status", headers=data.headers).json()

    assert me["data"]["transactions"] == 7
    assert me["data"]["first_transaction_at"].startswith("2026-08-05")
    assert sync["data_through"].startswith("2026-09-06")


def test_wallets_show_their_latest_balance(api: TestClient, data: SignedIn) -> None:
    api.post("/v1/wallets", headers=data.headers, json={"provider": "mtn_momo", "phone_number": "0240000001"})

    [wallet] = api.get("/v1/wallets", headers=data.headers).json()["items"]

    assert wallet["latest_balance"] == "378.00"
