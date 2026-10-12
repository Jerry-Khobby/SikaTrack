"""Shared FastAPI dependencies. Tests swap these with app.dependency_overrides."""

from fastapi import Request

from sikatrack_api.config import Settings
from sikatrack_api.services.readiness import DependencyCheck


def get_settings_from_app(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def get_readiness_checks(request: Request) -> list[DependencyCheck]:
    checks: list[DependencyCheck] = request.app.state.readiness_checks
    return checks
