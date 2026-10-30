"""The signed-in user: GET/PATCH/DELETE /v1/me."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from sikatrack_api.schemas.common import Money


class NotifySettings(BaseModel):
    budget: bool = True
    low_balance: bool = True
    recurring: bool = True
    weekly_digest: bool = True
    data_ready: bool = False


class UserSettings(BaseModel):
    low_balance_threshold: Money = Decimal("5.00")
    notify: NotifySettings = NotifySettings()
    # The account's currency, so the app formats money without guessing; Ghana only for now.
    currency: Literal["GHS"] = "GHS"


class Onboarding(BaseModel):
    wallets_added: bool = False
    sms_permission: Literal["unknown", "granted", "denied"] = "unknown"
    first_sync_done: bool = False


class DataSummary(BaseModel):
    first_transaction_at: datetime | None = None
    last_transaction_at: datetime | None = None
    transactions: int = 0


class MeOut(BaseModel):
    id: str = Field(examples=["usr_3f2a9c0e1b7d4c55a1e2f3a4b5c6d7e8"])
    phone_number: str | None = Field(
        examples=["+233241234567"], description="None when signed in with Google"
    )
    email: str | None = Field(default=None, description="From Google sign-in")
    display_name: str | None
    created_at: datetime
    onboarding: Onboarding
    settings: UserSettings
    data: DataSummary


class _Patch(BaseModel):
    model_config = ConfigDict(extra="forbid")  # a typo in a field name is an error, not ignored


class NotifyPatch(_Patch):
    budget: bool | None = None
    low_balance: bool | None = None
    recurring: bool | None = None
    weekly_digest: bool | None = None
    data_ready: bool | None = None


class SettingsPatch(_Patch):
    low_balance_threshold: Money | None = Field(default=None, ge=0, le=100000)
    notify: NotifyPatch | None = None


class OnboardingPatch(_Patch):
    sms_permission: Literal["granted", "denied"] | None = None


class MePatch(_Patch):
    """Only the fields you send change."""

    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    settings: SettingsPatch | None = None
    onboarding: OnboardingPatch | None = None


class DeletionOut(BaseModel):
    deletion_scheduled_for: datetime
