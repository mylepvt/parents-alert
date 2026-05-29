"""
Bolna AI voice caller — Indian AI voice agent platform.
Docs: https://www.bolna.ai/docs/making-outgoing-calls

One-time dashboard setup (do this ONCE on bolna.ai):
───────────────────────────────────────────────────
1. Create account → https://app.bolna.ai
2. Create a new Agent → choose "Outbound"
3. Set System Prompt to:

   You are a school bus notification assistant for {school_name}.
   Call the parent and read this message EXACTLY in Hindi/Hinglish:

   "{message}"

   After reading the message, wait for the parent to say "haan", "theek hai", or "ok".
   Then say "Dhanyawad. Goodbye." and end the call immediately.
   Do NOT have a long conversation. Do NOT add extra words.

4. Under Voice → select Sarvam AI → Hindi (hi-IN) voice
5. Under Webhook → set URL to:
   https://YOUR-API-DOMAIN.onrender.com/webhooks/bolna-status
6. Save agent → copy the Agent ID
7. Add phone number (buy Indian number OR connect Exotel/Twilio number)
8. Set Render env vars:
   BOLNA_API_KEY     = your API key (Settings → API Keys)
   BOLNA_AGENT_ID    = agent UUID from step 6
   BOLNA_PHONE_NUMBER = from_phone_number (e.g. +918XXXXXXXXX)
   CALL_PROVIDER     = bolna
───────────────────────────────────────────────────
"""
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import CallCampaign, CallLog, CallStatus, Parent

logger = logging.getLogger(__name__)

BOLNA_API_URL = "https://api.bolna.ai/call"


async def initiate_call(call_log_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        logger.error("CallLog %s not found", call_log_id)
        return

    parent_result = await db.execute(select(Parent).where(Parent.id == call_log.parent_id))
    parent = parent_result.scalar_one_or_none()
    if not parent:
        call_log.status = CallStatus.failed
        call_log.failure_reason = "Parent not found"
        await db.commit()
        return

    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == call_log.campaign_id))
    campaign = campaign_result.scalar_one_or_none()

    # Generate AI script if not already done
    if not call_log.ai_script:
        try:
            from services.script_generator import generate_script
            script = await generate_script(
                child_name=parent.child_name,
                parent_name=parent.parent_name,
                message_text=campaign.message_text if campaign else "Important school message",
                language=campaign.language.value if campaign and hasattr(campaign.language, "value") else "hindi",
                school_name=settings.school_name,
            )
            call_log.ai_script = script
            await db.commit()
        except Exception as e:
            logger.warning("Script generation failed, using message_text: %s", e)
            call_log.ai_script = campaign.message_text if campaign else "Important school message"
            await db.commit()

    call_log.status = CallStatus.ringing
    call_log.started_at = datetime.now(timezone.utc)
    await db.commit()

    payload: dict = {
        "agent_id": settings.bolna_agent_id,
        "recipient_phone_number": parent.phone_number,
        "user_data": {
            "call_log_id": call_log_id,
            "child_name": parent.child_name,
            "parent_name": parent.parent_name,
            "message": call_log.ai_script,
            "school_name": settings.school_name,
        },
    }
    if settings.bolna_phone_number:
        payload["from_phone_number"] = settings.bolna_phone_number

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                BOLNA_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.bolna_api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            bolna_call_id = data.get("call_id") or data.get("id") or ""
            call_log.twilio_call_sid = bolna_call_id  # reuse existing field
            await db.commit()
            logger.info("Bolna call queued: %s → call_id=%s", call_log_id, bolna_call_id)

    except httpx.HTTPStatusError as e:
        logger.error("Bolna API error %s: %s", e.response.status_code, e.response.text)
        call_log.status = CallStatus.failed
        call_log.failure_reason = f"Bolna API {e.response.status_code}: {e.response.text[:200]}"
        call_log.ended_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        logger.exception("Bolna call initiation failed for %s", call_log_id)
        call_log.status = CallStatus.failed
        call_log.failure_reason = str(e)[:300]
        call_log.ended_at = datetime.now(timezone.utc)
        await db.commit()


async def handle_bolna_status_callback(
    call_log_id: str,
    call_status: str,
    call_duration: str,
    db: AsyncSession,
) -> None:
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()
    if not call_log:
        logger.warning("Bolna webhook: CallLog %s not found", call_log_id)
        return

    status_lower = call_status.lower()

    if status_lower in ("completed", "answered", "done"):
        call_log.status = CallStatus.done
        call_log.connected_at = call_log.connected_at or datetime.now(timezone.utc)
    elif status_lower == "busy":
        call_log.status = CallStatus.busy
    elif status_lower in ("failed", "error"):
        call_log.status = CallStatus.failed
        call_log.failure_reason = call_status
    elif status_lower in ("no-answer", "no_answer", "unanswered"):
        call_log.status = CallStatus.failed
        call_log.failure_reason = "No answer"
    else:
        logger.info("Bolna unhandled status '%s' for %s", call_status, call_log_id)
        return

    try:
        call_log.duration_seconds = int(float(call_duration))
    except (ValueError, TypeError):
        pass

    call_log.ended_at = datetime.now(timezone.utc)
    await db.commit()

    # Update campaign counters
    from services.twilio_caller import update_campaign_counts
    await update_campaign_counts(call_log.campaign_id, db)
    logger.info("Bolna webhook processed: %s → %s", call_log_id, call_status)
