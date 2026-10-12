"""The app factory. Run with: uvicorn sikatrack_api.main:create_app --factory"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from sikatrack_api import __version__
from sikatrack_api.config import Settings, get_settings
from sikatrack_api.db import create_engine
from sikatrack_api.errors import register_error_handlers
from sikatrack_api.logging_config import configure_logging
from sikatrack_api.middleware import RequestContextMiddleware
from sikatrack_api.routers import health
from sikatrack_api.services.readiness import database_check, object_store_check
from sikatrack_api.storage import create_s3_client


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Clients are created once and shared; neither connects until first used
        engine = create_engine(settings)
        s3 = create_s3_client(settings)
        app.state.engine = engine
        app.state.s3 = s3
        app.state.readiness_checks = [
            database_check(engine),
            object_store_check(s3, settings.raw_bucket),
        ]
        try:
            yield
        finally:
            await engine.dispose()
            s3.close()

    app = FastAPI(
        title="SikaTrack API",
        version=__version__,
        summary="The API between the SikaTrack mobile app and the data platform.",
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
    )
    app.state.settings = settings
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    app.include_router(health.router)
    return app
