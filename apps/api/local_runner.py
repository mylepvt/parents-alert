"""
Asyncio-based task runner for local dev.
Replaces Celery + Redis — runs everything in FastAPI's event loop.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models import CallCampaign, CallLog, CallStatus, Parent

logger = logging.getLogger(__name__)


async def run_campaign_local(campaign_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
        campaign = result.scalar_one_or_none()
        if not campaign:
            logger.error("Campaign %s not found", campaign_id)
            return

        # Wait if scheduled for future
        scheduled_at = getattr(campaign, "scheduled_at", None)
        if scheduled_at:
            now = datetime.now(timezone.utc)
            delay = (scheduled_at - now).total_seconds()
            if delay > 0:
                logger.info("Campaign %s scheduled in %.0fs", campaign_id, delay)
                await asyncio.sleep(delay)

        parents_result = await db.execute(
            select(Parent).where(
                Parent.class_group_id == campaign.class_group_id,
                Parent.is_active == True,
                Parent.opted_out == False,
            )
        )
        parents = parents_result.scalars().all()

        if not parents:
            campaign.status = "done"
            campaign.ended_at = datetime.now(timezone.utc)
            await db.commit()
            return

        logs = []
        for parent in parents:
            log = CallLog(
                campaign_id=campaign_id,
                parent_id=parent.id,
                status=CallStatus.queued,
                attempt_number=1,
                max_attempts=settings.max_retry_attempts,
            )
            db.add(log)
            logs.append(log)

        campaign.status = "running"
        campaign.total_parents = len(parents)
        campaign.started_at = datetime.now(timezone.utc)
        await db.commit()

        for log in logs:
            await db.refresh(log)

        log_ids = [log.id for log in logs]

    # Fire all calls concurrently (each in its own DB session)
    tasks = [asyncio.create_task(_process_one(log_id)) for log_id in log_ids]
    await asyncio.gather(*tasks, return_exceptions=True)


async def _process_one(call_log_id: str) -> None:
    provider = settings.call_provider  # "mock" | "twilio" | "exotel"

    try:
        async with AsyncSessionLocal() as db:
            if provider == "exotel":
                from services.exotel_caller import initiate_call
                await initiate_call(call_log_id, db)
            elif provider == "twilio":
                from services.twilio_caller import initiate_call
                await initiate_call(call_log_id, db)
            else:
                from services.mock_caller import simulate_call
                await simulate_call(call_log_id, db)
    except Exception as e:
        logger.exception("Call failed for %s: %s", call_log_id, e)
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
            log = result.scalar_one_or_none()
            if log and log.status not in (CallStatus.done, CallStatus.failed, CallStatus.skipped):
                log.status = CallStatus.failed
                log.failure_reason = str(e)
                log.ended_at = datetime.now(timezone.utc)
                await db.commit()
