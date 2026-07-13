from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.academic.schemas import (
    AssignmentResponse,
    AttendanceBulkRequest,
    AttendanceRosterRow,
    GradeBulkRequest,
    GradeRosterRow,
    MonthlyAttendancePoint,
    StudentAcademicProfile,
    StudentAcademicSummary,
    SubjectRadarPoint,
)
from app.modules.institution.infrastructure.models import CourseModel, CourseSubjectModel, SubjectModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import AttendanceStatus, StudentStatus, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.term_resolver import course_ids_for_term, resolve_term
from app.shared.tenant import assert_same_institution

LOW_GRADE_THRESHOLD = Decimal("7.00")
MONTH_LABELS = (
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
)


class AcademicService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_assignments(
        self, current_user: CurrentUser, term_id: Optional[int] = None
    ) -> list[AssignmentResponse]:
        rows = await self._assignment_rows(current_user, term_id=term_id)
        can_edit = current_user.active_role == UserRole.DOCENTE
        return [
            AssignmentResponse(
                id=row.id,
                course_id=row.course_id,
                subject_id=row.subject_id,
                teacher_id=row.teacher_id,
                course_name=row.course_name,
                subject_name=row.subject_name,
                teacher_name=row.teacher_name,
                can_edit=can_edit and row.teacher_id == current_user.id,
            )
            for row in rows
        ]

    async def grade_roster(
        self,
        current_user: CurrentUser,
        course_subject_id: int,
        quarter: int,
        partial: int,
    ) -> list[GradeRosterRow]:
        assignment = await self._resolve_assignment(course_subject_id, current_user, write=False)
        students = await self._students_for_course(assignment.course_id)
        grades_result = await self.session.execute(
            select(GradeModel).where(
                GradeModel.course_subject_id == course_subject_id,
                GradeModel.quarter == quarter,
                GradeModel.partial == partial,
            )
        )
        grades_by_student = {g.student_id: g for g in grades_result.scalars().all()}

        roster: list[GradeRosterRow] = []
        for student in students:
            grade = grades_by_student.get(student.id)
            roster.append(
                GradeRosterRow(
                    student_id=student.id,
                    first_name=student.first_name,
                    last_name=student.last_name,
                    national_id=student.national_id,
                    grade_id=grade.id if grade else None,
                    score=grade.score if grade else None,
                    notes=grade.notes if grade else None,
                )
            )
        return roster

    async def save_grades(
        self, current_user: CurrentUser, data: GradeBulkRequest
    ) -> list[GradeRosterRow]:
        assignment = await self._resolve_assignment(
            data.course_subject_id, current_user, write=True
        )
        students = await self._students_for_course(assignment.course_id)
        valid_ids = {s.id for s in students}

        for item in data.grades:
            if item.student_id not in valid_ids:
                raise ValidationError("Student does not belong to this course")

        for item in data.grades:
            result = await self.session.execute(
                select(GradeModel).where(
                    GradeModel.student_id == item.student_id,
                    GradeModel.course_subject_id == data.course_subject_id,
                    GradeModel.quarter == data.quarter,
                    GradeModel.partial == data.partial,
                )
            )
            grade = result.scalar_one_or_none()
            if grade:
                grade.score = item.score
                grade.notes = item.notes
                grade.teacher_id = current_user.id
            else:
                self.session.add(
                    GradeModel(
                        student_id=item.student_id,
                        course_subject_id=data.course_subject_id,
                        teacher_id=current_user.id,
                        quarter=data.quarter,
                        partial=data.partial,
                        score=item.score,
                        notes=item.notes,
                    )
                )

        await self.session.commit()
        return await self.grade_roster(
            current_user, data.course_subject_id, data.quarter, data.partial
        )

    async def attendance_roster(
        self,
        current_user: CurrentUser,
        course_subject_id: int,
        attendance_date: date,
    ) -> list[AttendanceRosterRow]:
        assignment = await self._resolve_assignment(course_subject_id, current_user, write=False)
        students = await self._students_for_course(assignment.course_id)
        records_result = await self.session.execute(
            select(AttendanceModel).where(
                AttendanceModel.course_subject_id == course_subject_id,
                AttendanceModel.attendance_date == attendance_date,
            )
        )
        records_by_student = {r.student_id: r for r in records_result.scalars().all()}

        roster: list[AttendanceRosterRow] = []
        for student in students:
            record = records_by_student.get(student.id)
            roster.append(
                AttendanceRosterRow(
                    student_id=student.id,
                    first_name=student.first_name,
                    last_name=student.last_name,
                    national_id=student.national_id,
                    attendance_id=record.id if record else None,
                    status=record.status if record else None,
                    notes=record.notes if record else None,
                )
            )
        return roster

    async def save_attendance(
        self, current_user: CurrentUser, data: AttendanceBulkRequest
    ) -> list[AttendanceRosterRow]:
        assignment = await self._resolve_assignment(
            data.course_subject_id, current_user, write=True
        )
        students = await self._students_for_course(assignment.course_id)
        valid_ids = {s.id for s in students}

        for item in data.records:
            if item.student_id not in valid_ids:
                raise ValidationError("Student does not belong to this course")

        for item in data.records:
            result = await self.session.execute(
                select(AttendanceModel).where(
                    AttendanceModel.student_id == item.student_id,
                    AttendanceModel.course_subject_id == data.course_subject_id,
                    AttendanceModel.attendance_date == data.attendance_date,
                )
            )
            record = result.scalar_one_or_none()
            if record:
                record.status = item.status
                record.notes = item.notes
                record.teacher_id = current_user.id
            else:
                self.session.add(
                    AttendanceModel(
                        student_id=item.student_id,
                        course_subject_id=data.course_subject_id,
                        teacher_id=current_user.id,
                        attendance_date=data.attendance_date,
                        status=item.status,
                        notes=item.notes,
                    )
                )

        await self.session.commit()
        return await self.attendance_roster(
            current_user, data.course_subject_id, data.attendance_date
        )

    async def student_summaries(
        self,
        current_user: CurrentUser,
        course_id: Optional[int] = None,
        term_id: Optional[int] = None,
    ) -> list[StudentAcademicSummary]:
        institution_id = current_user.institution_id
        term = await resolve_term(self.session, institution_id, term_id)
        if current_user.active_role == UserRole.TUTOR:
            courses_result = await self.session.execute(
                select(CourseModel).where(
                    CourseModel.institution_id == institution_id,
                    CourseModel.tutor_id == current_user.id,
                    CourseModel.academic_term_id == term.id,
                )
            )
            course_ids = [c.id for c in courses_result.scalars().all()]
            if not course_ids:
                return []
            if course_id and course_id not in course_ids:
                raise ValidationError("You can only view your assigned courses")
            target_course_ids = [course_id] if course_id else course_ids
        elif current_user.active_role in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            query = select(CourseModel).where(
                CourseModel.institution_id == institution_id,
                CourseModel.academic_term_id == term.id,
            )
            if course_id:
                query = query.where(CourseModel.id == course_id)
            target_course_ids = [c.id for c in (await self.session.execute(query)).scalars().all()]
        else:
            raise ValidationError("Insufficient permissions for academic overview")

        if not target_course_ids:
            return []

        students_result = await self.session.execute(
            select(StudentModel, CourseModel.name)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .where(
                StudentModel.course_id.in_(target_course_ids),
                StudentModel.status == StudentStatus.ACTIVO,
            )
            .order_by(StudentModel.last_name, StudentModel.first_name)
        )
        rows = students_result.all()
        summaries: list[StudentAcademicSummary] = []

        for student, course_name in rows:
            avg_result = await self.session.execute(
                select(func.avg(GradeModel.score)).where(GradeModel.student_id == student.id)
            )
            average = avg_result.scalar()
            absence_result = await self.session.execute(
                select(func.count(AttendanceModel.id)).where(
                    AttendanceModel.student_id == student.id,
                    AttendanceModel.status == AttendanceStatus.AUSENTE,
                )
            )
            tardy_result = await self.session.execute(
                select(func.count(AttendanceModel.id)).where(
                    AttendanceModel.student_id == student.id,
                    AttendanceModel.status == AttendanceStatus.TARDANZA,
                )
            )
            summaries.append(
                StudentAcademicSummary(
                    student_id=student.id,
                    first_name=student.first_name,
                    last_name=student.last_name,
                    course_name=course_name,
                    average_score=round(float(average), 2) if average is not None else None,
                    absence_count=absence_result.scalar() or 0,
                    tardy_count=tardy_result.scalar() or 0,
                )
            )
        return summaries

    async def student_academic_profile(
        self, current_user: CurrentUser, student_id: int
    ) -> StudentAcademicProfile:
        student = await self._ensure_profile_access(student_id, current_user)

        subjects_result = await self.session.execute(
            select(CourseSubjectModel.id, SubjectModel.name)
            .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .where(CourseSubjectModel.course_id == student.course_id)
            .order_by(SubjectModel.name)
        )
        subject_scores: list[SubjectRadarPoint] = []
        for course_subject_id, subject_name in subjects_result.all():
            grade_result = await self.session.execute(
                select(GradeModel.score)
                .where(
                    GradeModel.student_id == student_id,
                    GradeModel.course_subject_id == course_subject_id,
                )
                .order_by(GradeModel.quarter.desc(), GradeModel.partial.desc())
                .limit(1)
            )
            score = grade_result.scalar_one_or_none()
            if score is not None:
                subject_scores.append(
                    SubjectRadarPoint(
                        subject=subject_name,
                        value=round(float(score), 2),
                    )
                )

        att_result = await self.session.execute(
            select(AttendanceModel.attendance_date, AttendanceModel.status).where(
                AttendanceModel.student_id == student_id
            )
        )
        monthly: dict[str, tuple[int, int]] = {}
        for att_date, status in att_result.all():
            key = f"{att_date.year}-{att_date.month:02d}"
            present, total = monthly.get(key, (0, 0))
            total += 1
            if status in {
                AttendanceStatus.PRESENTE,
                AttendanceStatus.JUSTIFICADO,
                AttendanceStatus.TARDANZA,
            }:
                present += 1
            monthly[key] = (present, total)

        attendance_trend: list[MonthlyAttendancePoint] = []
        for key in sorted(monthly.keys())[-5:]:
            _, month_num = key.split("-")
            present, total = monthly[key]
            attendance_trend.append(
                MonthlyAttendancePoint(
                    month=MONTH_LABELS[int(month_num) - 1],
                    attendance=round((present / total) * 100) if total else 0,
                )
            )

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score)).where(GradeModel.student_id == student_id)
        )
        average = avg_result.scalar()
        absence_result = await self.session.execute(
            select(func.count(AttendanceModel.id)).where(
                AttendanceModel.student_id == student_id,
                AttendanceModel.status == AttendanceStatus.AUSENTE,
            )
        )
        tardy_result = await self.session.execute(
            select(func.count(AttendanceModel.id)).where(
                AttendanceModel.student_id == student_id,
                AttendanceModel.status == AttendanceStatus.TARDANZA,
            )
        )
        total_att_result = await self.session.execute(
            select(func.count(AttendanceModel.id)).where(
                AttendanceModel.student_id == student_id
            )
        )
        total_att = total_att_result.scalar() or 0
        absences = absence_result.scalar() or 0
        attendance_rate = (
            round(((total_att - absences) / total_att) * 100) if total_att else None
        )

        return StudentAcademicProfile(
            student_id=student_id,
            average_score=round(float(average), 2) if average is not None else None,
            absence_count=absences,
            tardy_count=tardy_result.scalar() or 0,
            attendance_rate=attendance_rate,
            subject_scores=subject_scores,
            attendance_trend=attendance_trend,
        )

    async def _ensure_profile_access(
        self, student_id: int, current_user: CurrentUser
    ) -> StudentModel:
        result = await self.session.execute(
            select(StudentModel).where(StudentModel.id == student_id)
        )
        student = result.scalar_one_or_none()
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        if current_user.active_role in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            return student
        if current_user.active_role == UserRole.TUTOR:
            course = await self.session.get(CourseModel, student.course_id)
            if course is None or course.tutor_id != current_user.id:
                raise ForbiddenError("You can only view your course students")
            return student
        if current_user.active_role == UserRole.REPRESENTANTE:
            if student.guardian_id != current_user.id:
                raise ForbiddenError("You can only view your assigned children")
            return student
        raise ForbiddenError("Insufficient permissions for academic profile")

    async def _students_for_course(self, course_id: int) -> list[StudentModel]:
        result = await self.session.execute(
            select(StudentModel)
            .where(
                StudentModel.course_id == course_id,
                StudentModel.status == StudentStatus.ACTIVO,
            )
            .order_by(StudentModel.last_name, StudentModel.first_name)
        )
        return list(result.scalars().all())

    async def _resolve_assignment(
        self, course_subject_id: int, current_user: CurrentUser, write: bool
    ):
        row = await self._get_assignment_row(course_subject_id)
        if row is None:
            raise NotFoundError("Course subject assignment")

        if write:
            if current_user.active_role != UserRole.DOCENTE:
                raise ValidationError("Only teachers can register grades or attendance")
            if row.teacher_id != current_user.id:
                raise ValidationError("You are not assigned to this subject")
            return row

        if current_user.active_role == UserRole.DOCENTE:
            if row.teacher_id != current_user.id:
                raise ValidationError("You are not assigned to this subject")
        elif current_user.active_role == UserRole.TUTOR:
            course = await self.session.get(CourseModel, row.course_id)
            if course is None or course.tutor_id != current_user.id:
                raise ValidationError("You can only view your course assignments")
        elif current_user.active_role not in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            raise ValidationError("Insufficient permissions")

        if row.institution_id != current_user.institution_id:
            raise ForbiddenError("Assignment belongs to another institution")
        return row

    async def _assignment_rows(self, current_user: CurrentUser, term_id: Optional[int] = None):
        institution_id = current_user.institution_id
        term = await resolve_term(self.session, institution_id, term_id)
        query = (
            select(
                CourseSubjectModel,
                CourseModel.name.label("course_name"),
                CourseModel.institution_id,
                SubjectModel.name.label("subject_name"),
                UserModel.first_name,
                UserModel.last_name,
            )
            .join(CourseModel, CourseSubjectModel.course_id == CourseModel.id)
            .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(UserModel, CourseSubjectModel.teacher_id == UserModel.id)
            .where(
                CourseModel.institution_id == institution_id,
                CourseModel.academic_term_id == term.id,
            )
        )

        if current_user.active_role == UserRole.DOCENTE:
            query = query.where(CourseSubjectModel.teacher_id == current_user.id)
        elif current_user.active_role == UserRole.TUTOR:
            query = query.where(CourseModel.tutor_id == current_user.id)
        elif current_user.active_role not in {UserRole.ADMINISTRADOR, UserRole.DECE}:
            return []

        result = await self.session.execute(query.order_by(CourseModel.name, SubjectModel.name))
        rows = []
        for cs, course_name, institution_id, subject_name, first_name, last_name in result.all():
            rows.append(
                type(
                    "AssignmentRow",
                    (),
                    {
                        "id": cs.id,
                        "course_id": cs.course_id,
                        "subject_id": cs.subject_id,
                        "teacher_id": cs.teacher_id,
                        "course_name": course_name,
                        "subject_name": subject_name,
                        "teacher_name": f"{first_name} {last_name}",
                        "institution_id": institution_id,
                    },
                )()
            )
        return rows

    async def _get_assignment_row(self, course_subject_id: int):
        result = await self.session.execute(
            select(
                CourseSubjectModel,
                CourseModel.name.label("course_name"),
                CourseModel.institution_id,
                SubjectModel.name.label("subject_name"),
                UserModel.first_name,
                UserModel.last_name,
            )
            .join(CourseModel, CourseSubjectModel.course_id == CourseModel.id)
            .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(UserModel, CourseSubjectModel.teacher_id == UserModel.id)
            .where(CourseSubjectModel.id == course_subject_id)
        )
        row = result.one_or_none()
        if row is None:
            return None
        cs, course_name, institution_id, subject_name, first_name, last_name = row
        return type(
            "AssignmentRow",
            (),
            {
                "id": cs.id,
                "course_id": cs.course_id,
                "subject_id": cs.subject_id,
                "teacher_id": cs.teacher_id,
                "course_name": course_name,
                "subject_name": subject_name,
                "teacher_name": f"{first_name} {last_name}",
                "institution_id": institution_id,
            },
        )()
