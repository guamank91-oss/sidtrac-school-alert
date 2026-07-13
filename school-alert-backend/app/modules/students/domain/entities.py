from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.shared.enums import RiskLevel, StudentStatus


@dataclass
class Student:
    id: int
    institution_id: int
    course_id: int
    first_name: str
    last_name: str
    status: StudentStatus
    current_risk_level: RiskLevel
    national_id: Optional[str] = None
    guardian_id: Optional[int] = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
