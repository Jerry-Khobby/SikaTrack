"""Response models for the health endpoints. They are part of the public contract (OpenAPI)."""

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = Field(description="API version, for checking which build is running")


class CheckResult(BaseModel):
    status: Literal["ok", "failed"]
    latency_ms: float = Field(description="How long the check took, including a timeout")


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: dict[str, CheckResult] = Field(description="One entry per dependency: database, object_store")
