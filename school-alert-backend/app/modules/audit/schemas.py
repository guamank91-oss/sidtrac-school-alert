from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: str
    action: str
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
