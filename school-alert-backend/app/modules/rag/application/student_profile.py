"""Structured student identity card for grounded RAG answers."""
from __future__ import annotations

import json
from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    CourseSubjectModel,
    SubjectModel,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel


def _full_name(user: UserModel | None) -> Optional[str]:
    if user is None:
        return None
    return f"{user.first_name} {user.last_name}".strip() or None


def _age_years(birth: Optional[date], today: date | None = None) -> Optional[int]:
    if birth is None:
        return None
    today = today or date.today()
    years = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        years -= 1
    return years


async def load_student_ficha(
    session: AsyncSession, student: StudentModel
) -> dict[str, Any]:
    course = (
        await session.get(CourseModel, student.course_id)
        if student.course_id
        else None
    )
    term_name: Optional[str] = None
    tutor_payload: Optional[dict[str, Any]] = None
    subject_teachers: list[dict[str, str]] = []

    if course is not None:
        term = await session.get(AcademicTermModel, course.academic_term_id)
        term_name = term.name if term else None
        if course.tutor_id:
            tutor = await session.get(UserModel, course.tutor_id)
            name = _full_name(tutor)
            if name:
                tutor_payload = {"full_name": name, "user_id": course.tutor_id}

        rows = (
            await session.execute(
                select(SubjectModel.name, UserModel.first_name, UserModel.last_name)
                .join(CourseSubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
                .join(UserModel, UserModel.id == CourseSubjectModel.teacher_id)
                .where(CourseSubjectModel.course_id == course.id)
                .order_by(SubjectModel.name)
            )
        ).all()
        for subject_name, first, last in rows:
            subject_teachers.append(
                {
                    "subject": subject_name,
                    "teacher": f"{first} {last}".strip(),
                }
            )

    guardian_payload: Optional[dict[str, Any]] = None
    if student.guardian_id:
        guardian = await session.get(UserModel, student.guardian_id)
        gname = _full_name(guardian)
        if gname:
            guardian_payload = {"full_name": gname, "user_id": student.guardian_id}

    return {
        "student": {
            "full_name": f"{student.first_name} {student.last_name}".strip(),
            "birth_date": student.birth_date.isoformat() if student.birth_date else None,
            "age_years": _age_years(student.birth_date),
        },
        "course": {
            "name": course.name if course else None,
            "grade_level": course.grade_level if course else None,
            "section": course.section if course else None,
            "term_name": term_name,
        },
        "tutor": tutor_payload,
        "guardian": guardian_payload,
        "subject_teachers": subject_teachers,
    }


def format_ficha_block(ficha: dict[str, Any]) -> str:
    return (
        "=== DATOS_FICHA_JSON (identidad del estudiante; "
        "úsalo para edad, tutor del curso, representante, docentes por materia) ===\n"
        f"{json.dumps(ficha, ensure_ascii=False, indent=2)}\n"
    )


def merge_structured_with_ficha(structured: str, ficha_block: str) -> str:
    """Always put ficha first; keep any plan/academic structured body after."""
    body = (structured or "").strip()
    return f"{ficha_block.strip()}\n\n{body}".strip() + "\n"
