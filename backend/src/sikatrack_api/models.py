"""Tables in the backend's `app` schema (see docs/data-model.md). The warehouse's `dw` schema
isn't modelled here: the backend only reads it, through views, with plain SQL."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    MetaData,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "app"

# Named constraints, so migrations can refer to them and diffs stay stable
NAMING = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA, naming_convention=NAMING)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "user"
    __table_args__ = (CheckConstraint("status IN ('active', 'deleting')", name="status"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    # How the user signs in: a phone number (+233241234567) and/or a Google account
    phone_number: Mapped[str | None] = mapped_column(String(16), unique=True)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)  # Google's account ID
    email: Mapped[str | None] = mapped_column(String(254))  # from Google, when verified there
    display_name: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(12), server_default="active")  # active | deleting
    delete_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    onboarding: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    # Debounced "run the pipeline for this user" (see services/pipeline.py)
    pipeline_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OtpRequest(Base):
    __tablename__ = "otp_request"
    __table_args__ = (
        Index(None, "phone_number", "created_at"),  # rate limit per phone
        Index(None, "requested_ip", "created_at"),  # rate limit per IP
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    phone_number: Mapped[str] = mapped_column(String(16))
    code_hash: Mapped[str] = mapped_column(String(64))  # HMAC-SHA256 hex, never the code
    attempts: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_ip: Mapped[str | None] = mapped_column(INET)
    # sign_in, or wallet (proves the user holds a wallet's number): a code works only for its purpose
    purpose: Mapped[str] = mapped_column(String(10), server_default="sign_in")
    wallet_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("wallet.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = _created_at()


class Device(Base):
    __tablename__ = "device"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # made by the app
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(10))
    model: Mapped[str | None] = mapped_column(String(80))
    app_version: Mapped[str | None] = mapped_column(String(20))
    push_token: Mapped[str | None] = mapped_column(String(255))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()


class Session(Base):
    __tablename__ = "session"

    id: Mapped[uuid.UUID] = _uuid_pk()  # the access token's `sid` claim
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("device.id", ondelete="CASCADE"), index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    previous_token_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()


class AuditEvent(Base):
    __tablename__ = "audit_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), index=True
    )  # no FK: kept after deletion
    action: Mapped[str] = mapped_column(String(40))
    detail: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = _created_at()


MONEY = Numeric(14, 2)


class Wallet(Base):
    """One of the user's own mobile-money accounts. The pipeline uses these to recognise
    transfers between the user's own wallets (what OWNER_NAMES / OWNER_NUMBERS did before)."""

    __tablename__ = "wallet"
    __table_args__ = (UniqueConstraint("user_id", "provider_code", "phone_number"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    provider_code: Mapped[str] = mapped_column(String(30))
    phone_number: Mapped[str] = mapped_column(String(16))
    account_name: Mapped[str | None] = mapped_column(String(200))  # upper-cased, as in the SMS
    label: Mapped[str | None] = mapped_column(String(60))
    # When a code texted to this number was entered (or at once for the sign-in number). The
    # pipeline only treats verified wallets as the user's own.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()


class SmsBatch(Base):
    """One upload from the app: its idempotency key, counts, raw-zone object and progress."""

    __tablename__ = "sms_batch"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    device_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("device.id", ondelete="SET NULL"))
    idempotency_key: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    request_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(16))  # initial_scan | incremental | live
    raw_object_key: Mapped[str | None] = mapped_column(String(500))
    received: Mapped[int] = mapped_column()
    accepted: Mapped[int] = mapped_column()
    duplicates: Mapped[int] = mapped_column()
    latest_date_ms: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(
        String(12), server_default="received"
    )  # received|processing|loaded|failed
    pipeline_run_id: Mapped[str | None] = mapped_column(String(60))
    response: Mapped[dict[str, Any]] = mapped_column(JSONB)  # returned again for a repeated key
    created_at: Mapped[datetime] = _created_at()
    loaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SmsSeen(Base):
    """Every SMS a user has uploaded, by message ID: the duplicate check. No SMS text here."""

    __tablename__ = "sms_seen"
    __table_args__ = (PrimaryKeyConstraint("user_id", "message_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    message_id: Mapped[str] = mapped_column(String(16))
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sms_batch.id", ondelete="CASCADE"), index=True)
    date_ms: Mapped[int] = mapped_column(BigInteger)


class ProvisionalTransaction(Base):
    """An SMS parsed on upload, shown at once; removed when the pipeline has loaded its batch."""

    __tablename__ = "provisional_transaction"
    __table_args__ = (PrimaryKeyConstraint("user_id", "message_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    message_id: Mapped[str] = mapped_column(String(16))
    batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sms_batch.id", ondelete="CASCADE"), index=True)
    transaction_nk: Mapped[str] = mapped_column(String(80), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    provider_code: Mapped[str | None] = mapped_column(String(30))
    template: Mapped[str | None] = mapped_column(String(50))
    transaction_type: Mapped[str | None] = mapped_column(String(30))
    direction: Mapped[str | None] = mapped_column(String(6))
    amount: Mapped[Decimal | None] = mapped_column(MONEY)
    fee: Mapped[Decimal | None] = mapped_column(MONEY)
    tax: Mapped[Decimal | None] = mapped_column(MONEY)
    balance_after: Mapped[Decimal | None] = mapped_column(MONEY)
    counterparty: Mapped[str | None] = mapped_column(String(200))
    counterparty_kind: Mapped[str | None] = mapped_column(String(30))
    reference: Mapped[str | None] = mapped_column(String(255))
    is_own_transfer: Mapped[bool] = mapped_column(Boolean, server_default="false")
    category_name: Mapped[str | None] = mapped_column(String(50))
    category_rule: Mapped[str | None] = mapped_column(String(80))
    parse_status: Mapped[str] = mapped_column(String(10))  # parsed | unparsed | ignored


class PipelineEvent(Base):
    """A pipeline run finishing for a user (reported by the pipeline), for the app's sync status."""

    __tablename__ = "pipeline_event"
    __table_args__ = (Index(None, "user_id", "finished_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    run_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(10))  # succeeded | failed
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CategoryOverride(Base):
    """The user's own category (and/or note) for one transaction, keyed by its natural key, which
    is the same for the provisional and the final version and stable across pipeline runs."""

    __tablename__ = "category_override"
    __table_args__ = (PrimaryKeyConstraint("user_id", "transaction_nk"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    transaction_nk: Mapped[str] = mapped_column(String(80))
    category_name: Mapped[str | None] = mapped_column(String(50))  # None: only a note
    note: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CounterpartyPreference(Base):
    """A nickname for a counterparty, and the category for all its transactions."""

    __tablename__ = "counterparty_preference"
    __table_args__ = (PrimaryKeyConstraint("user_id", "counterparty_name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    counterparty_name: Mapped[str] = mapped_column(String(200))  # normalised, as in the warehouse
    alias: Mapped[str | None] = mapped_column(String(80))
    default_category: Mapped[str | None] = mapped_column(String(50))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RecurringPreference(Base):
    """What the user decided about a recurring series."""

    __tablename__ = "recurring_preference"
    __table_args__ = (PrimaryKeyConstraint("user_id", "recurring_series"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    recurring_series: Mapped[str] = mapped_column(String(20))
    user_state: Mapped[str | None] = mapped_column(String(16))  # expected | cancel_planned | not_recurring
    label: Mapped[str | None] = mapped_column(String(80))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Budget(Base):
    """A monthly spending limit for one category."""

    __tablename__ = "budget"
    __table_args__ = (UniqueConstraint("user_id", "category_name"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"), index=True)
    category_name: Mapped[str] = mapped_column(String(50))
    monthly_limit: Mapped[Decimal] = mapped_column(MONEY)
    alert_thresholds: Mapped[list[Decimal]] = mapped_column(ARRAY(Numeric(4, 3)))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Notification(Base):
    """An alert in the user's in-app inbox, also pushed to their phones.

    `dedupe_key` (unique per user) makes "one alert per threshold per month" a database
    guarantee: a second attempt to create the same alert does nothing.
    """

    __tablename__ = "notification"
    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key"),
        Index(None, "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(500))
    link: Mapped[str | None] = mapped_column(String(200))
    dedupe_key: Mapped[str] = mapped_column(String(120))
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()


class RateLimitCounter(Base):
    """Requests per key (a user or an IP address) per fixed window. Shared by every API
    instance, so the limit holds however many are running. Old windows are cleared hourly."""

    __tablename__ = "rate_limit_counter"
    __table_args__ = (PrimaryKeyConstraint("key", "window_start"),)

    key: Mapped[str] = mapped_column(String(80))
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column()
