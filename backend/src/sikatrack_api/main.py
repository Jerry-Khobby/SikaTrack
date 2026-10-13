"""The app factory. Run with: uvicorn sikatrack_api.main:create_app --factory"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from sikatrack_api import __version__
from sikatrack_api.auth.sms import create_otp_sender
from sikatrack_api.config import Settings, get_settings
from sikatrack_api.db import create_engine, create_session_factory
from sikatrack_api.errors import register_error_handlers
from sikatrack_api.logging_config import configure_logging
from sikatrack_api.middleware import RequestContextMiddleware
from sikatrack_api.providers import create_push_sender
from sikatrack_api.routers import (
    auth,
    config,
    devices,
    health,
    internal,
    me,
    notifications,
    reads,
    sms,
    user_input,
    wallets,
)
from sikatrack_api.services import maintenance, pipeline
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
        app.state.session_factory = create_session_factory(engine)
        app.state.s3 = s3
        app.state.readiness_checks = [
            database_check(engine),
            object_store_check(s3, settings.raw_bucket),
        ]
        loops = []
        if settings.pipeline_scheduler_enabled:
            factory = app.state.session_factory
            loops = [
                asyncio.create_task(pipeline.scheduler_loop(factory, settings, app.state.pipeline_trigger)),
                asyncio.create_task(
                    maintenance.maintenance_loop(factory, s3, app.state.push_sender, settings)
                ),
            ]
        try:
            yield
        finally:
            for loop in loops:
                loop.cancel()
                with suppress(asyncio.CancelledError):
                    await loop
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
    app.state.otp_sender = create_otp_sender(settings)  # tests replace it to read the codes
    app.state.pipeline_trigger = pipeline.AirflowTrigger(settings)  # tests replace it too
    app.state.push_sender = create_push_sender(settings)  # and this
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    routers = (health, auth, me, devices, config, wallets, sms, reads, user_input, notifications, internal)
    for router in (module.router for module in routers):
        app.include_router(router)
    return app
