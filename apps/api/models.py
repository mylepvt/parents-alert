import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text,
    Enum, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


class UserRole(str, PyEnum):
    admin = "admin"
    staff = "staff"


class Language(str, PyEnum):
    hindi = "hindi"
    english = "english"


class CampaignStatus(str, PyEnum):
    pending = "pending"
    running = "running"
    done = "done"
    stopped = "stopped"
    failed = "failed"


class CallStatus(str, PyEnum):
    queued = "queued"
    generating_script = "generating_script"
    ringing = "ringing"
    busy = "busy"
    connected = "connected"
    done = "done"
    failed = "failed"
    skipped = "skipped"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.staff)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    campaigns: Mapped[list["CallCampaign"]] = relationship("CallCampaign", back_populates="creator")


class ClassGroup(Base):
    __tablename__ = "class_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    school_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    parents: Mapped[list["Parent"]] = relationship("Parent", back_populates="class_group", cascade="all, delete-orphan")
    campaigns: Mapped[list["CallCampaign"]] = relationship("CallCampaign", back_populates="class_group")


class Parent(Base):
    __tablename__ = "parents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    class_group_id: Mapped[str] = mapped_column(String(36), ForeignKey("class_groups.id", ondelete="CASCADE"), nullable=False)
    child_name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    opted_out: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    class_group: Mapped["ClassGroup"] = relationship("ClassGroup", back_populates="parents")
    call_logs: Mapped[list["CallLog"]] = relationship("CallLog", back_populates="parent")


class CallCampaign(Base):
    __tablename__ = "call_campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    class_group_id: Mapped[str] = mapped_column(String(36), ForeignKey("class_groups.id"), nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[Language] = mapped_column(Enum(Language), default=Language.hindi)
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.pending)
    total_parents: Mapped[int] = mapped_column(Integer, default=0)
    done_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    class_group: Mapped["ClassGroup"] = relationship("ClassGroup", back_populates="campaigns")
    creator: Mapped["User"] = relationship("User", back_populates="campaigns")
    call_logs: Mapped[list["CallLog"]] = relationship("CallLog", back_populates="campaign", cascade="all, delete-orphan")


class CallLog(Base):
    __tablename__ = "call_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    campaign_id: Mapped[str] = mapped_column(String(36), ForeignKey("call_campaigns.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[str] = mapped_column(String(36), ForeignKey("parents.id"), nullable=False)
    status: Mapped[CallStatus] = mapped_column(Enum(CallStatus), default=CallStatus.queued)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    ai_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    twilio_call_sid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    campaign: Mapped["CallCampaign"] = relationship("CallCampaign", back_populates="call_logs")
    parent: Mapped["Parent"] = relationship("Parent", back_populates="call_logs")
