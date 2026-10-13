"""Config, wallets, SMS uploads and sync status."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from sikatrack_api.schemas.common import Money


class ProviderInfo(BaseModel):
    code: str
    name: str
    senders: list[str]
    supported: bool


class ConfigLimits(BaseModel):
    sms_batch_max_messages: int
    sms_batch_max_bytes: int


class ConfigOut(BaseModel):
    min_app_version: str
    momo_senders: list[str] = Field(description="Upload SMS from these senders only; filter on the phone")
    providers: list[ProviderInfo]
    limits: ConfigLimits
    features: dict[str, bool]


# ---- wallets -------------------------------------------------------------------------


class WalletIn(BaseModel):
    provider: str = Field(examples=["mtn_momo"])
    phone_number: str = Field(min_length=9, max_length=20, examples=["0241234567"])
    account_name: str | None = Field(
        default=None, max_length=200, description="Your name exactly as it appears in your MoMo SMS"
    )
    label: str | None = Field(default=None, max_length=60, examples=["Main MoMo"])


class WalletPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_name: str | None = Field(default=None, max_length=200)
    label: str | None = Field(default=None, max_length=60)


class WalletOut(BaseModel):
    id: str
    provider: str
    phone_number: str
    account_name: str | None
    label: str | None
    latest_balance: Money | None = None
    balance_as_of: datetime | None = None
    created_at: datetime


class WalletList(BaseModel):
    items: list[WalletOut]


# ---- SMS uploads ---------------------------------------------------------------------


class SmsIn(BaseModel):
    sender: str = Field(
        min_length=1, max_length=40, description="The SMS address exactly as Android stores it"
    )
    date_ms: str = Field(
        pattern=r"^\d{10,15}$",
        description="Android's `date` column as digits (ms since 1970). Part of the message ID: "
        "send it unchanged",
    )
    body: str = Field(min_length=1, max_length=2000)
    android_id: int | None = Field(default=None, description="Android's _id; for the app's bookkeeping only")


class SmsBatchIn(BaseModel):
    device_id: uuid.UUID
    source: Literal["initial_scan", "incremental", "live"]
    messages: list[SmsIn] = Field(min_length=1)


class SyncHint(BaseModel):
    latest_date_ms: str | None
    pipeline: Literal["scheduled", "not_needed"]


class SmsBatchOut(BaseModel):
    batch_id: str
    received: int
    accepted: int = Field(description="New MoMo SMS stored")
    duplicates: int = Field(description="Already uploaded before (or twice in this batch)")
    rejected_senders: int = Field(description="Not from a MoMo sender: dropped, not stored")
    parsed: int
    unparsed: int
    ignored: int = Field(description="OTPs, failed transactions, promotions")
    provisional_transactions: int
    sync: SyncHint


class SmsBatchStatus(BaseModel):
    batch_id: str
    status: Literal["received", "processing", "loaded", "failed"]
    received_at: datetime
    accepted: int
    loaded_at: datetime | None


class PipelineRunInfo(BaseModel):
    status: Literal["succeeded", "failed"]
    finished_at: datetime


class SyncStatus(BaseModel):
    latest_date_ms: str | None = Field(description="Scan for SMS newer than this (minus ~10 minutes)")
    last_upload_at: datetime | None
    pending_messages: int = Field(description="Uploaded, not yet processed by the pipeline")
    provisional_transactions: int
    last_pipeline_run: PipelineRunInfo | None
    data_through: datetime | None = Field(description="Latest transaction in your confirmed data")


# ---- internal ------------------------------------------------------------------------


class PipelineEventIn(BaseModel):
    run_id: str = Field(max_length=100)
    user_id: uuid.UUID
    status: Literal["succeeded", "failed"]
    started_at: datetime
    finished_at: datetime
