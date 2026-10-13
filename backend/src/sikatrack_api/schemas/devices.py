"""Phones: /v1/devices/{device_id}."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from sikatrack_api.schemas.common import AppVersion


class DevicePut(BaseModel):
    platform: Literal["android"]
    app_version: AppVersion
    push_token: str | None = Field(default=None, max_length=255, examples=["ExponentPushToken[xxxx]"])


class DeviceOut(BaseModel):
    device_id: uuid.UUID
    platform: str
    app_version: str | None
    push_enabled: bool
    last_seen_at: datetime | None
