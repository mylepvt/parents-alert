import csv
import io
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import CallCampaign, CallLog, ClassGroup, Parent


async def build_report(campaign_id: str, db: AsyncSession) -> dict:
    campaign_result = await db.execute(
        select(CallCampaign).where(CallCampaign.id == campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        return None

    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == campaign.class_group_id))
    group = group_result.scalar_one_or_none()

    logs_result = await db.execute(
        select(CallLog, Parent)
        .join(Parent, CallLog.parent_id == Parent.id)
        .where(CallLog.campaign_id == campaign_id)
    )
    rows = logs_result.all()

    logs_out = []
    for log, parent in rows:
        logs_out.append({
            "id": log.id,
            "campaign_id": log.campaign_id,
            "parent_id": log.parent_id,
            "status": log.status.value if hasattr(log.status, "value") else log.status,
            "attempt_number": log.attempt_number,
            "max_attempts": log.max_attempts,
            "ai_script": log.ai_script,
            "twilio_call_sid": log.twilio_call_sid,
            "failure_reason": log.failure_reason,
            "next_retry_at": log.next_retry_at,
            "started_at": log.started_at,
            "connected_at": log.connected_at,
            "ended_at": log.ended_at,
            "duration_seconds": log.duration_seconds,
            "parent_name": parent.parent_name,
            "child_name": parent.child_name,
            "phone_number": parent.phone_number,
        })

    total = campaign.total_parents
    done = campaign.done_count
    success_rate = round((done / total * 100), 1) if total > 0 else 0.0

    duration_minutes: Optional[float] = None
    if campaign.started_at and campaign.ended_at:
        delta = campaign.ended_at - campaign.started_at
        duration_minutes = round(delta.total_seconds() / 60, 1)

    return {
        "campaign_id": campaign.id,
        "group_name": group.name if group else "Unknown",
        "message_text": campaign.message_text,
        "language": campaign.language.value if hasattr(campaign.language, "value") else campaign.language,
        "status": campaign.status.value if hasattr(campaign.status, "value") else campaign.status,
        "total_parents": total,
        "done_count": done,
        "failed_count": campaign.failed_count,
        "skipped_count": campaign.skipped_count,
        "success_rate": success_rate,
        "started_at": campaign.started_at,
        "ended_at": campaign.ended_at,
        "duration_minutes": duration_minutes,
        "logs": logs_out,
    }


async def build_csv(campaign_id: str, db: AsyncSession) -> str:
    report = await build_report(campaign_id, db)
    if not report:
        return ""

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Child Name", "Parent Name", "Phone", "Status",
        "Attempts", "Duration (sec)", "Script Preview"
    ])

    for log in report["logs"]:
        script_preview = ""
        if log["ai_script"]:
            script_preview = log["ai_script"][:100] + "..." if len(log["ai_script"]) > 100 else log["ai_script"]
        writer.writerow([
            log["child_name"],
            log["parent_name"],
            log["phone_number"],
            log["status"],
            log["attempt_number"],
            log["duration_seconds"] or "",
            script_preview,
        ])

    return output.getvalue()
