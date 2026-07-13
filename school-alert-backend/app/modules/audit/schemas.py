from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: str
    institution_id: Optional[int] = None
    scope_type: Optional[str] = None
    action: str
    detail: Optional[str]
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    categories: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str]
    created_at: datetime
