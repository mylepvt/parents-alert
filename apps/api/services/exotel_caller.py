"""
Exotel outbound call service — drop-in replacement for twilio_caller.
Uses Exotel REST API v1 which accepts TwiML applet URLs.
"""
import base64
import logging
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import CallLog, CallStatus, Parent, CallCampaign
from services.ai_script import generate_call_script

logger = logging.getLogger(__name__)

EXOTEL_API_BASE = "https://api.exotel.com/v1/Accounts"


def _auth_header() -> str:
    token = base64.b64encode(
        f"{settings.exotel_api_key}:{settings.exotel_api_token}".encode()
    ).decode()
    return f"Basic {token}"


async def initiate_call(call_log_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        raise ValueError(f"CallLog {call_log_id} not found")

    parent_result = await db.execute(select(Parent).where(Parent.id == call_log.parent_id))
    parent = parent_result.scalar_one_or_none()
    if not parent:
        raise ValueError(f"Parent {call_log.parent_id} not found")

    campaign_result = await db.execute(
        select(CallCampaign).where(CallCampaign.id == call_log.campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise ValueError(f"Campaign {call_log.campaign_id} not found")

    if campaign.status == "stopped":
        call_log.status = CallStatus.skipped
        await db.commit()
        return

    call_log.status = CallStatus.generating_script
    await db.commit()

    language = campaign.language.value if hasattr(campaign.language, "value") else campaign.language

    script = await generate_call_script(
        message=campaign.message_text,
        parent_name=parent.parent_name,
        child_name=parent.child_name,
        language=language,
        school_name=settings.school_name,
        school_phone=settings.school_phone,
    )
    call_log.ai_script = script
    call_log.status = CallStatus.ringing
    call_log.started_at = datetime.now(timezone.utc)
    await db.commit()

    twiml_url = f"{settings.base_url}/webhooks/twiml/{call_log_id}"
    status_callback = f"{settings.base_url}/webhooks/exotel-status/{call_log_id}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{EXOTEL_API_BASE}/{settings.exotel_account_sid}/Calls/connect",
                headers={
                    "Authorization": _auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "From": settings.exotel_phone_number,
                    "To": parent.phone_number,
                    "CallerId": settings.exotel_phone_number,
                    "Url": twiml_url,
                    "StatusCallback": status_callback,
                    "StatusCallbackEvents[0]": "terminal",
                    "TimeLimit": str(settings.call_timeout_seconds + 60),
                },
            )

        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Exotel API error {resp.status_code}: {resp.text}")

        data = resp.json()
        call_sid = data.get("Call", {}).get("Sid", "")
        call_log.twilio_call_sid = call_sid  # reuse same field
        await db.commit()
        logger.info("Exotel call placed: sid=%s → %s", call_sid, parent.phone_number)

    except Exception as e:
        logger.error("Exotel error for call_log %s: %s", call_log_id, e)
        call_log.status = CallStatus.failed
        call_log.failure_reason = str(e)
        call_log.ended_at = datetime.now(timezone.utc)
        await db.commit()
        from services.twilio_caller import update_campaign_counts
        await update_campaign_counts(campaign.id, db)
        raise


async def handle_exotel_status_callback(
    call_log_id: str,
    call_status: str,
    call_duration: str,
    db: AsyncSession,
) -> None:
    """Handle Exotel status callback (terminal events only)."""
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        logger.warning("Exotel status callback for unknown call_log %s", call_log_id)
        return

    now = datetime.now(timezone.utc)
    status_lower = call_status.lower()

    if status_lower == "completed":
        call_log.status = CallStatus.done
        call_log.connected_at = call_log.connected_at or now
        call_log.ended_at = now
        if call_duration:
            try:
                call_log.duration_seconds = int(float(call_duration))
            except ValueError:
                pass
    elif status_lower in ("busy", "no-answer"):
        if call_log.attempt_number < call_log.max_attempts:
            call_log.status = CallStatus.busy
            call_log.next_retry_at = now + timedelta(seconds=settings.retry_delay_seconds)
        else:
            call_log.status = CallStatus.failed
            call_log.failure_reason = f"Max retries reached — last status: {call_status}"
            call_log.ended_at = now
    elif status_lower == "failed":
        call_log.status = CallStatus.failed
        call_log.failure_reason = "Exotel reported call failed"
        call_log.ended_at = now
    elif status_lower in ("canceled", "cancelled"):
        call_log.status = CallStatus.skipped
        call_log.ended_at = now

    await db.commit()

    from services.twilio_caller import update_campaign_counts
    await update_campaign_counts(call_log.campaign_id, db)

    # Schedule retry via asyncio if needed
    if call_log.status == CallStatus.busy and call_log.next_retry_at:
        import asyncio
        delay = settings.retry_delay_seconds

        async def _retry():
            await asyncio.sleep(delay)
            from database import AsyncSessionLocal
            async with AsyncSessionLocal() as retry_db:
                await _schedule_retry(call_log_id, retry_db)

        asyncio.create_task(_retry())


async def _schedule_retry(call_log_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log or call_log.status != CallStatus.busy:
        return

    from models import Parent, CallCampaign
    parent_result = await db.execute(select(Parent).where(Parent.id == call_log.parent_id))
    parent = parent_result.scalar_one_or_none()

    new_log = CallLog(
        campaign_id=call_log.campaign_id,
        parent_id=call_log.parent_id,
        status=CallStatus.queued,
        attempt_number=call_log.attempt_number + 1,
        max_attempts=call_log.max_attempts,
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)

    await initiate_call(new_log.id, db)
