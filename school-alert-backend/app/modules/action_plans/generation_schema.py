"""Strict AI draft schema for action plan generation (does not persist)."""
from __future__ import annotations

from datetime import date as DateValue
from typing import Literal, Optional

from pydantic import BaseModel, Field


class GenerationTriage(BaseModel):
    routine_plan_allowed: bool = True
    protocol_review_required: bool = False
    protocol_type: Optional[str] = None
    urgency: Literal["normal", "high", "critical"] = "normal"
    flags: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    professional_confirmation_required: list[str] = Field(default_factory=list)
    immediate_integrity_risk: str = "No identificado en los registros disponibles"
    violence_presumption: str = "Sin evidencia registrada"
    self_harm_risk: str = "Sin evidencia registrada"
    rights_violation: str = "Requiere entrevista y verificación profesional"
    repeated_absences: str = "Por confirmar"
    urgent_protocol_needed: str = "No confirmada actualmente"


class FactItem(BaseModel):
    fact_id: str
    text: str
    source: str
    date: Optional[DateValue] = None


class InferenceItem(BaseModel):
    text: str
    based_on_fact_ids: list[str] = Field(default_factory=list)


class GenerationAssessment(BaseModel):
    situation_summary: str
    opening_reason: str = ""
    facts: list[FactItem] = Field(default_factory=list)
    inferences: list[InferenceItem] = Field(default_factory=list)
    protective_factors: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)


class GenerationPlan(BaseModel):
    plan_type: str = "psychosocial_attention_followup"
    general_objective: str
    limitations: list[str] = Field(default_factory=list)
    review_criteria: str = ""
    review_at_hint: Optional[str] = None
    review_triggers: list[str] = Field(default_factory=list)


class GenerationAction(BaseModel):
    title: str
    objective: str
    action_type: str = "followup"
    dece_axis: str = "psychosocial_attention"
    case_dimension: str = "academic"
    rationale: str = ""
    source_fact_ids: list[str] = Field(default_factory=list)
    responsible_role: str = "dece"
    supporting_roles: list[str] = Field(default_factory=list)
    due_hint: str = ""
    expected_result: str = ""
    success_indicator: str = ""
    evidence_required: bool = True
    priority: int = 1
    confidentiality_level: str = "professional"
    normative_hint: Optional[str] = None


class GenerationNormativeRef(BaseModel):
    document_code: str
    document_name: str
    version: str
    article: str
    article_title: str
    effective_from: DateValue
    source_chunk_id: str


class ActionPlanGeneration(BaseModel):
    triage: GenerationTriage
    assessment: GenerationAssessment
    plan: GenerationPlan
    actions: list[GenerationAction]
    normative_references: list[GenerationNormativeRef] = Field(default_factory=list)
    draft_origin: Literal["ai", "local_fallback"] = "ai"
    context_course: Optional[str] = None
    context_risk: Optional[str] = None


class GenerateRequest(BaseModel):
    case_id: int
    question_focus: Optional[str] = None
