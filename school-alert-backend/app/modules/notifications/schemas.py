from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.shared.enums import EmailStatus


class EmailNotificationResponse(BaseModel):
    id: int
    alert_id: Optional[int]
    recipient: str
    subject: str
    status: EmailStatus
    resend_id: Optional[str]
    error_detail: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class TestEmailRequest(BaseModel):
    recipient: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class InternalNotificationResponse(BaseModel):
    id: int
    alert_id: Optional[int]
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
