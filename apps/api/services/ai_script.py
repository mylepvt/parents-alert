import asyncio
import logging
from anthropic import AsyncAnthropic, APITimeoutError, APIError

from config import settings

logger = logging.getLogger(__name__)

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

HINDI_FALLBACK = (
    "Namaste! Main {school_name} se bol raha hoon. "
    "{parent_name} ji, aapke bachche {child_name} ke baare mein ek zaroori sandesh hai. "
    "{message} "
    "Koi bhi sawaal ho toh {school_phone} pe call karein. Shukriya."
)

ENGLISH_FALLBACK = (
    "Hello! This is an important message from {school_name}. "
    "{parent_name}, this message is regarding your child {child_name}. "
    "{message} "
    "For any queries, please call us at {school_phone}. Thank you."
)


async def generate_call_script(
    message: str,
    parent_name: str,
    child_name: str,
    language: str,
    school_name: str,
    school_phone: str,
) -> str:
    if language == "hindi":
        system_prompt = (
            "Tu ek school ki taraf se parents ko phone karke message padhne wala AI assistant hai. "
            "Roman Hindi / Hinglish mein baat kar. Warm aur professional tone rakh. "
            "Sirf phone call script likho — koi intro, koi explanation nahi. "
            "5-6 sentences maximum. 'Namaste' se shuru karo."
        )
        user_prompt = (
            f"Ek phone call script banao jo {school_name} ki taraf se "
            f"{parent_name} ji ko call karke unke bachche {child_name} ke liye yeh message de:\n\n"
            f"'{message}'\n\n"
            f"Script mein school ka naam, bachche ka naam, aur message clearly include karo. "
            f"End mein bolo: 'Koi bhi sawaal ho toh {school_phone} pe call karein. Shukriya.'"
        )
    else:
        system_prompt = (
            "You are an AI assistant making phone calls on behalf of a school to inform parents. "
            "Speak in clear Indian English, warm and professional. "
            "Write only the call script — no intro, no explanation. "
            "5-6 sentences maximum. Start with 'Hello'."
        )
        user_prompt = (
            f"Write a phone call script from {school_name} "
            f"to {parent_name} regarding their child {child_name} with this message:\n\n"
            f"'{message}'\n\n"
            f"Include the school name, child's name, and the message clearly. "
            f"End with: 'For any queries, please call us at {school_phone}. Thank you.'"
        )

    try:
        response = await asyncio.wait_for(
            client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            ),
            timeout=8.0,
        )
        return response.content[0].text.strip()
    except (asyncio.TimeoutError, APITimeoutError):
        logger.warning("Claude API timed out for parent %s — using fallback script", parent_name)
    except APIError as e:
        logger.error("Claude API error: %s — using fallback script", e)
    except Exception as e:
        logger.error("Unexpected error generating script: %s", e)

    template = HINDI_FALLBACK if language == "hindi" else ENGLISH_FALLBACK
    return template.format(
        school_name=school_name,
        parent_name=parent_name,
        child_name=child_name,
        message=message,
        school_phone=school_phone,
    )
