from __future__ import annotations

import csv
import io
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    CourseSubjectModel,
    SubjectModel,
)
from app.modules.reports.schemas import (
    InstitutionalReport,
    LevelCount,
    PeriodComparison,
    PeriodSummary,
    RiskDistribution,
    StudentFullReport,
    StudentReportEntry,
    StudentReportGrade,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.enums import AlertStatus, AttendanceStatus, RiskLevel, StudentStatus
from app.shared.exceptions import NotFoundError
from app.shared.term_resolver import course_ids_for_term, resolve_term

LEVEL_ORDER = [RiskLevel.CRITICO, RiskLevel.ALTO, RiskLevel.MEDIO, RiskLevel.BAJO]


class ReportService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def institutional_report(
        self, institution_id: int, term_id: int | None = None
    ) -> InstitutionalReport:
        """RF-48: institutional risk situation scoped to academic term."""
        term = await resolve_term(self.session, institution_id, term_id)
        term_course_ids = await course_ids_for_term(self.session, institution_id, term.id)
        if not term_course_ids:
            return InstitutionalReport(
                total_students=0,
                distribution=[
                    RiskDistribution(level=level.value, count=0, previous_month=0)
                    for level in LEVEL_ORDER
                ],
                active_alerts=0,
                attended_alerts_month=0,
                alerts_by_type=[],
                generated_at=datetime.now(timezone.utc),
            )

        total_result = await self.session.execute(
            select(func.count(StudentModel.id)).where(
                StudentModel.status == StudentStatus.ACTIVO,
                StudentModel.course_id.in_(term_course_ids),
            )
        )
        total_students = total_result.scalar() or 0

        current_result = await self.session.execute(
            select(StudentModel.current_risk_level, func.count(StudentModel.id))
            .where(
                StudentModel.status == StudentStatus.ACTIVO,
                StudentModel.course_id.in_(term_course_ids),
            )
            .group_by(StudentModel.current_risk_level)
        )
        current = {level: count for level, count in current_result.all()}

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

        prev_result = await self.session.execute(
            select(AlertModel.level, func.count(AlertModel.id))
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .where(
                AlertModel.institution_id == institution_id,
                StudentModel.course_id.in_(term_course_ids),
                AlertModel.created_at >= prev_month_start,
                AlertModel.created_at < month_start,
            )
            .group_by(AlertModel.level)
        )
        previous = {level: count for level, count in prev_result.all()}

        distribution = [
            RiskDistribution(
                level=level.value,
                count=current.get(level, 0),
                previous_month=previous.get(level, 0),
            )
            for level in LEVEL_ORDER
        ]

        active_result = await self.session.execute(
            select(func.count(AlertModel.id))
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .where(
                AlertModel.institution_id == institution_id,
                AlertModel.status == AlertStatus.ACTIVA,
                StudentModel.course_id.in_(term_course_ids),
            )
        )
        attended_result = await self.session.execute(
            select(func.count(AlertModel.id))
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .where(
                AlertModel.institution_id == institution_id,
                AlertModel.status == AlertStatus.ATENDIDA,
                StudentModel.course_id.in_(term_course_ids),
                AlertModel.attended_at >= month_start,
            )
        )
        by_type_result = await self.session.execute(
            select(AlertModel.alert_type, func.count(AlertModel.id))
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .where(
                AlertModel.institution_id == institution_id,
                StudentModel.course_id.in_(term_course_ids),
            )
            .group_by(AlertModel.alert_type)
        )

        return InstitutionalReport(
            total_students=total_students,
            distribution=distribution,
            active_alerts=active_result.scalar() or 0,
            attended_alerts_month=attended_result.scalar() or 0,
            alerts_by_type=[
                {"type": alert_type.value, "count": count}
                for alert_type, count in by_type_result.all()
            ],
            generated_at=now,
        )

    async def period_summary(self, institution_id: int, term_id: int) -> PeriodSummary:
        term = await self.session.get(AcademicTermModel, term_id)
        if term is None or term.institution_id != institution_id:
            raise NotFoundError("Academic term")
        return await self._build_period_summary(institution_id, term)

    async def period_comparison(
        self, institution_id: int, term_a_id: int, term_b_id: int | None
    ) -> PeriodComparison:
        period_a = await self.period_summary(institution_id, term_a_id)
        period_b = (
            await self.period_summary(institution_id, term_b_id)
            if term_b_id is not None
            else None
        )
        return PeriodComparison(period_a=period_a, period_b=period_b)

    async def _build_period_summary(
        self, institution_id: int, term: AcademicTermModel
    ) -> PeriodSummary:
        start_dt = datetime.combine(term.start_date, time.min, tzinfo=timezone.utc)
        end_dt = datetime.combine(term.end_date, time.max, tzinfo=timezone.utc)

        course_ids = (
            await self.session.execute(
                select(CourseModel.id).where(
                    CourseModel.academic_term_id == term.id,
                    CourseModel.institution_id == institution_id,
                )
            )
        ).scalars().all()

        risk_counts: dict[RiskLevel, int] = {}
        students_total = 0
        if course_ids:
            risk_result = await self.session.execute(
                select(StudentModel.current_risk_level, func.count(StudentModel.id))
                .where(
                    StudentModel.course_id.in_(course_ids),
                    StudentModel.status == StudentStatus.ACTIVO,
                )
                .group_by(StudentModel.current_risk_level)
            )
            for level, count in risk_result.all():
                risk_counts[level] = count
                students_total += count

        alerts_level_result = await self.session.execute(
            select(AlertModel.level, func.count(AlertModel.id))
            .where(
                AlertModel.institution_id == institution_id,
                AlertModel.created_at >= start_dt,
                AlertModel.created_at <= end_dt,
            )
            .group_by(AlertModel.level)
        )
        alerts_level = {level: count for level, count in alerts_level_result.all()}
        alerts_total = sum(alerts_level.values())

        attended_result = await self.session.execute(
            select(func.count(AlertModel.id)).where(
                AlertModel.institution_id == institution_id,
                AlertModel.status == AlertStatus.ATENDIDA,
                AlertModel.attended_at >= start_dt,
                AlertModel.attended_at <= end_dt,
            )
        )

        dece_result = await self.session.execute(
            select(func.count(DeceReportModel.id))
            .join(StudentModel, DeceReportModel.student_id == StudentModel.id)
            .where(
                StudentModel.institution_id == institution_id,
                DeceReportModel.reported_at >= start_dt,
                DeceReportModel.reported_at <= end_dt,
            )
        )
        disciplinary_result = await self.session.execute(
            select(func.count(DisciplinaryReportModel.id))
            .join(StudentModel, DisciplinaryReportModel.student_id == StudentModel.id)
            .where(
                StudentModel.institution_id == institution_id,
                DisciplinaryReportModel.reported_at >= start_dt,
                DisciplinaryReportModel.reported_at <= end_dt,
            )
        )
        tutor_result = await self.session.execute(
            select(func.count(TutorAnnotationModel.id))
            .join(StudentModel, TutorAnnotationModel.student_id == StudentModel.id)
            .where(
                StudentModel.institution_id == institution_id,
                TutorAnnotationModel.annotated_at >= start_dt,
                TutorAnnotationModel.annotated_at <= end_dt,
            )
        )

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score))
            .join(CourseSubjectModel, GradeModel.course_subject_id == CourseSubjectModel.id)
            .join(CourseModel, CourseSubjectModel.course_id == CourseModel.id)
            .where(CourseModel.academic_term_id == term.id)
        )
        average = avg_result.scalar()

        att_result = await self.session.execute(
            select(AttendanceModel.status, func.count(AttendanceModel.id))
            .join(CourseSubjectModel, AttendanceModel.course_subject_id == CourseSubjectModel.id)
            .join(CourseModel, CourseSubjectModel.course_id == CourseModel.id)
            .where(CourseModel.academic_term_id == term.id)
            .group_by(AttendanceModel.status)
        )
        attendance = {status: count for status, count in att_result.all()}
        total_attendance = sum(attendance.values())
        present = attendance.get(AttendanceStatus.PRESENTE, 0) + attendance.get(
            AttendanceStatus.TARDANZA, 0
        )
        attendance_rate = (
            round(present * 100 / total_attendance, 1) if total_attendance else None
        )

        return PeriodSummary(
            term_id=term.id,
            term_name=term.name,
            start_date=term.start_date,
            end_date=term.end_date,
            students=students_total,
            alerts_total=alerts_total,
            alerts_by_level=[
                LevelCount(level=level.value, count=alerts_level.get(level, 0))
                for level in LEVEL_ORDER
            ],
            alerts_attended=attended_result.scalar() or 0,
            dece_reports=dece_result.scalar() or 0,
            disciplinary_reports=disciplinary_result.scalar() or 0,
            tutor_annotations=tutor_result.scalar() or 0,
            average_score=round(float(average), 2) if average is not None else None,
            attendance_rate=attendance_rate,
            risk_distribution=[
                LevelCount(level=level.value, count=risk_counts.get(level, 0))
                for level in LEVEL_ORDER
            ],
        )

    async def student_report(self, student_id: int) -> StudentFullReport:
        """RF-49: consolidated individual student report."""
        student = await self.session.get(StudentModel, student_id)
        if student is None:
            raise NotFoundError("Student")

        course = await self.session.get(CourseModel, student.course_id)
        guardian = (
            await self.session.get(UserModel, student.guardian_id)
            if student.guardian_id
            else None
        )

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score)).where(GradeModel.student_id == student_id)
        )
        average = avg_result.scalar()

        subjects_result = await self.session.execute(
            select(
                SubjectModel.name,
                func.avg(GradeModel.score),
                func.count(GradeModel.id),
            )
            .join(CourseSubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(GradeModel, GradeModel.course_subject_id == CourseSubjectModel.id)
            .where(GradeModel.student_id == student_id)
            .group_by(SubjectModel.name)
            .order_by(SubjectModel.name)
        )
        grades_by_subject = [
            StudentReportGrade(subject=name, average=round(float(avg), 2), grades_count=count)
            for name, avg, count in subjects_result.all()
        ]

        attendance_result = await self.session.execute(
            select(AttendanceModel.status, func.count(AttendanceModel.id))
            .where(AttendanceModel.student_id == student_id)
            .group_by(AttendanceModel.status)
        )
        attendance = {status: count for status, count in attendance_result.all()}
        total_attendance = sum(attendance.values())
        present = attendance.get(AttendanceStatus.PRESENTE, 0) + attendance.get(
            AttendanceStatus.TARDANZA, 0
        )
        attendance_rate = (
            round(present * 100 / total_attendance, 1) if total_attendance else None
        )

        absences_result = await self.session.execute(
            select(func.count(AttendanceModel.id)).where(
                AttendanceModel.student_id == student_id,
                AttendanceModel.status == AttendanceStatus.AUSENTE,
                AttendanceModel.attendance_date >= date.today() - timedelta(days=30),
            )
        )

        dece_result = await self.session.execute(
            select(DeceReportModel, UserModel)
            .join(UserModel, DeceReportModel.dece_user_id == UserModel.id)
            .where(DeceReportModel.student_id == student_id)
            .order_by(DeceReportModel.reported_at.desc())
        )
        dece_reports = [
            StudentReportEntry(
                date=report.reported_at.strftime("%Y-%m-%d"),
                type=report.report_type.value,
                description=report.description,
                author=f"{user.first_name} {user.last_name}",
            )
            for report, user in dece_result.all()
        ]

        tutor_result = await self.session.execute(
            select(TutorAnnotationModel, UserModel)
            .join(UserModel, TutorAnnotationModel.tutor_id == UserModel.id)
            .where(TutorAnnotationModel.student_id == student_id)
            .order_by(TutorAnnotationModel.annotated_at.desc())
        )
        tutor_annotations = [
            StudentReportEntry(
                date=note.annotated_at.strftime("%Y-%m-%d"),
                type=note.annotation_type.value,
                description=note.description,
                author=f"{user.first_name} {user.last_name}",
            )
            for note, user in tutor_result.all()
        ]

        disciplinary_result = await self.session.execute(
            select(DisciplinaryReportModel, UserModel)
            .join(UserModel, DisciplinaryReportModel.inspector_id == UserModel.id)
            .where(DisciplinaryReportModel.student_id == student_id)
            .order_by(DisciplinaryReportModel.reported_at.desc())
        )
        disciplinary_reports = [
            StudentReportEntry(
                date=report.reported_at.strftime("%Y-%m-%d"),
                type=report.fault_type.value,
                description=report.description,
                author=f"{user.first_name} {user.last_name}",
            )
            for report, user in disciplinary_result.all()
        ]

        alerts_result = await self.session.execute(
            select(AlertModel)
            .where(AlertModel.student_id == student_id)
            .order_by(AlertModel.created_at.desc())
        )
        alerts = [
            StudentReportEntry(
                date=alert.created_at.strftime("%Y-%m-%d"),
                type=f"{alert.alert_type.value} ({alert.level.value}) — {alert.status.value}",
                description=alert.description,
            )
            for alert in alerts_result.scalars().all()
        ]

        return StudentFullReport(
            student_id=student.id,
            full_name=f"{student.first_name} {student.last_name}",
            national_id=student.national_id,
            course_name=course.name if course else "—",
            guardian_name=(
                f"{guardian.first_name} {guardian.last_name}" if guardian else None
            ),
            risk_level=student.current_risk_level.value,
            average_score=round(float(average), 2) if average is not None else None,
            attendance_rate=attendance_rate,
            absences_30d=absences_result.scalar() or 0,
            grades_by_subject=grades_by_subject,
            dece_reports=dece_reports,
            tutor_annotations=tutor_annotations,
            disciplinary_reports=disciplinary_reports,
            alerts=alerts,
            generated_at=datetime.now(timezone.utc),
        )

    async def export_csv(self, dataset: str) -> tuple[str, str]:
        """RF-50: CSV export. Returns (filename, csv_content)."""
        output = io.StringIO()
        writer = csv.writer(output)
        today = date.today().isoformat()

        if dataset == "students":
            writer.writerow(
                ["ID", "Nombres", "Apellidos", "Cédula", "Curso", "Estado", "Nivel de riesgo"]
            )
            result = await self.session.execute(
                select(StudentModel, CourseModel)
                .join(CourseModel, StudentModel.course_id == CourseModel.id)
                .order_by(StudentModel.last_name)
            )
            for student, course in result.all():
                writer.writerow(
                    [
                        student.id,
                        student.first_name,
                        student.last_name,
                        student.national_id or "",
                        course.name,
                        student.status.value,
                        student.current_risk_level.value,
                    ]
                )
            return f"estudiantes_{today}.csv", output.getvalue()

        if dataset == "alerts":
            writer.writerow(
                ["ID", "Estudiante", "Tipo", "Nivel", "Estado", "Descripción", "Fecha", "Email enviado"]
            )
            result = await self.session.execute(
                select(AlertModel, StudentModel)
                .join(StudentModel, AlertModel.student_id == StudentModel.id)
                .order_by(AlertModel.created_at.desc())
            )
            for alert, student in result.all():
                writer.writerow(
                    [
                        alert.id,
                        f"{student.first_name} {student.last_name}",
                        alert.alert_type.value,
                        alert.level.value,
                        alert.status.value,
                        alert.description.replace("\n", " | "),
                        alert.created_at.strftime("%Y-%m-%d %H:%M"),
                        "Sí" if alert.email_sent else "No",
                    ]
                )
            return f"alertas_{today}.csv", output.getvalue()

        if dataset == "grades":
            writer.writerow(
                ["Estudiante", "Materia", "Quimestre", "Parcial", "Nota", "Fecha"]
            )
            result = await self.session.execute(
                select(GradeModel, StudentModel, SubjectModel)
                .join(StudentModel, GradeModel.student_id == StudentModel.id)
                .join(
                    CourseSubjectModel,
                    GradeModel.course_subject_id == CourseSubjectModel.id,
                )
                .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
                .order_by(StudentModel.last_name)
            )
            for grade, student, subject in result.all():
                writer.writerow(
                    [
                        f"{student.first_name} {student.last_name}",
                        subject.name,
                        grade.quarter,
                        grade.partial,
                        float(grade.score),
                        grade.recorded_at.strftime("%Y-%m-%d"),
                    ]
                )
            return f"calificaciones_{today}.csv", output.getvalue()

        if dataset == "attendance":
            writer.writerow(["Estudiante", "Materia", "Fecha", "Estado", "Observación"])
            result = await self.session.execute(
                select(AttendanceModel, StudentModel, SubjectModel)
                .join(StudentModel, AttendanceModel.student_id == StudentModel.id)
                .join(
                    CourseSubjectModel,
                    AttendanceModel.course_subject_id == CourseSubjectModel.id,
                )
                .join(SubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
                .order_by(AttendanceModel.attendance_date.desc())
                .limit(5000)
            )
            for attendance, student, subject in result.all():
                writer.writerow(
                    [
                        f"{student.first_name} {student.last_name}",
                        subject.name,
                        attendance.attendance_date.isoformat(),
                        attendance.status.value,
                        attendance.notes or "",
                    ]
                )
            return f"asistencias_{today}.csv", output.getvalue()

        raise NotFoundError("Dataset")
