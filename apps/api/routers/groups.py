import csv
import io
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import ClassGroup, Parent, User
from schemas import ClassGroupCreate, ClassGroupOut, ClassGroupUpdate, ParentCreate, ParentOut, ParentUpdate

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[ClassGroupOut])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ClassGroup)
        .where(ClassGroup.is_active == True, ClassGroup.name != "__quick_calls__")
        .order_by(ClassGroup.name)
    )
    groups = result.scalars().all()

    out = []
    for g in groups:
        count_result = await db.execute(
            select(func.count(Parent.id)).where(Parent.class_group_id == g.id, Parent.is_active == True)
        )
        count = count_result.scalar()
        out.append(ClassGroupOut(
            id=g.id,
            name=g.name,
            school_name=g.school_name,
            is_active=g.is_active,
            created_at=g.created_at,
            parent_count=count or 0,
        ))
    return out


@router.post("/groups", response_model=ClassGroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: ClassGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = ClassGroup(name=body.name, school_name=body.school_name)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return ClassGroupOut(**group.__dict__, parent_count=0)


@router.put("/groups/{group_id}", response_model=ClassGroupOut)
async def update_group(
    group_id: str,
    body: ClassGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(group, field, val)
    await db.commit()
    await db.refresh(group)

    count_result = await db.execute(
        select(func.count(Parent.id)).where(Parent.class_group_id == group_id, Parent.is_active == True)
    )
    return ClassGroupOut(**group.__dict__, parent_count=count_result.scalar() or 0)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ClassGroup).where(ClassGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.is_active = False
    await db.commit()


@router.get("/groups/{group_id}/parents", response_model=list[ParentOut])
async def list_parents(
    group_id: str,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Parent)
        .where(Parent.class_group_id == group_id, Parent.is_active == True)
        .order_by(Parent.child_name)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/groups/{group_id}/parents", response_model=ParentOut, status_code=status.HTTP_201_CREATED)
async def add_parent(
    group_id: str,
    body: ParentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == group_id))
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    existing = await db.execute(
        select(Parent).where(
            Parent.class_group_id == group_id,
            Parent.phone_number == body.phone_number,
            Parent.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Phone {body.phone_number} already exists in this group")

    parent = Parent(
        class_group_id=group_id,
        child_name=body.child_name,
        parent_name=body.parent_name,
        phone_number=body.phone_number,
    )
    db.add(parent)
    await db.commit()
    await db.refresh(parent)
    return parent


@router.put("/parents/{parent_id}", response_model=ParentOut)
async def update_parent(
    parent_id: str,
    body: ParentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Parent).where(Parent.id == parent_id))
    parent = result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(parent, field, val)
    await db.commit()
    await db.refresh(parent)
    return parent


@router.delete("/parents/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parent(
    parent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Parent).where(Parent.id == parent_id))
    parent = result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    parent.is_active = False
    await db.commit()


@router.post("/groups/{group_id}/parents/import")
async def import_parents_csv(
    group_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group_result = await db.execute(select(ClassGroup).where(ClassGroup.id == group_id))
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    phone_pattern = re.compile(r"^\+91[6-9]\d{9}$")
    added = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        child_name = row.get("child_name", "").strip()
        parent_name = row.get("parent_name", "").strip()
        phone_number = row.get("phone_number", "").strip()

        if not child_name or not parent_name or not phone_number:
            errors.append(f"Row {i}: missing required fields")
            continue

        if not phone_pattern.match(phone_number):
            errors.append(f"Row {i}: invalid phone {phone_number} — must be +91XXXXXXXXXX")
            continue

        parent = Parent(
            class_group_id=group_id,
            child_name=child_name,
            parent_name=parent_name,
            phone_number=phone_number,
        )
        db.add(parent)
        added += 1

    await db.commit()
    return {"added": added, "errors": errors}
