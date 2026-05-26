from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import CallCampaign, CallLog, ClassGroup, Parent, User
from schemas import CampaignCreate, CampaignOut, QuickCallCreate

router = APIRouter(tags=["campaigns"])

QUICK_GROUP_NAME = "__quick_calls__"


@router.get("/contacts/quick", response_model=list)
async def list_quick_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all contacts from the quick-calls group, newest first."""
    group_result = await db.execute(
        select(ClassGroup).where(ClassGroup.name == QUICK_GROUP_NAME)
    )
    group = group_result.scalar_one_or_none()
    if not group:
        return []
    result = await db.execute(
        select(Parent)
        .where(Parent.class_group_id == group.id, Parent.is_active == True)
        .order_by(Parent.created_at.desc())
        .limit(20)
    )
    parents = result.scalars().all()
    return [
        {
            "id": p.id,
            "phone_number": p.phone_number,
            "parent_name": p.parent_name,
            "child_name": p.child_name,
        }
        for p in parents
    ]


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

    import asyncio
    from local_runner import run_campaign_local
    asyncio.create_task(run_campaign_local(campaign.id))

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


@router.post("/campaigns/quick", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def quick_call(
    body: QuickCallCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single number quick call — no group needed."""
    QUICK_GROUP_NAME = "__quick_calls__"

    group_result = await db.execute(
        select(ClassGroup).where(ClassGroup.name == QUICK_GROUP_NAME)
    )
    group = group_result.scalar_one_or_none()
    if not group:
        group = ClassGroup(
            name=QUICK_GROUP_NAME,
            school_name="Seth M R Jaipuria School Bhiwadi",
        )
        db.add(group)
        await db.flush()

    parent_result = await db.execute(
        select(Parent).where(
            Parent.class_group_id == group.id,
            Parent.phone_number == body.phone_number,
        )
    )
    parent = parent_result.scalar_one_or_none()
    if not parent:
        parent = Parent(
            class_group_id=group.id,
            child_name=body.child_name,
            parent_name=body.parent_name,
            phone_number=body.phone_number,
        )
        db.add(parent)
        await db.flush()
    else:
        parent.child_name = body.child_name
        parent.parent_name = body.parent_name
        parent.is_active = True

    campaign = CallCampaign(
        class_group_id=group.id,
        created_by=current_user.id,
        message_text=body.message_text,
        language=body.language,
        total_parents=1,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    import asyncio
    from local_runner import run_campaign_local
    asyncio.create_task(run_campaign_local(campaign.id))

    return _campaign_out(campaign, "Quick Call")
