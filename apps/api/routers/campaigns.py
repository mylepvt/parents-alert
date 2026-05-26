from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import CallCampaign, CallLog, ClassGroup, Parent, User
from schemas import CampaignCreate, CampaignOut

router = APIRouter(tags=["campaigns"])


def _campaign_out(campaign: CallCampaign, group_name: str = None) -> CampaignOut:
    return CampaignOut(
        id=campaign.id,
        class_group_id=campaign.class_group_id,
        created_by=campaign.created_by,
        message_text=campaign.message_text,
        language=campaign.language.value if hasattr(campaign.language, "value") else campaign.language,
        status=campaign.status.value if hasattr(campaign.status, "value") else campaign.status,
        total_parents=campaign.total_parents,
        done_count=campaign.done_count,
        failed_count=campaign.failed_count,
        skipped_count=campaign.skipped_count,
        started_at=campaign.started_at,
        ended_at=campaign.ended_at,
        created_at=campaign.created_at,
        group_name=group_name,
    )


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(
    campaign_status: str = None,
    group_id: str = None,
    limit: int = 20,
    skip: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(CallCampaign).order_by(CallCampaign.created_at.desc()).offset(skip).limit(limit)
    if campaign_status:
        q = q.where(CallCampaign.status == campaign_status)
    if group_id:
        q = q.where(CallCampaign.class_group_id == group_id)

    result = await db.execute(q)
    campaigns = result.scalars().all()

    out = []
    for c in campaigns:
        group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == c.class_group_id))
        group = group_result.scalar_one_or_none()
        out.append(_campaign_out(c, group.name if group else None))
    return out


@router.post("/campaigns", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == body.class_group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Class group not found")

    parents_result = await db.execute(
        select(func.count(Parent.id)).where(
            Parent.class_group_id == body.class_group_id,
            Parent.is_active == True,
        )
    )
    parent_count = parents_result.scalar() or 0
    if parent_count == 0:
        raise HTTPException(status_code=400, detail="No active parents in this group")

    campaign = CallCampaign(
        class_group_id=body.class_group_id,
        created_by=current_user.id,
        message_text=body.message_text,
        language=body.language,
        total_parents=parent_count,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    from config import settings
    if settings.local_mode:
        import asyncio
        from local_runner import run_campaign_local
        asyncio.create_task(run_campaign_local(campaign.id))
    else:
        from tasks.calling_tasks import run_campaign
        run_campaign.apply_async(args=[campaign.id])

    return _campaign_out(campaign, group.name)


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == campaign.class_group_id))
    group = group_result.scalar_one_or_none()
    return _campaign_out(campaign, group.name if group else None)


@router.post("/campaigns/{campaign_id}/stop", response_model=CampaignOut)
async def stop_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CallCampaign).where(CallCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot stop campaign in status: {campaign.status}")

    campaign.status = "stopped"
    from datetime import datetime, timezone
    campaign.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(campaign)

    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == campaign.class_group_id))
    group = group_result.scalar_one_or_none()
    return _campaign_out(campaign, group.name if group else None)
