from datetime import date
from typing import Optional

from pydantic import BaseModel


class InstitutionCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class InstitutionResponse(BaseModel):
    id: int
    name: str
    code: str
    address: Optional[str]
    phone: Optional[str]
    email: Optional[str]

    model_config = {"from_attributes": True}


class AcademicTermCreate(BaseModel):
    institution_id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool = False


class AcademicTermUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class AcademicTermResponse(BaseModel):
    id: int
    institution_id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    institution_id: int
    academic_term_id: int
    tutor_id: Optional[int] = None
    grade_level: str
    section: str
    name: str


class CourseUpdate(BaseModel):
    academic_term_id: Optional[int] = None
    tutor_id: Optional[int] = None
    grade_level: Optional[str] = None
    section: Optional[str] = None
    name: Optional[str] = None


class CourseResponse(BaseModel):
    id: int
    institution_id: int
    academic_term_id: int
    tutor_id: Optional[int]
    grade_level: str
    section: str
    name: str

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    institution_id: int
    name: str
    code: Optional[str] = None
    weekly_hours: Optional[int] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    weekly_hours: Optional[int] = None


class SubjectResponse(BaseModel):
    id: int
    institution_id: int
    name: str
    code: Optional[str]
    weekly_hours: Optional[int]

    model_config = {"from_attributes": True}


class CourseSubjectCreate(BaseModel):
    course_id: int
    subject_id: int
    teacher_id: int


class CourseSubjectUpdate(BaseModel):
    teacher_id: Optional[int] = None


class CourseSubjectResponse(BaseModel):
    id: int
    course_id: int
    subject_id: int
    teacher_id: int
    course_name: Optional[str] = None
    subject_name: Optional[str] = None
    teacher_name: Optional[str] = None

    model_config = {"from_attributes": True}
