"""Settings, read once from the environment (and backend/.env in development)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
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

    # How long /ready waits for each dependency before calling it down
    readiness_timeout: float = Field(default=2.0, gt=0)

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
    def docs_enabled(self) -> bool:
        return self.environment != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # required fields come from the environment
