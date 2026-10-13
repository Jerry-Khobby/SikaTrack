import asyncio
import base64
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import boto3
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from moto import mock_aws
from sqlalchemy import make_url

from database import execute, migrate, scratch_database
from sikatrack_api import clock
from sikatrack_api.config import Settings
from sikatrack_api.dependencies import get_readiness_checks
from sikatrack_api.main import create_app
from sikatrack_api.services.readiness import DependencyCheck
from warehouse_seed import WAREHOUSE_RESET, Row, seed

APP_TABLES = (
    "app.audit_event, app.otp_request, app.session, app.device, app.user, app.wallet, "
    "app.sms_batch, app.sms_seen, app.provisional_transaction, app.pipeline_event, "
    "app.category_override, app.counterparty_preference, app.recurring_preference, app.budget, "
    "app.notification, app.rate_limit_counter"
)
INTERNAL_TOKEN = "test-internal-token-that-is-at-least-32-chars"


@pytest.fixture
def settings() -> Settings:
    """Settings that never come from a developer's .env, so tests behave the same everywhere."""
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        environment="test",
        database_password="unused",  # type: ignore[arg-type]
        s3_access_key="unused",  # type: ignore[arg-type]
        s3_secret_key="unused",  # type: ignore[arg-type]
        jwt_secret="test-jwt-secret-that-is-at-least-32-chars",  # type: ignore[arg-type]
        otp_pepper="test-otp-pepper-that-is-at-least-32-chars",  # type: ignore[arg-type]
        internal_api_token=INTERNAL_TOKEN,  # type: ignore[arg-type]
        pipeline_scheduler_enabled=False,  # tests call the scheduler pass directly
        rate_limit_enabled=False,  # test_security.py switches them on
        readiness_timeout=0.2,
    )


def check(name: str, behaviour: str = "ok") -> DependencyCheck:
    """A fake dependency: 'ok' answers, 'error' raises, 'hang' never answers."""

    async def probe() -> None:
        if behaviour == "error":
            raise ConnectionRefusedError("connect to warehouse:5432 refused")  # must not leak
        if behaviour == "hang":
            await asyncio.sleep(10)

    return DependencyCheck(name, probe)


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def make_client(app: FastAPI) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def _make(*checks: DependencyCheck) -> TestClient:
        app.dependency_overrides[get_readiness_checks] = lambda: list(checks)
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()  # runs the lifespan, as in production
        clients.append(client)
        return client

    yield _make
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client(check("database"), check("object_store"))


# ---- with a real database -------------------------------------------------------------


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """One migrated scratch database for the whole run (tables are emptied between tests)."""
    with scratch_database() as url:
        migrate(url)
        yield url


@dataclass
class CapturingSender:
    """Stands in for the SMS provider: keeps the codes so tests can sign in."""

    sent: list[tuple[str, str]] = field(default_factory=list)

    async def send(self, phone_e164: str, code: str) -> None:
        self.sent.append((phone_e164, code))

    def last_code(self) -> str:
        return self.sent[-1][1]


@pytest.fixture
def db_settings(settings: Settings, database_url: str) -> Settings:
    url = make_url(database_url)
    return settings.model_copy(
        update={
            "database_host": url.host,
            "database_port": url.port,
            "database_name": url.database,
            "database_user": url.username,
            "database_password": settings.database_password.__class__(url.password or ""),
        }
    )


@pytest.fixture
def sender() -> CapturingSender:
    return CapturingSender()


@dataclass
class FakeTrigger:
    """Stands in for Airflow: records which users a run was started for."""

    triggered: list[uuid.UUID] = field(default_factory=list)
    fail: bool = False

    async def trigger(self, user_id: uuid.UUID) -> str:
        if self.fail:
            raise ConnectionError("airflow is down")
        self.triggered.append(user_id)
        return f"api__{user_id.hex[:8]}__{len(self.triggered)}"


@pytest.fixture
def trigger() -> FakeTrigger:
    return FakeTrigger()


@dataclass
class FakePusher:
    """Stands in for Expo: records what would be pushed; can report tokens as dead."""

    sent: list[Any] = field(default_factory=list)
    dead: set[str] = field(default_factory=set)

    async def send(self, messages: list[Any]) -> set[str]:
        self.sent.extend(messages)
        return {m.token for m in messages} & self.dead


@pytest.fixture
def pusher() -> FakePusher:
    return FakePusher()


@pytest.fixture
def raw_bucket() -> Iterator[Any]:
    """The raw zone on moto's in-memory S3, standing in for RustFS."""
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="sikatrack-raw")
        s3.create_bucket(Bucket="sikatrack-processed")
        yield s3


@pytest.fixture
def client_address() -> tuple[str, int]:
    """Where test requests come from. Starlette's default isn't an IP address, so per-IP
    limits ignore it; test_security.py overrides this with a real one."""
    return ("testclient", 50000)


