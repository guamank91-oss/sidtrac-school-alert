"""Student identity ficha JSON for grounded RAG answers."""
from __future__ import annotations

from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.institution.infrastructure.models import (
    CourseSubjectModel,
    SubjectModel,
)
from app.modules.rag.application.student_profile import load_student_ficha
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_ficha_includes_age_tutor_and_subjects(
    db_session: AsyncSession, world: TenantWorld
):
    student = await db_session.get(StudentModel, world.student_a_id)
    assert student is not None
    student.birth_date = date(2010, 1, 15)
    await db_session.flush()

    subject = SubjectModel(
        institution_id=world.institution_a_id,
        name="Matemáticas",
        code="MAT",
        weekly_hours=5,
    )
    db_session.add(subject)
    await db_session.flush()

    teacher = await db_session.get(UserModel, world.tutor_a_id)
    assert teacher is not None

    db_session.add(
        CourseSubjectModel(
            course_id=world.course_a_id,
            subject_id=subject.id,
            teacher_id=world.tutor_a_id,
        )
    )
    await db_session.flush()

    ficha = await load_student_ficha(db_session, student)

    assert ficha["student"]["full_name"]
    assert ficha["student"]["birth_date"] == "2010-01-15"
    assert ficha["student"]["age_years"] == (
        date.today().year
        - 2010
        - ((date.today().month, date.today().day) < (1, 15))
    )
    assert ficha["tutor"] is not None
    assert ficha["tutor"]["user_id"] == world.tutor_a_id
    assert "Tutor" in ficha["tutor"]["full_name"]
    assert ficha["course"]["name"]
    assert any(row["subject"] == "Matemáticas" for row in ficha["subject_teachers"])


@pytest.mark.asyncio
async def test_ficha_tutor_null_when_course_has_no_tutor(
    db_session: AsyncSession, world: TenantWorld
):
    from app.modules.institution.infrastructure.models import CourseModel

    course = await db_session.get(CourseModel, world.course_a2_id)
    assert course is not None
    course.tutor_id = None
    await db_session.flush()

    student = await db_session.get(StudentModel, world.student_a_other_id)
    assert student is not None

    ficha = await load_student_ficha(db_session, student)
    assert ficha["tutor"] is None
    assert ficha["subject_teachers"] == []


def test_format_ficha_block_marker():
    from app.modules.rag.application.student_profile import format_ficha_block

    text = format_ficha_block(
        {"student": {"full_name": "Ada", "birth_date": None, "age_years": None}}
    )
    assert "DATOS_FICHA_JSON" in text
    assert "Ada" in text


def test_merge_keeps_ficha_with_plan_json():
    from app.modules.rag.application.student_profile import (
        format_ficha_block,
        merge_structured_with_ficha,
    )

    ficha = format_ficha_block({"student": {"full_name": "Ada"}})
    plan = '=== DATOS_ESTRUCTURADOS_JSON ===\n{"has_active_plan": true}\n'
    merged = merge_structured_with_ficha(plan, ficha)
    assert "DATOS_FICHA_JSON" in merged
    assert "DATOS_ESTRUCTURADOS_JSON" in merged
    assert merged.index("DATOS_FICHA_JSON") < merged.index("DATOS_ESTRUCTURADOS_JSON")
