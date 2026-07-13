"""Seed two institutions with users/students for isolation tests."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    InstitutionModel,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel, UserRoleAssignmentModel
from app.shared.enums import RiskLevel, StudentStatus, UserRole, UserStatus


@dataclass
class TenantWorld:
    institution_a_id: int
    institution_b_id: int
    term_a_id: int
    term_b_id: int
    course_a_id: int
    course_a2_id: int
    course_b_id: int
    admin_a_id: int
    dece_a_id: int
    dece_b_id: int
    tutor_a_id: int
    guardian_a_id: int
    student_a_id: int
    student_a_other_id: int
    student_b_id: int

    def auth(self, user_id: int, role: UserRole) -> dict[str, str]:
        token = create_access_token(subject=str(user_id), role=role.value)
        return {"Authorization": f"Bearer {token}"}


async def seed_tenant_world(session: AsyncSession) -> TenantWorld:
    inst_a = InstitutionModel(name="Colegio A", code="COL-A")
    inst_b = InstitutionModel(name="Colegio B", code="COL-B")
    session.add_all([inst_a, inst_b])
    await session.flush()

    term_a = AcademicTermModel(
        institution_id=inst_a.id,
        name="2025-2026 A",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 7, 31),
        is_active=True,
    )
    term_b = AcademicTermModel(
        institution_id=inst_b.id,
        name="2025-2026 B",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 7, 31),
        is_active=True,
    )
    session.add_all([term_a, term_b])
    await session.flush()

    pwd = get_password_hash("test-pass-123")

    async def _user(
        *,
        username: str,
        institution_id: int,
        role: UserRole,
        first: str,
        last: str,
    ) -> UserModel:
        user = UserModel(
            institution_id=institution_id,
            username=username,
            first_name=first,
            last_name=last,
            national_id=None,
            email=f"{username}@test.local",
            password_hash=pwd,
            status=UserStatus.ACTIVO,
        )
        session.add(user)
        await session.flush()
        session.add(UserRoleAssignmentModel(user_id=user.id, role=role))
        await session.flush()
        return user

    admin_a = await _user(
        username="admin_a", institution_id=inst_a.id, role=UserRole.ADMINISTRADOR, first="Admin", last="A"
    )
    dece_a = await _user(
        username="dece_a", institution_id=inst_a.id, role=UserRole.DECE, first="Dece", last="A"
    )
    dece_b = await _user(
        username="dece_b", institution_id=inst_b.id, role=UserRole.DECE, first="Dece", last="B"
    )
    tutor_a = await _user(
        username="tutor_a", institution_id=inst_a.id, role=UserRole.TUTOR, first="Tutor", last="A"
    )
    guardian_a = await _user(
        username="rep_a",
        institution_id=inst_a.id,
        role=UserRole.REPRESENTANTE,
        first="Rep",
        last="A",
    )

    course_a = CourseModel(
        institution_id=inst_a.id,
        academic_term_id=term_a.id,
        tutor_id=tutor_a.id,
        grade_level="1BGU",
        section="A",
        name="1BGU-A",
    )
    course_a2 = CourseModel(
        institution_id=inst_a.id,
        academic_term_id=term_a.id,
        tutor_id=None,
        grade_level="1BGU",
        section="B",
        name="1BGU-B",
    )
    course_b = CourseModel(
        institution_id=inst_b.id,
        academic_term_id=term_b.id,
        tutor_id=None,
        grade_level="1BGU",
        section="A",
        name="1BGU-A-B",
    )
    session.add_all([course_a, course_a2, course_b])
    await session.flush()

    student_a = StudentModel(
        institution_id=inst_a.id,
        course_id=course_a.id,
        first_name="Estudiante",
        last_name="Alpha",
        national_id="1000000001",
        guardian_id=guardian_a.id,
        status=StudentStatus.ACTIVO,
        current_risk_level=RiskLevel.BAJO,
    )
    student_a_other = StudentModel(
        institution_id=inst_a.id,
        course_id=course_a2.id,
        first_name="Estudiante",
        last_name="Otro",
        national_id="1000000002",
        guardian_id=None,
        status=StudentStatus.ACTIVO,
        current_risk_level=RiskLevel.BAJO,
    )
    student_b = StudentModel(
        institution_id=inst_b.id,
        course_id=course_b.id,
        first_name="Estudiante",
        last_name="Beta",
        national_id="2000000001",
        guardian_id=None,
        status=StudentStatus.ACTIVO,
        current_risk_level=RiskLevel.BAJO,
    )
    session.add_all([student_a, student_a_other, student_b])
    await session.commit()

    return TenantWorld(
        institution_a_id=inst_a.id,
        institution_b_id=inst_b.id,
        term_a_id=term_a.id,
        term_b_id=term_b.id,
        course_a_id=course_a.id,
        course_a2_id=course_a2.id,
        course_b_id=course_b.id,
        admin_a_id=admin_a.id,
        dece_a_id=dece_a.id,
        dece_b_id=dece_b.id,
        tutor_a_id=tutor_a.id,
        guardian_a_id=guardian_a.id,
        student_a_id=student_a.id,
        student_a_other_id=student_a_other.id,
        student_b_id=student_b.id,
    )
