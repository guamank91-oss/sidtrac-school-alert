from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class InstitutionCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    code: str = Field(min_length=2, max_length=50)
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    plan_tier: str = Field(default="pro")  # basico, pro, enterprise


class InstitutionStatusUpdateRequest(BaseModel):
    status: str = Field(...)  # activa, prueba_gratuita, suspendida
    plan_tier: Optional[str] = None


class SaaSGlobalMetrics(BaseModel):
    total_institutions: int
    active_institutions: int
    suspended_institutions: int
    total_students: int
    total_users: int
    total_alerts_generated: int
    total_ai_tokens_consumed: int
    active_superadmins: int


class SaaSInstitutionItem(BaseModel):
    id: int
    name: str
    code: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    status: str
    plan_tier: str
    ai_token_count: int
    student_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
