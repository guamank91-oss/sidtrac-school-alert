from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_database

logger = logging.getLogger(__name__)

scheduler = None


async def _run_daily_evaluation() -> None:
    """RF-28: nightly risk evaluation for all active students."""
    from app.core import database
    from app.modules.alerts.application.engine import AlertEngine

    assert database.AsyncSessionLocal is not None
    async with database.AsyncSessionLocal() as session:
        try:
            outcome = await AlertEngine(session).evaluate_all()
            logger.info(
                "Daily alert evaluation: %s students, %s alerts, %s emails",
                outcome.students_evaluated,
                outcome.alerts_created,
                outcome.emails_sent,
            )
        except Exception:
            logger.exception("Daily alert evaluation failed")


async def _default_evaluation_hour() -> int:
    from sqlalchemy import select

    from app.core import database
    from app.modules.alerts.infrastructure.models import AlertConfigModel

    if database.AsyncSessionLocal is None:
        return 23
    async with database.AsyncSessionLocal() as session:
        result = await session.execute(select(AlertConfigModel.evaluation_hour).limit(1))
        hour = result.scalar_one_or_none()
        return int(hour) if hour is not None else 23


def _start_scheduler(evaluation_hour: int = 23) -> None:
    global scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        hour = max(0, min(23, evaluation_hour))
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _run_daily_evaluation,
            CronTrigger(hour=hour, minute=0),
            id="daily_alert_evaluation",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Alert scheduler started (daily at %02d:00)", hour)
    except Exception:
        logger.exception("Could not start alert scheduler")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    evaluation_hour = await _default_evaluation_hour()
    _start_scheduler(evaluation_hour)
    yield
    if scheduler is not None:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
