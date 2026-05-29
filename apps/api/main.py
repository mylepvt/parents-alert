import asyncio
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from config import settings
from database import create_tables
from routers import auth, campaigns, calls, groups, reports, sse, webhooks
from routers import backup as backup_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,
        environment=settings.environment,
        send_default_pii=False,
    )
    logger.info("Sentry initialized")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Bus Alert API...")
    await create_tables()
    logger.info("Database tables ready")
    from services.auto_backup import backup_scheduler
    task = asyncio.create_task(backup_scheduler())
    yield
    task.cancel()
    logger.info("Shutting down Bus Alert API")


app = FastAPI(
    title="Bus Alert API",
    description="School Bus Parent Notification System — Seth M R Jaipuria School Bhiwadi",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["*"]
        if settings.environment == "development" or not settings.frontend_url
        else [settings.base_url, settings.frontend_url]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(campaigns.router)
app.include_router(calls.router)
app.include_router(webhooks.router)
app.include_router(reports.router)
app.include_router(sse.router)
app.include_router(backup_router.router)


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "detail": str(exc.detail)},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    logger.exception("Internal server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "Something went wrong"},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bus-alert-api"}


@app.get("/")
async def root():
    return {"message": "Bus Alert API", "docs": "/docs"}
