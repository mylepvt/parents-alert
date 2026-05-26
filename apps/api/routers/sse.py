import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import AsyncSessionLocal
from models import CallCampaign, CallLog, Parent, User

router = APIRouter(prefix="/sse", tags=["sse"])
logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {"done", "stopped", "failed"}


def _serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


@router.get("/campaign/{campaign_id}")
async def campaign_sse(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
):
    async def event_generator():
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    campaign_result = await db.execute(
                        select(CallCampaign).where(CallCampaign.id == campaign_id)
                    )
                    campaign = campaign_result.scalar_one_or_none()
                    if not campaign:
                        yield "event: error\ndata: Campaign not found\n\n"
                        return

                    logs_result = await db.execute(
                        select(CallLog, Parent)
                        .join(Parent, CallLog.parent_id == Parent.id)
                        .where(CallLog.campaign_id == campaign_id)
                        .order_by(Parent.child_name)
                    )
                    rows = logs_result.all()

                    campaign_status = (
                        campaign.status.value
                        if hasattr(campaign.status, "value")
                        else campaign.status
                    )

                    logs_data = []
                    for log, parent in rows:
                        log_status = (
                            log.status.value if hasattr(log.status, "value") else log.status
                        )
                        logs_data.append({
                            "id": log.id,
                            "parent_name": parent.parent_name,
                            "child_name": parent.child_name,
                            "phone": parent.phone_number,
                            "status": log_status,
                            "attempt_number": log.attempt_number,
                            "max_attempts": log.max_attempts,
                            "next_retry_at": log.next_retry_at.isoformat() if log.next_retry_at else None,
                            "duration_seconds": log.duration_seconds,
                            "ai_script": log.ai_script,
                        })

                    payload = {
                        "campaign": {
                            "status": campaign_status,
                            "total": campaign.total_parents,
                            "done": campaign.done_count,
                            "failed": campaign.failed_count,
                            "skipped": campaign.skipped_count,
                        },
                        "logs": logs_data,
                    }

                    data = json.dumps(payload, default=_serialize)
                    yield f"data: {data}\n\n"

                    if campaign_status in TERMINAL_STATUSES:
                        yield "event: done\ndata: campaign_complete\n\n"
                        return

            except Exception as e:
                logger.error("SSE error for campaign %s: %s", campaign_id, e)
                yield f"event: error\ndata: {str(e)}\n\n"

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
