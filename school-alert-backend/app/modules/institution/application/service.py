from __future__ import annotations

from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    CourseSubjectModel,
    InstitutionModel,
    SubjectModel,
)
from app.modules.institution.schemas import (
    AcademicTermCreate,
    AcademicTermResponse,
    AcademicTermUpdate,
    CourseCreate,
    CourseResponse,
    CourseSubjectCreate,
    CourseSubjectResponse,
    CourseSubjectUpdate,
    CourseUpdate,
    InstitutionCreate,
    InstitutionResponse,
    InstitutionUpdate,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
)
from app.modules.users.infrastructure.models import UserModel
from app.shared.enums import UserRole
from app.shared.exceptions import NotFoundError, ValidationError


class InstitutionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_institutions(self) -> list[InstitutionResponse]:
        result = await self.session.execute(select(InstitutionModel))
        return [InstitutionResponse.model_validate(i) for i in result.scalars().all()]

    async def get_institution(self, institution_id: int) -> InstitutionResponse:
        inst = await self._get_institution(institution_id)
        return InstitutionResponse.model_validate(inst)

    async def create_institution(self, data: InstitutionCreate) -> InstitutionResponse:
        inst = InstitutionModel(**data.model_dump())
        self.session.add(inst)
        await self.session.commit()
        await self.session.refresh(inst)
        return InstitutionResponse.model_validate(inst)

    async def update_institution(
        self, institution_id: int, data: InstitutionUpdate
    ) -> InstitutionResponse:
        inst = await self._get_institution(institution_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(inst, key, value)
        await self.session.commit()
        await self.session.refresh(inst)
        return InstitutionResponse.model_validate(inst)

    async def list_terms(
        self, institution_id: Optional[int] = None
    ) -> list[AcademicTermResponse]:
        query = select(AcademicTermModel)
        if institution_id:
            query = query.where(AcademicTermModel.institution_id == institution_id)
        result = await self.session.execute(query.order_by(AcademicTermModel.start_date.desc()))
        return [AcademicTermResponse.model_validate(p) for p in result.scalars().all()]

    async def create_term(self, data: AcademicTermCreate) -> AcademicTermResponse:
        if data.end_date < data.start_date:
            raise ValidationError("End date must be after start date")
        await self._get_institution(data.institution_id)
        if data.is_active:
            await self._deactivate_terms(data.institution_id)
        term = AcademicTermModel(**data.model_dump())
        self.session.add(term)
        await self.session.commit()
        await self.session.refresh(term)
        return AcademicTermResponse.model_validate(term)

    async def update_term(
        self, term_id: int, data: AcademicTermUpdate
    ) -> AcademicTermResponse:
        term = await self._get_term(term_id)
        payload = data.model_dump(exclude_unset=True)
        if "start_date" in payload or "end_date" in payload:
            start = payload.get("start_date", term.start_date)
            end = payload.get("end_date", term.end_date)
            if end < start:
                raise ValidationError("End date must be after start date")
        if payload.get("is_active"):
            await self._deactivate_terms(term.institution_id, exclude_id=term_id)
        for key, value in payload.items():
            setattr(term, key, value)
        await self.session.commit()
        await self.session.refresh(term)
        return AcademicTermResponse.model_validate(term)

    async def activate_term(self, term_id: int) -> AcademicTermResponse:
        term = await self._get_term(term_id)
        await self._deactivate_terms(term.institution_id, exclude_id=term_id)
        term.is_active = True
        await self.session.commit()
        await self.session.refresh(term)
        return AcademicTermResponse.model_validate(term)

    async def list_courses(
        self, institution_id: Optional[int] = None, term_id: Optional[int] = None
    ) -> list[CourseResponse]:
        query = select(CourseModel)
        if institution_id:
            query = query.where(CourseModel.institution_id == institution_id)
        if term_id:
            query = query.where(CourseModel.academic_term_id == term_id)
        result = await self.session.execute(query.order_by(CourseModel.name))
        return [CourseResponse.model_validate(c) for c in result.scalars().all()]

    async def create_course(self, data: CourseCreate) -> CourseResponse:
        await self._get_institution(data.institution_id)
        await self._get_term(data.academic_term_id)
        if data.tutor_id:
            await self._validate_user_role(data.tutor_id, UserRole.TUTOR, "tutor")
        course = CourseModel(**data.model_dump())
        self.session.add(course)
        await self.session.commit()
        await self.session.refresh(course)
        return CourseResponse.model_validate(course)

    async def update_course(self, course_id: int, data: CourseUpdate) -> CourseResponse:
        course = await self._get_course(course_id)
        payload = data.model_dump(exclude_unset=True)
        if "tutor_id" in payload and payload["tutor_id"]:
            await self._validate_user_role(payload["tutor_id"], UserRole.TUTOR, "tutor")
        if "academic_term_id" in payload:
            await self._get_term(payload["academic_term_id"])
        for key, value in payload.items():
            setattr(course, key, value)
        await self.session.commit()
        await self.session.refresh(course)
        return CourseResponse.model_validate(course)

    async def delete_course(self, course_id: int) -> None:
        course = await self._get_course(course_id)
        await self.session.delete(course)
        await self.session.commit()

    async def list_subjects(
        self, institution_id: Optional[int] = None
    ) -> list[SubjectResponse]:
        query = select(SubjectModel)
        if institution_id:
            query = query.where(SubjectModel.institution_id == institution_id)
        result = await self.session.execute(query.order_by(SubjectModel.name))
        return [SubjectResponse.model_validate(m) for m in result.scalars().all()]

    async def create_subject(self, data: SubjectCreate) -> SubjectResponse:
        await self._get_institution(data.institution_id)
        subject = SubjectModel(**data.model_dump())
        self.session.add(subject)
        await self.session.commit()
        await self.session.refresh(subject)
        return SubjectResponse.model_validate(subject)

    async def update_subject(self, subject_id: int, data: SubjectUpdate) -> SubjectResponse:
        subject = await self._get_subject(subject_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(subject, key, value)
        await self.session.commit()
        await self.session.refresh(subject)
        return SubjectResponse.model_validate(subject)

    async def delete_subject(self, subject_id: int) -> None:
        subject = await self._get_subject(subject_id)
        await self.session.delete(subject)
        await self.session.commit()

    async def list_course_subjects(
        self, course_id: Optional[int] = None, institution_id: Optional[int] = None
    ) -> list[CourseSubjectResponse]:
        query = (
            select(CourseSubjectModel)
            .join(CourseModel, CourseSubjectModel.course_id == CourseModel.id)
            .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(UserModel, CourseSubjectModel.teacher_id == UserModel.id)
        )
        if course_id:
            query = query.where(CourseSubjectModel.course_id == course_id)
        if institution_id:
            query = query.where(CourseModel.institution_id == institution_id)
        result = await self.session.execute(query)
        rows = result.scalars().all()
        responses = []
        for row in rows:
            course = await self._get_course(row.course_id)
            subject = await self._get_subject(row.subject_id)
            teacher = await self._get_user(row.teacher_id)
            responses.append(
                CourseSubjectResponse(
                    id=row.id,
                    course_id=row.course_id,
                    subject_id=row.subject_id,
                    teacher_id=row.teacher_id,
                    course_name=course.name,
                    subject_name=subject.name,
                    teacher_name=f"{teacher.first_name} {teacher.last_name}",
                )
            )
        return responses

    async def create_course_subject(self, data: CourseSubjectCreate) -> CourseSubjectResponse:
        await self._get_course(data.course_id)
        await self._get_subject(data.subject_id)
        await self._validate_user_role(data.teacher_id, UserRole.DOCENTE, "teacher")
        exists = await self.session.execute(
            select(CourseSubjectModel).where(
                CourseSubjectModel.course_id == data.course_id,
                CourseSubjectModel.subject_id == data.subject_id,
            )
        )
        if exists.scalar_one_or_none():
            raise ValidationError("This subject is already assigned to the course")
        row = CourseSubjectModel(**data.model_dump())
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        items = await self.list_course_subjects(course_id=row.course_id)
        return next(i for i in items if i.id == row.id)

    async def update_course_subject(
        self, assignment_id: int, data: CourseSubjectUpdate
    ) -> CourseSubjectResponse:
        row = await self._get_course_subject(assignment_id)
        if data.teacher_id:
            await self._validate_user_role(data.teacher_id, UserRole.DOCENTE, "teacher")
            row.teacher_id = data.teacher_id
        await self.session.commit()
        await self.session.refresh(row)
        items = await self.list_course_subjects(course_id=row.course_id)
        return next(i for i in items if i.id == row.id)

    async def delete_course_subject(self, assignment_id: int) -> None:
        row = await self._get_course_subject(assignment_id)
        await self.session.delete(row)
        await self.session.commit()

    async def _deactivate_terms(
        self, institution_id: int, exclude_id: Optional[int] = None
    ) -> None:
        query = update(AcademicTermModel).where(
            AcademicTermModel.institution_id == institution_id
        )
        if exclude_id:
            query = query.where(AcademicTermModel.id != exclude_id)
        await self.session.execute(query.values(is_active=False))

    async def _validate_user_role(
        self, user_id: int, role: UserRole, label: str
    ) -> UserModel:
        user = await self._get_user(user_id)
        if role not in user.roles:
            raise ValidationError(f"Assigned user does not have role {label}")
        return user

    async def _get_institution(self, institution_id: int) -> InstitutionModel:
        result = await self.session.execute(
            select(InstitutionModel).where(InstitutionModel.id == institution_id)
        )
        inst = result.scalar_one_or_none()
        if inst is None:
            raise NotFoundError("Institution")
        return inst

    async def _get_term(self, term_id: int) -> AcademicTermModel:
        result = await self.session.execute(
            select(AcademicTermModel).where(AcademicTermModel.id == term_id)
        )
        term = result.scalar_one_or_none()
        if term is None:
            raise NotFoundError("Academic term")
        return term

    async def _get_course(self, course_id: int) -> CourseModel:
        result = await self.session.execute(select(CourseModel).where(CourseModel.id == course_id))
        course = result.scalar_one_or_none()
        if course is None:
            raise NotFoundError("Course")
        return course

    async def _get_subject(self, subject_id: int) -> SubjectModel:
        result = await self.session.execute(
            select(SubjectModel).where(SubjectModel.id == subject_id)
        )
        subject = result.scalar_one_or_none()
        if subject is None:
            raise NotFoundError("Subject")
        return subject

    async def _get_course_subject(self, assignment_id: int) -> CourseSubjectModel:
        result = await self.session.execute(
            select(CourseSubjectModel).where(CourseSubjectModel.id == assignment_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError("Course-subject assignment")
        return row

    async def _get_user(self, user_id: int) -> UserModel:
        result = await self.session.execute(
            select(UserModel)
            .where(UserModel.id == user_id)
            .options(selectinload(UserModel.role_assignments))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User")
        return user
