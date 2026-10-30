"""Sign-in: /v1/auth/*."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from sikatrack_api.schemas.common import AppVersion
from sikatrack_api.schemas.me import MeOut


class OtpRequestIn(BaseModel):
    phone_number: str = Field(min_length=9, max_length=20, examples=["0241234567"])


class OtpRequestOut(BaseModel):
    otp_request_id: str
    expires_in: int = Field(description="Seconds until the code expires")
    resend_after: int = Field(description="Seconds before asking for another code")


class DeviceIn(BaseModel):
    device_id: uuid.UUID = Field(description="Generated once by the app and kept")
    platform: Literal["android"]
    app_version: AppVersion
    model: str | None = Field(default=None, max_length=80)


class OtpVerifyIn(BaseModel):
    otp_request_id: str = Field(max_length=40)
    code: str = Field(pattern=r"^\d{6}$")
    device: DeviceIn


class GoogleSignInIn(BaseModel):
    id_token: str = Field(min_length=20, max_length=4096, description="The ID token Google gave the app")
    device: DeviceIn


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["Bearer"] = "Bearer"  # noqa: S105 (a scheme name, not a password)
    expires_in: int = Field(description="Seconds until the access token expires")


class SignInOut(TokenPair):
    is_new_user: bool
    user: MeOut


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=100)
