"""Settings, read once from the environment (and backend/.env in development)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", frozen=True)

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Postgres: the warehouse server, where the backend owns the `app` schema
    database_host: str = "localhost"
    database_port: int = 5434
    database_name: str = "sikatrack_dw"
    database_user: str = "sikatrack_api"
    database_password: SecretStr
    database_pool_size: int = Field(default=5, ge=1, le=50)
    database_connect_timeout: float = Field(default=3.0, gt=0)

    # Object store: the RustFS data lake (S3 API)
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: SecretStr
    s3_secret_key: SecretStr
    s3_region: str = "us-east-1"
    raw_bucket: str = "sikatrack-raw"
    processed_bucket: str = "sikatrack-processed"

    # How long /ready waits for each dependency before calling it down
    readiness_timeout: float = Field(default=2.0, gt=0)

    # Tokens: short-lived JWT access tokens, long-lived rotating refresh tokens
    jwt_secret: SecretStr = Field(min_length=32)
    jwt_issuer: str = "sikatrack-api"
    access_token_ttl_s: int = Field(default=900, ge=60)
    refresh_token_ttl_days: int = Field(default=30, ge=1)

    # Sign in with Google: the OAuth client IDs (comma-separated) whose ID tokens are accepted,
    # i.e. the Web client ID the app passes to Google. Empty: Google sign-in is off.
    google_client_ids: str = ""
    # Wallets: "code" = a number other than the sign-in one needs a code texted to it; "trust" =
    # every wallet counts at once (when no SMS can be sent, e.g. Google sign-in and no SMS sender)
    wallet_verification: Literal["code", "trust"] = "code"

    # One-time sign-in codes
    otp_pepper: SecretStr = Field(min_length=32)  # server secret mixed into every code hash
    otp_provider: Literal["console", "arkesel", "twilio", "disabled"] = "console"
    # Arkesel (OTP_PROVIDER=arkesel), a Ghanaian SMS gateway topped up with mobile money: the
    # API key from its dashboard, and the sender ID registered there (at most 11 characters)
    arkesel_api_key: SecretStr | None = None
    arkesel_sender: str | None = Field(default=None, max_length=11)
    # Twilio (OTP_PROVIDER=twilio): the account, and who the SMS comes from: an approved
    # alphanumeric sender ID or a Twilio number (TWILIO_FROM), or a messaging service
    twilio_account_sid: str | None = None
    twilio_auth_token: SecretStr | None = None
    twilio_from: str | None = None
    twilio_messaging_service_sid: str | None = None
    otp_message: str = "Your SikaTrack code is {code}. It expires in 5 minutes. Never share it."
    otp_ttl_s: int = Field(default=300, ge=60)
    otp_max_attempts: int = Field(default=5, ge=1)
    otp_resend_after_s: int = Field(default=60, ge=0)
    otp_max_per_phone: int = Field(default=3, ge=1)  # per otp_phone_window_s
    otp_phone_window_s: int = Field(default=600, ge=60)
    otp_max_per_ip: int = Field(default=20, ge=1)  # per hour

    # Rate limits for every endpoint, per minute (sign-in and uploads have tighter ones of their own)
    rate_limit_enabled: bool = True
    rate_limit_per_user: int = Field(default=120, ge=1)
    rate_limit_per_ip: int = Field(default=30, ge=1)  # endpoints used before signing in

    # Accounts
    account_deletion_grace_days: int = Field(default=7, ge=0)
    min_app_version: str = "1.0.0"

    # SMS uploads
    sms_batch_max_messages: int = Field(default=500, ge=1)
    sms_batch_max_bytes: int = Field(default=1_048_576, ge=1024)
    sms_batches_per_hour: int = Field(default=60, ge=1)

    # The pipeline: triggered through Airflow's REST API, debounced per user
    airflow_url: str = "http://localhost:8080"
    airflow_username: str = "admin"
    airflow_password: SecretStr | None = None  # unset: runs aren't triggered (the daily run still happens)
    airflow_dag_id: str = "sikatrack_pipeline"
    pipeline_debounce_s: int = Field(default=120, ge=0)  # wait for a burst of uploads to finish
    pipeline_retry_s: int = Field(default=300, ge=10)  # after a failed trigger or run
    pipeline_scheduler_interval_s: float = Field(default=30, gt=0)
    pipeline_scheduler_enabled: bool = True
    # Shared with the pipeline, which calls POST /internal/pipeline-events when a run ends
    internal_api_token: SecretStr = Field(min_length=32)

    # Push notifications (Expo's push service, for a React Native / Expo app). "disabled" keeps
    # them in the in-app inbox only, e.g. until the app exists.
    push_provider: Literal["expo", "disabled"] = "disabled"
    expo_access_token: SecretStr | None = None  # only if the Expo project requires one
    weekly_digest_weekday: int = Field(default=1, ge=1, le=7)  # 1 = Monday
    weekly_digest_hour_utc: int = Field(default=7, ge=0, le=23)

    @model_validator(mode="after")
    def _no_console_codes_in_production(self) -> "Settings":
        if self.environment == "production" and self.otp_provider == "console":
            raise ValueError(
                "OTP_PROVIDER=console prints sign-in codes; choose a real SMS provider, or "
                "OTP_PROVIDER=disabled with Google sign-in (GOOGLE_CLIENT_IDS)"
            )
        if self.otp_provider == "disabled" and not self.google_audiences:
            raise ValueError("No way to sign in: set GOOGLE_CLIENT_IDS or an OTP_PROVIDER")
        if self.otp_provider == "arkesel" and not (self.arkesel_api_key and self.arkesel_sender):
            raise ValueError("OTP_PROVIDER=arkesel needs ARKESEL_API_KEY and ARKESEL_SENDER")
        if self.otp_provider == "twilio" and not (
            self.twilio_account_sid
            and self.twilio_auth_token
            and (self.twilio_from or self.twilio_messaging_service_sid)
        ):
            raise ValueError(
                "OTP_PROVIDER=twilio needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM "
                "(or TWILIO_MESSAGING_SERVICE_SID)"
            )
        if "{code}" not in self.otp_message:
            raise ValueError("OTP_MESSAGE must contain {code}")
        return self

    @property
    def database_url(self) -> URL:
        """Built with URL.create, so special characters in the password need no escaping."""
        return URL.create(
            "postgresql+asyncpg",
            username=self.database_user,
            password=self.database_password.get_secret_value(),
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
        )

    @property
    def google_audiences(self) -> tuple[str, ...]:
        return tuple(i.strip() for i in self.google_client_ids.split(",") if i.strip())

    @property
    def sign_in_methods(self) -> list[str]:
        """What the app offers on its first screen."""
        return [
            *(["google"] if self.google_audiences else []),
            *(["phone"] if self.otp_provider != "disabled" else []),
        ]

    @property
    def docs_enabled(self) -> bool:
        return self.environment != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # required fields come from the environment
