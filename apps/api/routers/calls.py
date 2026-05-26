from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import CallLog, Parent, User
from schemas import CallLogOut

router = APIRouter(tags=["calls"])


def _log_out(log: CallLog, parent: Parent = None) -> CallLogOut:
    return CallLogOut(
        id=log.id,
        campaign_id=log.campaign_id,
        parent_id=log.parent_id,
        status=log.status.value if hasattr(log.status, "value") else log.status,
        attempt_number=log.attempt_number,
        max_attempts=log.max_attempts,
        ai_script=log.ai_script,
        twilio_call_sid=log.twilio_call_sid,
        failure_reason=log.failure_reason,
        next_retry_at=log.next_retry_at,
        started_at=log.started_at,
        connected_at=log.connected_at,
        ended_at=log.ended_at,
        duration_seconds=log.duration_seconds,
        parent_name=parent.parent_name if parent else None,
        child_name=parent.child_name if parent else None,
        phone_number=parent.phone_number if parent else None,
    )


@router.get("/campaigns/{campaign_id}/logs", response_model=list[CallLogOut])
async def list_call_logs(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CallLog, Parent)
        .join(Parent, CallLog.parent_id == Parent.id)
        .where(CallLog.campaign_id == campaign_id)
        .order_by(Parent.child_name)
    )
    rows = result.all()
    return [_log_out(log, parent) for log, parent in rows]
