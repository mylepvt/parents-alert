from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
import re


# ─── Auth ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── ClassGroup ─────────────────────────────────────────────────────────────

class ClassGroupCreate(BaseModel):
    name: str
    school_name: str


class ClassGroupUpdate(BaseModel):
    name: Optional[str] = None
    school_name: Optional[str] = None
    is_active: Optional[bool] = None


class ClassGroupOut(BaseModel):
    id: str
    name: str
    school_name: str
    is_active: bool
    created_at: datetime
    parent_count: int = 0

    model_config = {"from_attributes": True}


# ─── Parent ──────────────────────────────────────────────────────────────────

class ParentCreate(BaseModel):
    child_name: str
    parent_name: str
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        pattern = r"^\+91[6-9]\d{9}$"
        if not re.match(pattern, v):
            raise ValueError("Phone must be E.164 format: +91XXXXXXXXXX (10 digits starting with 6-9)")
        return v


class ParentUpdate(BaseModel):
    child_name: Optional[str] = None
    parent_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone(cls, v):
        if v is None:
            return v
        pattern = r"^\+91[6-9]\d{9}$"
        if not re.match(pattern, v):
            raise ValueError("Phone must be E.164 format: +91XXXXXXXXXX")
        return v


class ParentOut(BaseModel):
    id: str
    class_group_id: str
    child_name: str
    parent_name: str
    phone_number: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Campaign ────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    class_group_id: str
    message_text: str
    language: str = "hindi"

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in ("hindi", "english"):
            raise ValueError("language must be 'hindi' or 'english'")
        return v


class CampaignOut(BaseModel):
    id: str
    class_group_id: str
    created_by: str
    message_text: str
    language: str
    status: str
    total_parents: int
    done_count: int
    failed_count: int
    skipped_count: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    created_at: datetime
    group_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── CallLog ─────────────────────────────────────────────────────────────────

class CallLogOut(BaseModel):
    id: str
    campaign_id: str
    parent_id: str
    status: str
    attempt_number: int
    max_attempts: int
    ai_script: Optional[str]
    twilio_call_sid: Optional[str]
    failure_reason: Optional[str]
    next_retry_at: Optional[datetime]
    started_at: Optional[datetime]
    connected_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    parent_name: Optional[str] = None
    child_name: Optional[str] = None
    phone_number: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Report ──────────────────────────────────────────────────────────────────

class ReportOut(BaseModel):
    campaign_id: str
    group_name: str
    message_text: str
    language: str
    status: str
    total_parents: int
    done_count: int
    failed_count: int
    skipped_count: int
    success_rate: float
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_minutes: Optional[float]
    logs: list[CallLogOut]


# ─── SSE Payload ─────────────────────────────────────────────────────────────

class SSELog(BaseModel):
    id: str
    parent_name: str
    child_name: str
    phone: str
    status: str
    attempt_number: int
    max_attempts: int
    next_retry_at: Optional[datetime]
    duration_seconds: Optional[int]
    ai_script: Optional[str]


class SSECampaign(BaseModel):
    status: str
    total: int
    done: int
    failed: int
    skipped: int


class SSEPayload(BaseModel):
    campaign: SSECampaign
    logs: list[SSELog]


# ─── Error ───────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str
    detail: str
