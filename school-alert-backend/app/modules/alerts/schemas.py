from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.shared.enums import AlertStatus, AlertType, RiskLevel


class AlertResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    course_name: str
    alert_type: AlertType
    level: RiskLevel
    description: str
    recommendations: Optional[str]
    status: AlertStatus
    is_manual: bool
    attended_by_name: Optional[str] = None
    actions_taken: Optional[str] = None
    attended_at: Optional[datetime] = None
    email_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ManualAlertCreate(BaseModel):
    student_id: int
    alert_type: AlertType
    level: RiskLevel
    description: str = Field(min_length=5)
    recommendations: Optional[str] = None


class AttendAlertRequest(BaseModel):
    actions_taken: str = Field(min_length=5)


class AlertConfigResponse(BaseModel):
    min_average: float
    absences_medium: int
    absences_high: int
    serious_faults_month: int
    sender_email: Optional[str]
    evaluation_hour: int

    model_config = {"from_attributes": True}


class AlertConfigUpdate(BaseModel):
    min_average: Optional[float] = Field(None, ge=0, le=10)
    absences_medium: Optional[int] = Field(None, ge=1, le=60)
    absences_high: Optional[int] = Field(None, ge=1, le=90)
    serious_faults_month: Optional[int] = Field(None, ge=1, le=30)
    sender_email: Optional[str] = None
    evaluation_hour: Optional[int] = Field(None, ge=0, le=23)


class EvaluationResult(BaseModel):
    students_evaluated: int
    alerts_created: int
    emails_sent: int
    internal_notifications: int


class AlertStats(BaseModel):
    active_critical: int
    active_high: int
    active_medium: int
    low_pct: float
    total_students: int
