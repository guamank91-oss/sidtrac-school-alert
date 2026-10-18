from __future__ import annotations

from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.institution.infrastructure.models import CourseModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.students.schemas import GuardianSummary, StudentCreate, StudentResponse, StudentUpdate
from app.modules.users.infrastructure.models import UserModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import RiskLevel, StudentStatus, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.term_resolver import resolve_term
from app.shared.tenant import assert_same_institution, resolve_institution_id


class StudentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_students(
        self,
        current_user: CurrentUser,
        institution_id: Optional[int] = None,
        course_id: Optional[int] = None,
        term_id: Optional[int] = None,
        search: Optional[str] = None,
        risk_level: Optional[RiskLevel] = None,
        status: Optional[StudentStatus] = None,
    ) -> list[StudentResponse]:
        query = (
            select(StudentModel, CourseModel.name)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .options(selectinload(StudentModel.guardian))
        )

        inst_id = resolve_institution_id(current_user, institution_id)
        query = query.where(StudentModel.institution_id == inst_id)

        term = await resolve_term(self.session, inst_id, term_id)
        query = query.where(CourseModel.academic_term_id == term.id)

        if current_user.active_role == UserRole.TUTOR:
            tutor_courses = await self.session.execute(
                select(CourseModel.id).where(
                    CourseModel.institution_id == inst_id,
                    CourseModel.tutor_id == current_user.id,
                )
            )
            course_ids = [row[0] for row in tutor_courses.all()]
            if not course_ids:
                return []
            query = query.where(StudentModel.course_id.in_(course_ids))

        if current_user.active_role == UserRole.REPRESENTANTE:
            query = query.where(StudentModel.guardian_id == current_user.id)

        if course_id:
            query = query.where(StudentModel.course_id == course_id)
        if risk_level:
            query = query.where(StudentModel.current_risk_level == risk_level)
        if status:
            query = query.where(StudentModel.status == status)
        else:
            query = query.where(StudentModel.status == StudentStatus.ACTIVO)
        if search:
            term = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    StudentModel.first_name.ilike(term),
                    StudentModel.last_name.ilike(term),
                    StudentModel.national_id.ilike(term),
                )
            )

        result = await self.session.execute(
            query.order_by(StudentModel.last_name, StudentModel.first_name)
        )
        return [
            self._to_response(student, course_name)
            for student, course_name in result.all()
        ]

    async def get_student(self, student_id: int, current_user: CurrentUser) -> StudentResponse:
        result = await self.session.execute(
            select(StudentModel, CourseModel.name)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .where(StudentModel.id == student_id)
            .options(selectinload(StudentModel.guardian))
        )
        row = result.one_or_none()
        if row is None:
            raise NotFoundError("Student")
        student, course_name = row
        await self._ensure_can_view(student, current_user)
        return self._to_response(student, course_name)

    async def create_student(
        self, data: StudentCreate, current_user: CurrentUser
    ) -> StudentResponse:
        self._ensure_can_manage(current_user)
        institution_id = resolve_institution_id(current_user, data.institution_id)
        await self._validate_course(institution_id, data.course_id)
        await self._validate_guardian(
            data.guardian_id, institution_id, required=True
        )
        if data.national_id:
            await self._ensure_unique_national_id(data.national_id, institution_id)

        payload = data.model_dump()
        payload["institution_id"] = institution_id
        student = StudentModel(**payload)
        self.session.add(student)
        await self.session.flush()
        student_id = student.id
        await self.session.commit()
        return await self.get_student(student_id, current_user)

    async def update_student(
        self, student_id: int, data: StudentUpdate, current_user: CurrentUser
    ) -> StudentResponse:
        self._ensure_can_manage(current_user)
        result = await self.session.execute(
            select(StudentModel).where(StudentModel.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        payload = data.model_dump(exclude_unset=True)
        if "course_id" in payload:
            await self._validate_course(student.institution_id, payload["course_id"])
        if "guardian_id" in payload:
            await self._validate_guardian(
                payload["guardian_id"], student.institution_id, required=True
            )
        if "national_id" in payload and payload["national_id"]:
            await self._ensure_unique_national_id(
                payload["national_id"], student.institution_id, exclude_id=student_id
            )

        for key, value in payload.items():
            setattr(student, key, value)

        await self.session.commit()
        return await self.get_student(student_id, current_user)

    async def _validate_course(self, institution_id: int, course_id: int) -> CourseModel:
        result = await self.session.execute(
            select(CourseModel).where(
                CourseModel.id == course_id,
                CourseModel.institution_id == institution_id,
            )
        )
        course = result.scalar_one_or_none()
        if course is None:
            raise ValidationError("Course not found for this institution")
        return course

    async def _validate_guardian(
        self, guardian_id: Optional[int], institution_id: int, *, required: bool = False
    ) -> None:
        if guardian_id is None:
            if required:
                raise ValidationError("A guardian (representante) is required")
            return
        result = await self.session.execute(
            select(UserModel)
            .where(
                UserModel.id == guardian_id,
                UserModel.institution_id == institution_id,
            )
            .options(selectinload(UserModel.role_assignments))
        )
        guardian = result.scalar_one_or_none()
        if guardian is None:
            raise NotFoundError("Guardian")
        if UserRole.REPRESENTANTE not in guardian.roles:
            raise ValidationError("Assigned user does not have guardian role")

    async def _ensure_unique_national_id(
        self, national_id: str, institution_id: int, exclude_id: Optional[int] = None
    ) -> None:
        query = select(StudentModel.id).where(
            StudentModel.institution_id == institution_id,
            StudentModel.national_id == national_id,
        )
        if exclude_id:
            query = query.where(StudentModel.id != exclude_id)
        exists = await self.session.execute(query)
        if exists.scalar_one_or_none():
            raise ValidationError("National ID already registered for a student")

    async def _ensure_can_view(self, student: StudentModel, current_user: CurrentUser) -> None:
        assert_same_institution(current_user, student.institution_id)
        if current_user.active_role in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            return
        if current_user.active_role == UserRole.TUTOR:
            result = await self.session.execute(
                select(CourseModel.id).where(
                    CourseModel.id == student.course_id,
                    CourseModel.tutor_id == current_user.id,
                )
            )
            if result.scalar_one_or_none() is None:
                raise ForbiddenError("You can only view students from your assigned course")
            return
        if current_user.active_role == UserRole.REPRESENTANTE:
            if student.guardian_id != current_user.id:
                raise ForbiddenError("You can only view your assigned children")
            return
        raise ForbiddenError("Insufficient permissions to view this student")

    def _ensure_can_manage(self, current_user: CurrentUser) -> None:
        if current_user.active_role not in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            raise ValidationError("Only administrators or DECE staff can manage students")

    def _to_response(self, student: StudentModel, course_name: str) -> StudentResponse:
        guardian = None
        if student.guardian:
            guardian = GuardianSummary(
                id=student.guardian.id,
                username=student.guardian.username,
                first_name=student.guardian.first_name,
                last_name=student.guardian.last_name,
                email=student.guardian.email,
                national_id=student.guardian.national_id,
            )
        return StudentResponse(
            id=student.id,
            institution_id=student.institution_id,
            course_id=student.course_id,
            course_name=course_name,
            first_name=student.first_name,
            last_name=student.last_name,
            national_id=student.national_id,
            birth_date=student.birth_date,
            gender=student.gender,
            guardian_id=student.guardian_id,
            guardian=guardian,
            status=student.status,
            current_risk_level=student.current_risk_level,
        )
