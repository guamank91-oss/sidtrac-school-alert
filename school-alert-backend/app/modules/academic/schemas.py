from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.shared.enums import AttendanceStatus


class AssignmentResponse(BaseModel):
    id: int
    course_id: int
    subject_id: int
    teacher_id: int
    course_name: str
    subject_name: str
    teacher_name: str
    can_edit: bool

    model_config = {"from_attributes": True}


class GradeRosterRow(BaseModel):
    student_id: int
    first_name: str
    last_name: str
    national_id: Optional[str]
    grade_id: Optional[int] = None
    score: Optional[Decimal] = None
    notes: Optional[str] = None


class GradeBulkItem(BaseModel):
    student_id: int
    score: Decimal = Field(ge=0, le=10)
    notes: Optional[str] = None

    @field_validator("score")
    @classmethod
    def round_score(cls, value: Decimal) -> Decimal:
        return value.quantize(Decimal("0.01"))


class GradeBulkRequest(BaseModel):
    course_subject_id: int
    quarter: int = Field(ge=1, le=2)
    partial: int = Field(ge=1, le=3)
    grades: list[GradeBulkItem]


class GradeResponse(BaseModel):
    id: int
    student_id: int
    course_subject_id: int
    teacher_id: int
    quarter: int
    partial: int
    score: Decimal
    notes: Optional[str]
    recorded_at: datetime


class AttendanceRosterRow(BaseModel):
    student_id: int
    first_name: str
    last_name: str
    national_id: Optional[str]
    attendance_id: Optional[int] = None
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None


class AttendanceBulkItem(BaseModel):
    student_id: int
    status: AttendanceStatus
    notes: Optional[str] = None


class AttendanceBulkRequest(BaseModel):
    course_subject_id: int
    attendance_date: date
    records: list[AttendanceBulkItem]


class AttendanceResponse(BaseModel):
    id: int
    student_id: int
    course_subject_id: int
    teacher_id: int
    attendance_date: date
    status: AttendanceStatus
    notes: Optional[str]
    created_at: datetime


class StudentAcademicSummary(BaseModel):
    student_id: int
    first_name: str
    last_name: str
    course_name: str
    average_score: Optional[float] = None
    absence_count: int
    tardy_count: int


class SubjectRadarPoint(BaseModel):
    subject: str
    value: float
    full_mark: float = 10


class MonthlyAttendancePoint(BaseModel):
    month: str
    attendance: float


class StudentAcademicProfile(BaseModel):
    student_id: int
    average_score: Optional[float] = None
    absence_count: int
    tardy_count: int
    attendance_rate: Optional[float] = None
    subject_scores: list[SubjectRadarPoint]
    attendance_trend: list[MonthlyAttendancePoint]
