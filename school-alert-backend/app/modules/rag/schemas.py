from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class RagQueryRequest(BaseModel):
    student_id: int
    question: str = Field(min_length=3, max_length=2000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)


class RagQueryResponse(BaseModel):
    answer: str
    detected_risk_level: Optional[str] = None
    sources: list[str] = Field(default_factory=list)
    model: str
    latency_ms: int
    used_llm: bool
    intent: Literal["student_query", "greeting", "off_topic", "too_vague"] = "student_query"


class RagHistoryEntry(BaseModel):
    id: int
    user_name: str
    student_name: str
    question: str
    answer: str
    model: str
    tokens_used: Optional[int]
    latency_ms: int
    detected_risk: Optional[str]
    created_at: datetime


class RagMetrics(BaseModel):
    total_queries: int
    queries_today: int
    avg_latency_ms: float
    queries_per_day: list[dict]
    models_used: list[dict]
