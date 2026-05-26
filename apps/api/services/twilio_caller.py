import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from config import settings
from models import CallLog, CallStatus, Parent, CallCampaign
from services.ai_script import generate_call_script

logger = logging.getLogger(__name__)

twilio_client = Client(settings.twilio_account_sid, settings.twilio_auth_token)


async def initiate_call(call_log_id: str, db: AsyncSession) -> None:
    result = await db.execute(
        select(CallLog).where(CallLog.id == call_log_id)
    )
    call_log = result.scalar_one_or_none()
    if not call_log:
        raise ValueError(f"CallLog {call_log_id} not found")

    parent_result = await db.execute(select(Parent).where(Parent.id == call_log.parent_id))
    parent = parent_result.scalar_one_or_none()
    if not parent:
        raise ValueError(f"Parent {call_log.parent_id} not found")

    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == call_log.campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise ValueError(f"Campaign {call_log.campaign_id} not found")

    if campaign.status == "stopped":
        call_log.status = CallStatus.skipped
        await db.commit()
        return

    call_log.status = CallStatus.generating_script
    await db.commit()

    script = await generate_call_script(
        message=campaign.message_text,
        parent_name=parent.parent_name,
        child_name=parent.child_name,
        language=campaign.language.value,
        school_name=settings.school_name,
        school_phone=settings.school_phone,
    )
    call_log.ai_script = script
    call_log.status = CallStatus.ringing
    call_log.started_at = datetime.now(timezone.utc)
    await db.commit()

    try:
        twiml_url = f"{settings.base_url}/webhooks/twiml/{call_log_id}"
        status_callback = f"{settings.base_url}/webhooks/status/{call_log_id}"

        twilio_call = twilio_client.calls.create(
            to=parent.phone_number,
            from_=settings.twilio_phone_number,
            url=twiml_url,
            status_callback=status_callback,
            status_callback_method="POST",
            machine_detection="Enable",
            timeout=settings.call_timeout_seconds,
        )

        call_log.twilio_call_sid = twilio_call.sid
        await db.commit()

    except TwilioRestException as e:
        logger.error("Twilio error for call_log %s: %s", call_log_id, e)
        call_log.status = CallStatus.failed
        call_log.failure_reason = str(e)
        call_log.ended_at = datetime.now(timezone.utc)
        await db.commit()
        await update_campaign_counts(campaign.id, db)
        raise


async def handle_status_callback(
    call_log_id: str,
    call_status: str,
    call_duration: str,
    answered_by: str,
    db: AsyncSession,
) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        logger.warning("Status callback for unknown call_log %s", call_log_id)
        return

    now = datetime.now(timezone.utc)

    if answered_by == "machine_start":
        call_log.status = CallStatus.skipped
        call_log.failure_reason = "Answering machine detected"
        call_log.ended_at = now
    elif call_status == "completed":
        call_log.status = CallStatus.done
        call_log.connected_at = call_log.connected_at or now
        call_log.ended_at = now
        if call_duration:
            call_log.duration_seconds = int(call_duration)
    elif call_status in ("busy", "no-answer"):
        if call_log.attempt_number < call_log.max_attempts:
            call_log.status = CallStatus.busy
            call_log.next_retry_at = now + timedelta(seconds=settings.retry_delay_seconds)
        else:
            call_log.status = CallStatus.failed
            call_log.failure_reason = f"Max retries reached — last status: {call_status}"
            call_log.ended_at = now
    elif call_status == "failed":
        call_log.status = CallStatus.failed
        call_log.failure_reason = "Twilio reported call failed"
        call_log.ended_at = now
    elif call_status == "canceled":
        call_log.status = CallStatus.skipped
        call_log.ended_at = now
    elif call_status == "in-progress":
        call_log.status = CallStatus.connected
        if not call_log.connected_at:
            call_log.connected_at = now

    await db.commit()
    await update_campaign_counts(call_log.campaign_id, db)

    if call_log.status == CallStatus.busy and call_log.next_retry_at:
        from tasks.calling_tasks import retry_call
        retry_call.apply_async(args=[call_log_id], countdown=settings.retry_delay_seconds)


async def update_campaign_counts(campaign_id: str, db: AsyncSession) -> None:
    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        return

    logs_result = await db.execute(select(CallLog).where(CallLog.campaign_id == campaign_id))
    logs = logs_result.scalars().all()

    terminal_statuses = {CallStatus.done, CallStatus.failed, CallStatus.skipped}
    done = sum(1 for l in logs if l.status == CallStatus.done)
    failed = sum(1 for l in logs if l.status == CallStatus.failed)
    skipped = sum(1 for l in logs if l.status == CallStatus.skipped)

    campaign.done_count = done
    campaign.failed_count = failed
    campaign.skipped_count = skipped

    all_terminal = all(l.status in terminal_statuses for l in logs)
    if all_terminal and campaign.status == "running":
        campaign.status = "done"
        campaign.ended_at = datetime.now(timezone.utc)

    await db.commit()
