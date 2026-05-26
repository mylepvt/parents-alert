import asyncio
import logging
from datetime import datetime, timezone

from celery import group
from celery.exceptions import MaxRetriesExceededError
from sqlalchemy import select

from celery_app import celery_app
from database import AsyncSessionLocal
from models import CallCampaign, CallLog, CallStatus, Parent

logger = logging.getLogger(__name__)


def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def run_campaign(self, campaign_id: str):
    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
            campaign = result.scalar_one_or_none()
            if not campaign:
                logger.error("Campaign %s not found", campaign_id)
                return

            parents_result = await db.execute(
                select(Parent).where(
                    Parent.class_group_id == campaign.class_group_id,
                    Parent.is_active == True,
                )
            )
            parents = parents_result.scalars().all()

            if not parents:
                campaign.status = "done"
                campaign.ended_at = datetime.now(timezone.utc)
                await db.commit()
                return

            from config import settings
            max_attempts = settings.max_retry_attempts

            logs = []
            for parent in parents:
                log = CallLog(
                    campaign_id=campaign_id,
                    parent_id=parent.id,
                    status=CallStatus.queued,
                    attempt_number=1,
                    max_attempts=max_attempts,
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

        call_group = group(process_call.s(log_id) for log_id in log_ids)
        call_group.apply_async()

    try:
        run_async(_run())
    except Exception as exc:
        logger.exception("run_campaign failed for %s: %s", campaign_id, exc)
        try:
            self.retry(exc=exc)
        except MaxRetriesExceededError:
            async def _mark_failed():
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
                    campaign = result.scalar_one_or_none()
                    if campaign:
                        campaign.status = "failed"
                        await db.commit()
            run_async(_mark_failed())


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def process_call(self, call_log_id: str):
    async def _process():
        from services.twilio_caller import initiate_call
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
            call_log = result.scalar_one_or_none()
            if not call_log:
                logger.error("CallLog %s not found", call_log_id)
                return

            campaign_result = await db.execute(
                select(CallCampaign).where(CallCampaign.id == call_log.campaign_id)
            )
            campaign = campaign_result.scalar_one_or_none()
            if campaign and campaign.status == "stopped":
                call_log.status = CallStatus.skipped
                await db.commit()
                return

            try:
                await initiate_call(call_log_id, db)
            except Exception as e:
                logger.error("Call failed for %s: %s", call_log_id, e)
                async with AsyncSessionLocal() as db2:
                    result2 = await db2.execute(select(CallLog).where(CallLog.id == call_log_id))
                    log = result2.scalar_one_or_none()
                    if log and log.status not in (CallStatus.done, CallStatus.failed, CallStatus.skipped):
                        log.status = CallStatus.failed
                        log.failure_reason = str(e)
                        log.ended_at = datetime.now(timezone.utc)
                        await db2.commit()

    try:
        run_async(_process())
    except Exception as exc:
        logger.exception("process_call failed for %s", call_log_id)
        try:
            self.retry(exc=exc)
        except MaxRetriesExceededError:
            logger.error("Max retries exceeded for call_log %s", call_log_id)


@celery_app.task(bind=True)
def retry_call(self, call_log_id: str):
    async def _retry():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
            call_log = result.scalar_one_or_none()
            if not call_log:
                return

            campaign_result = await db.execute(
                select(CallCampaign).where(CallCampaign.id == call_log.campaign_id)
            )
            campaign = campaign_result.scalar_one_or_none()
            if campaign and campaign.status == "stopped":
                call_log.status = CallStatus.skipped
                await db.commit()
                return

            call_log.attempt_number += 1
            call_log.status = CallStatus.queued
            call_log.next_retry_at = None
            call_log.twilio_call_sid = None
            await db.commit()

        process_call.apply_async(args=[call_log_id])

    run_async(_retry())
