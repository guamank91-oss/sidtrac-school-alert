from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class CaseCreate(BaseModel):
    student_id: int
    title: str = Field(min_length=3, max_length=200)
    opening_summary: Optional[str] = None
    alert_ids: list[int] = Field(default_factory=list)


class TriageConfirmRequest(BaseModel):
    routine_plan_allowed: bool
    protocol_review_required: bool
    protocol_type: Optional[str] = None
    urgency: str = "normal"
    outcome: str = Field(
        description="discarded | attended_without_case | converted_to_case | open | under_assessment"
    )
    confirm: bool = True
    reasons: list[str] = Field(default_factory=list)


class ProtocolCreate(BaseModel):
    protocol_type: str
    reason: str
    student_id: Optional[int] = None  # defaults to case student


class ProtocolStatusUpdate(BaseModel):
    status: str


class ReferralCreate(BaseModel):
    destination: str
    reason: str
    referral_date: Optional[date] = None
    notes: Optional[str] = None


class TriageSuggestionResponse(BaseModel):
    routine_plan_allowed: bool
    protocol_review_required: bool
    protocol_type: Optional[str]
    urgency: str
    flags: list[str]
    reasons: list[str]


class TriageResponse(BaseModel):
    id: int
    case_id: int
    routine_plan_allowed: bool
    protocol_review_required: bool
    protocol_type: Optional[str]
    urgency: str
    professional_confirmed: bool
    outcome: Optional[str]
    suggestion: Optional[TriageSuggestionResponse] = None


class CaseResponse(BaseModel):
    id: int
    institution_id: int
    student_id: int
    status: str
    title: str
    opening_summary: Optional[str]
    opened_by: int
    alert_ids: list[int] = Field(default_factory=list)
    triage: Optional[TriageResponse] = None
    created_at: datetime

    # Sensitive triage details only when caller has professional capability
    professional_view: bool = False


class ProtocolResponse(BaseModel):
    id: int
    institution_id: int
    student_id: int
    case_id: Optional[int]
    protocol_type: str
    status: str
    reason: str
    reported_by: int
    activated_by: Optional[int]


class ReferralResponse(BaseModel):
    id: int
    case_id: int
    destination: str
    reason: str
    registered_by: int
    referral_date: Optional[date]
    notes: Optional[str]