@pytest.fixture
def api(
    client_address: tuple[str, int],
    db_settings: Settings,
    database_url: str,
    sender: CapturingSender,
    trigger: FakeTrigger,
    pusher: FakePusher,
    raw_bucket: Any,
) -> Iterator[TestClient]:
    """The API on a real (empty) database, with fakes for SMS codes, S3 and Airflow."""
    asyncio.run(execute(database_url, f"TRUNCATE {APP_TABLES} CASCADE", *WAREHOUSE_RESET))
    application = create_app(db_settings)
    application.state.otp_sender = sender
    application.state.pipeline_trigger = trigger
    application.state.push_sender = pusher
    with TestClient(application, raise_server_exceptions=False, client=client_address) as test_client:
        application.state.s3 = raw_bucket  # after startup, which made a client for the real RustFS
        yield test_client


@dataclass
class SignedIn:
    """A signed-in test user: their tokens, ready-made headers and device."""

    access_token: str
    refresh_token: str
    user_id: str
    device_id: str
    phone: str

    @property
    def uuid(self) -> str:
        """The user's ID as the warehouse stores it."""
        return str(uuid.UUID(hex=self.user_id.removeprefix("usr_")))

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


def sign_in(api: TestClient, sender: CapturingSender, phone: str = "0241234567", **device: str) -> SignedIn:
    otp = api.post("/v1/auth/otp/request", json={"phone_number": phone})
    assert otp.status_code == 202, otp.text
    device_info = {"device_id": str(uuid.uuid4()), "platform": "android", "app_version": "1.0.0", **device}
    verified = api.post(
        "/v1/auth/otp/verify",
        json={
            "otp_request_id": otp.json()["otp_request_id"],
            "code": sender.last_code(),
            "device": device_info,
        },
    )
    assert verified.status_code == 200, verified.text
    body = verified.json()
    return SignedIn(
        body["access_token"], body["refresh_token"], body["user"]["id"], device_info["device_id"], phone
    )


@pytest.fixture
def user(api: TestClient, sender: CapturingSender) -> SignedIn:
    return sign_in(api, sender)


@dataclass
class Clock:
    """The API's clock in tests: real time plus an offset you can move forward."""

    offset: timedelta = timedelta(0)

    def advance(self, **delta: float) -> None:
        self.offset += timedelta(**delta)


@pytest.fixture
def fake_clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    state = Clock()
    real = clock.utcnow
    monkeypatch.setattr(clock, "utcnow", lambda: real() + state.offset)
    return state


# ---- a small warehouse whose every number can be checked by hand (see test_reads.py) ----


SERIES = "abc123abc123"
SEPTEMBER = {"month": "2026-09"}


@pytest.fixture
def data(api: TestClient, user: SignedIn, sender: CapturingSender, database_url: str) -> SignedIn:
    seed(database_url, user.uuid, [
        Row("a1", "2026-08-05T10:00:00+00:00", "100.00", category="Food", balance="400.00"),
        Row("a2", "2026-08-20T19:00:00+00:00", "300.00", direction="credit", category="Income",
            counterparty="KOFI MENSAH", kind="person", rule="money_in:transfer", balance="700.00"),
        Row("s1", "2026-09-01T08:00:00+00:00", "50.00", type="airtime", category="Airtime/Data",
            counterparty="MTN BUNDLE", kind="telco", series=SERIES, interval=1, balance="650.00",
            rule="type:airtime"),
        Row("s2", "2026-09-02T08:00:00+00:00", "50.00", type="airtime", category="Airtime/Data",
            counterparty="MTN BUNDLE", kind="telco", series=SERIES, interval=1, balance="600.00",
            rule="type:airtime"),
        Row("s3", "2026-09-03T13:00:00+00:00", "200.00", type="cashout", category="Cash Withdrawal",
            counterparty="AGENT X", kind="agent", fee="2.00", balance="398.00", rule="type:cashout"),
        Row("s4", "2026-09-05T12:00:00+00:00", "100.00", category="Own Transfers", counterparty="OWN WALLET",
            kind="own_wallet", own=True, balance="298.00", rule="own:transfer"),
        Row("s5", "2026-09-06T20:00:00+00:00", "80.00", direction="credit", category="Income",
            counterparty="AMA SERWAA", kind="person", balance="378.00", rule="money_in:transfer"),
    ])  # fmt: skip
    other = sign_in(api, sender, phone="0201234567")
    seed(database_url, other.uuid, [
        Row("b1", "2026-09-04T09:00:00+00:00", "999.00", counterparty="SECRET SHOP", balance="1.00"),
    ])  # fmt: skip
    return user


def ids_of(page: dict[str, Any]) -> list[str]:
    return [item["id"] for item in page["items"]]


def txn(nk: str) -> str:
    """The public ID of the transaction with this natural key."""
    return "txn_" + base64.urlsafe_b64encode(nk.encode()).decode().rstrip("=")


@pytest.fixture
def frozen_clock(monkeypatch: pytest.MonkeyPatch) -> Callable[[datetime], None]:
    """Set the API's clock to a fixed moment: freeze(datetime(2026, 9, 10, 12, tzinfo=UTC))."""

    def freeze(moment: datetime) -> None:
        monkeypatch.setattr(clock, "utcnow", lambda: moment)

    return freeze
