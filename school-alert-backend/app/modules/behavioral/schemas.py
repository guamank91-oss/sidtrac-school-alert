from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.shared.enums import DeceReportType, FaultType, RiskLevel, TutorAnnotationType


class DeceReportCreate(BaseModel):
    student_id: int
    report_type: DeceReportType
    description: str = Field(min_length=5)
    actions_taken: Optional[str] = None
    urgency_level: RiskLevel = RiskLevel.BAJO
    requires_follow_up: bool = False


class DeceReportResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    course_name: str
    dece_user_id: int
    author_name: str
    report_type: DeceReportType
    description: str
    actions_taken: Optional[str]
    urgency_level: RiskLevel
    requires_follow_up: bool
    reported_at: datetime


class DeceReportUpdate(BaseModel):
    report_type: Optional[DeceReportType] = None
    description: Optional[str] = Field(default=None, min_length=5)
    actions_taken: Optional[str] = None
    urgency_level: Optional[RiskLevel] = None
    requires_follow_up: Optional[bool] = None


class TutorAnnotationCreate(BaseModel):
    student_id: int
    annotation_type: TutorAnnotationType
    description: str = Field(min_length=5)


class TutorAnnotationUpdate(BaseModel):
    annotation_type: Optional[TutorAnnotationType] = None
    description: Optional[str] = Field(default=None, min_length=5)


class TutorAnnotationResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    course_name: str
    tutor_id: int
    author_name: str
    annotation_type: TutorAnnotationType
    description: str
    annotated_at: datetime


class DisciplinaryReportCreate(BaseModel):
    student_id: int
    fault_type: FaultType
    description: str = Field(min_length=5)
    sanction: Optional[str] = None


class DisciplinaryReportUpdate(BaseModel):
    fault_type: Optional[FaultType] = None
    description: Optional[str] = Field(default=None, min_length=5)
    sanction: Optional[str] = None


class DisciplinaryReportResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    course_name: str
    inspector_id: int
    author_name: str
    fault_type: FaultType
    description: str
    sanction: Optional[str]
    reported_at: datetime


class TimelineEntry(BaseModel):
    id: int
    source: Literal["dece", "tutor", "disciplinary"]
    date: datetime
    type: str
    type_label: str
    description: str
    author_name: str
    urgency_level: Optional[RiskLevel] = None
    requires_follow_up: Optional[bool] = None
    actions_taken: Optional[str] = None
    sanction: Optional[str] = None


class BehavioralSummary(BaseModel):
    dece_reports: int
    tutor_annotations: int
    disciplinary_reports: int
    high_urgency_reports: int
    follow_up_pending: int
