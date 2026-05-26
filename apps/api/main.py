import logging
from contextlib import asynccontextmanager

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Bus Alert API...")
    await create_tables()
    logger.info("Database tables ready")
    yield
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
    allow_origins=["*"] if settings.environment == "development" else [settings.base_url],
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
