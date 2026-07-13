from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.shared.enums import RiskLevel, StudentStatus


class StudentCreate(BaseModel):
    institution_id: int
    course_id: int
    first_name: str
    last_name: str
    national_id: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    guardian_id: Optional[int] = Field(None, description="User ID with guardian role")


class StudentUpdate(BaseModel):
    course_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    national_id: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    guardian_id: Optional[int] = None
    status: Optional[StudentStatus] = None


class GuardianSummary(BaseModel):
    id: int
    username: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    national_id: Optional[str] = None

    model_config = {"from_attributes": True}


class StudentResponse(BaseModel):
    id: int
    institution_id: int
    course_id: int
    course_name: str
    first_name: str
    last_name: str
    national_id: Optional[str]
    birth_date: Optional[date]
    gender: Optional[str]
    guardian_id: Optional[int]
    guardian: Optional[GuardianSummary] = None
    status: StudentStatus
    current_risk_level: RiskLevel

    model_config = {"from_attributes": True}
