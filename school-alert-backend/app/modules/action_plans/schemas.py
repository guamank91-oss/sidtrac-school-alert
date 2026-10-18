from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class PlanItemIn(BaseModel):
    title: str
    objective: str
    responsible_role: str = "dece"
    assignee_user_id: Optional[int] = None
    due_at: Optional[datetime] = None
    due_hint: Optional[str] = None
    evidence_required: bool = False
    priority: int = 1
    confidentiality_level: str = "professional"
    case_dimension: Optional[str] = None
    dece_axis: Optional[str] = None
    action_type: Optional[str] = None
    expected_result: Optional[str] = None
    success_indicator: Optional[str] = None
    rationale: Optional[str] = None
    supporting_roles: Optional[str] = None


class NormativeRefIn(BaseModel):
    document_code: str
    version: str
    article: str
    article_title: str
    effective_from: date
    source_chunk_id: str
    article_id: Optional[int] = None


class ActionPlanCreate(BaseModel):
    case_id: int
    plan_type: str = "psychosocial_attention_followup"
    general_objective: str
    limitations: Optional[str] = None
    review_criteria: Optional[str] = None
    opening_reason: Optional[str] = None
    review_at_hint: Optional[str] = None
    document_json: Optional[str] = None
    items: list[PlanItemIn] = Field(default_factory=list)
    normative_references: list[NormativeRefIn] = Field(default_factory=list)


class ItemStatusUpdate(BaseModel):
    status: str


class ItemProgressRequest(BaseModel):
    note: Optional[str] = None


class ItemValidateRequest(BaseModel):
    approved: bool = True
    comment: Optional[str] = None


class PlanNoteCreate(BaseModel):
    text: str
    visibility_scope: str = "professional"
    item_id: Optional[int] = None
    note_kind: Optional[str] = None


class EvidenceCreate(BaseModel):
    item_id: Optional[int] = None
    filename: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str
    object_key: str
    storage_backend: str = "local"
    confidentiality_level: str = "professional"


class PlanApproveRequest(BaseModel):
    comment: Optional[str] = None


class PlanItemOut(BaseModel):
    id: int
    title: str
    objective: str
    status: str
    responsible_role: str
    assignee_user_id: Optional[int]
    due_at: Optional[datetime] = None
    due_hint: Optional[str]
    evidence_required: bool
    priority: int
    case_dimension: Optional[str] = None
    dece_axis: Optional[str] = None
    action_type: Optional[str] = None
    expected_result: Optional[str] = None
    success_indicator: Optional[str] = None
    rationale: Optional[str] = None
    supporting_roles: Optional[str] = None


class PlanNoteOut(BaseModel):
    id: int
    text: str
    visibility_scope: str
    author_id: int
    created_at: datetime
    item_id: Optional[int] = None
    note_kind: Optional[str] = None


class ActionPlanOut(BaseModel):
    id: int
    case_id: int
    institution_id: int
    plan_type: str
    version: int
    status: str
    general_objective: str
    limitations: Optional[str] = None
    review_criteria: Optional[str] = None
    opening_reason: Optional[str] = None
    review_at_hint: Optional[str] = None
    document_json: Optional[str] = None
    items: list[PlanItemOut]
    notes: list[PlanNoteOut] = Field(default_factory=list)
    normative_references: list[NormativeRefIn] = Field(default_factory=list)
    validated_progress_pct: int = 0
