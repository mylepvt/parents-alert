from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import io

from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import User
from schemas import ReportOut
from services.report_builder import build_csv, build_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{campaign_id}", response_model=ReportOut)
async def get_report(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await build_report(campaign_id, db)
    if not report:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return report


@router.get("/{campaign_id}/csv")
async def download_csv(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_content = await build_csv(campaign_id, db)
    if not csv_content:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=campaign_{campaign_id[:8]}_report.csv"},
    )
