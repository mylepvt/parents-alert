"""
Mock Twilio caller for local dev — simulates realistic call lifecycle.
No external services needed.
"""
import asyncio
import logging
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import CallCampaign, CallLog, CallStatus, Parent
from services.ai_script import generate_call_script

logger = logging.getLogger(__name__)

# Simulated call outcomes per attempt (realistic distribution)
OUTCOMES = ["done", "done", "done", "done", "busy", "busy", "failed"]


async def simulate_call(call_log_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        return

    parent_result = await db.execute(select(Parent).where(Parent.id == call_log.parent_id))
    parent = parent_result.scalar_one_or_none()

    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == call_log.campaign_id))
    campaign = campaign_result.scalar_one_or_none()

    if not parent or not campaign:
        call_log.status = CallStatus.failed
        call_log.failure_reason = "Missing parent or campaign"
        await db.commit()
        return

    if campaign.status == "stopped":
        call_log.status = CallStatus.skipped
        await db.commit()
        return

    # Generate AI script (uses fallback template since no API key in local mode)
    call_log.status = CallStatus.generating_script
    await db.commit()
    await asyncio.sleep(0.8)

    script = await generate_call_script(
        message=campaign.message_text,
        parent_name=parent.parent_name,
        child_name=parent.child_name,
        language=campaign.language.value if hasattr(campaign.language, "value") else campaign.language,
        school_name=settings.school_name,
        school_phone=settings.school_phone,
    )
    call_log.ai_script = script

    # Simulate ringing
    call_log.status = CallStatus.ringing
    call_log.started_at = datetime.now(timezone.utc)
    call_log.twilio_call_sid = f"MOCK-{call_log_id[:8].upper()}"
    await db.commit()
    await asyncio.sleep(random.uniform(2.0, 4.0))

    # Check if campaign stopped while we were ringing
    await db.refresh(campaign)
    if campaign.status == "stopped":
        call_log.status = CallStatus.skipped
        call_log.ended_at = datetime.now(timezone.utc)
        await db.commit()
        return

    outcome = random.choice(OUTCOMES)

    if outcome == "done":
        call_log.status = CallStatus.connected
        call_log.connected_at = datetime.now(timezone.utc)
        await db.commit()
        # Simulate speaking duration
        duration = random.randint(18, 45)
        await asyncio.sleep(min(duration * 0.15, 3.0))  # speed up for local dev
        call_log.status = CallStatus.done
        call_log.ended_at = datetime.now(timezone.utc)
        call_log.duration_seconds = duration

    elif outcome == "busy":
        call_log.status = CallStatus.busy
        if call_log.attempt_number < call_log.max_attempts:
            retry_delay = 5  # 5s in local mode instead of 30s
            call_log.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=retry_delay)
            await db.commit()
            await _update_campaign_counts(campaign.id, db)
            # Schedule retry
            await asyncio.sleep(retry_delay)
            await _retry_call(call_log_id)
            return
        else:
            call_log.status = CallStatus.failed
            call_log.failure_reason = "Max retries reached — busy"
            call_log.ended_at = datetime.now(timezone.utc)

    else:  # failed
        call_log.status = CallStatus.failed
        call_log.failure_reason = "Simulated call failure"
        call_log.ended_at = datetime.now(timezone.utc)

    await db.commit()
    await _update_campaign_counts(campaign.id, db)


async def _retry_call(call_log_id: str) -> None:
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
        call_log = result.scalar_one_or_none()
        if not call_log:
            return
        call_log.attempt_number += 1
        call_log.status = CallStatus.queued
        call_log.next_retry_at = None
        call_log.twilio_call_sid = None
        await db.commit()
        await simulate_call(call_log_id, db)


async def _update_campaign_counts(campaign_id: str, db: AsyncSession) -> None:
    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        return

    logs_result = await db.execute(select(CallLog).where(CallLog.campaign_id == campaign_id))
    logs = logs_result.scalars().all()

    terminal = {CallStatus.done, CallStatus.failed, CallStatus.skipped}
    campaign.done_count = sum(1 for l in logs if l.status == CallStatus.done)
    campaign.failed_count = sum(1 for l in logs if l.status == CallStatus.failed)
    campaign.skipped_count = sum(1 for l in logs if l.status == CallStatus.skipped)

    if all(l.status in terminal for l in logs) and campaign.status == "running":
        campaign.status = "done"
        campaign.ended_at = datetime.now(timezone.utc)
        logger.info("Campaign %s complete — done=%d failed=%d", campaign_id, campaign.done_count, campaign.failed_count)

    await db.commit()
