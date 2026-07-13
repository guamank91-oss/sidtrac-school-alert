from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class RiskDistribution(BaseModel):
    level: str
    count: int
    previous_month: int


class LevelCount(BaseModel):
    level: str
    count: int


class PeriodSummary(BaseModel):
    term_id: int
    term_name: str
    start_date: date
    end_date: date
    students: int
    alerts_total: int
    alerts_by_level: list[LevelCount]
    alerts_attended: int
    dece_reports: int
    disciplinary_reports: int
    tutor_annotations: int
    average_score: Optional[float]
    attendance_rate: Optional[float]
    risk_distribution: list[LevelCount]


class PeriodComparison(BaseModel):
    period_a: PeriodSummary
    period_b: Optional[PeriodSummary] = None


class InstitutionalReport(BaseModel):
    total_students: int
    distribution: list[RiskDistribution]
    active_alerts: int
    attended_alerts_month: int
    alerts_by_type: list[dict]
    generated_at: datetime


class StudentReportGrade(BaseModel):
    subject: str
    average: float
    grades_count: int


class StudentReportEntry(BaseModel):
    date: str
    type: str
    description: str
    author: Optional[str] = None


class StudentFullReport(BaseModel):
    student_id: int
    full_name: str
    national_id: Optional[str]
    course_name: str
    guardian_name: Optional[str]
    risk_level: str
    average_score: Optional[float]
    attendance_rate: Optional[float]
    absences_30d: int
    grades_by_subject: list[StudentReportGrade]
    dece_reports: list[StudentReportEntry]
    tutor_annotations: list[StudentReportEntry]
    disciplinary_reports: list[StudentReportEntry]
    alerts: list[StudentReportEntry]
    generated_at: datetime
