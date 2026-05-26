import logging
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.request_validator import RequestValidator

from config import settings
from database import get_db
from models import CallLog
from services.twilio_caller import handle_status_callback

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


def build_twiml(script: str, language: str) -> str:
    response = Element("Response")

    pause1 = SubElement(response, "Pause")
    pause1.set("length", "1")

    if language == "hindi":
        voice = "Polly.Aditi"
        lang = "hi-IN"
        callback_msg = (
            "Koi bhi sawaal ho toh hamare school ko call karein. Dhanyavaad."
        )
    else:
        voice = "Polly.Raveena"
        lang = "en-IN"
        callback_msg = (
            "For any queries, please contact the school. Thank you."
        )

    say = SubElement(response, "Say")
    say.set("voice", voice)
    say.set("language", lang)
    say.text = script

    pause2 = SubElement(response, "Pause")
    pause2.set("length", "1")

    say2 = SubElement(response, "Say")
    say2.set("voice", voice)
    say2.set("language", lang)
    say2.text = callback_msg

    xml_str = tostring(response, encoding="unicode", xml_declaration=False)
    return f'<?xml version="1.0" encoding="UTF-8"?>{xml_str}'


@router.get("/twiml/{call_log_id}", response_class=PlainTextResponse)
async def twiml_response(
    call_log_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CallLog).where(CallLog.id == call_log_id))
    call_log = result.scalar_one_or_none()

    if not call_log or not call_log.ai_script:
        fallback = (
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<Response><Say>This is an important message from school. Please contact the school for details. Thank you.</Say></Response>"
        )
        return PlainTextResponse(content=fallback, media_type="application/xml")

    from models import CallCampaign
    campaign_result = await db.execute(select(CallCampaign).where(CallCampaign.id == call_log.campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    language = "hindi"
    if campaign:
        language = campaign.language.value if hasattr(campaign.language, "value") else campaign.language

    xml = build_twiml(call_log.ai_script, language)
    return PlainTextResponse(content=xml, media_type="application/xml")


@router.post("/status/{call_log_id}")
async def status_callback(
    request: Request,
    call_log_id: str,
    CallStatus: str = Form(...),
    CallDuration: str = Form(default="0"),
    AnsweredBy: str = Form(default="human"),
    db: AsyncSession = Depends(get_db),
):
    if settings.environment == "production" and settings.twilio_auth_token:
        validator = RequestValidator(settings.twilio_auth_token)
        form_data = dict(await request.form())
        url = str(request.url)
        signature = request.headers.get("X-Twilio-Signature", "")
        if not validator.validate(url, form_data, signature):
            logger.warning("Invalid Twilio signature for call_log %s", call_log_id)
            return Response(status_code=403)

    logger.info(
        "Status callback: call_log=%s status=%s duration=%s answered_by=%s",
        call_log_id, CallStatus, CallDuration, AnsweredBy,
    )

    await handle_status_callback(
        call_log_id=call_log_id,
        call_status=CallStatus,
        call_duration=CallDuration,
        answered_by=AnsweredBy,
        db=db,
    )

    return Response(status_code=204)
