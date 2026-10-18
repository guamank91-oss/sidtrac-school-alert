from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.behavioral.schemas import (
    BehavioralSummary,
    DeceReportCreate,
    DeceReportResponse,
    DeceReportUpdate,
    DisciplinaryReportCreate,
    DisciplinaryReportResponse,
    DisciplinaryReportUpdate,
    TimelineEntry,
    TutorAnnotationCreate,
    TutorAnnotationResponse,
    TutorAnnotationUpdate,
)
from app.modules.institution.infrastructure.models import CourseModel
from app.modules.rag.application.indexer import (
    index_behavioral_document,
    reindex_behavioral_document,
    remove_behavioral_document,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.modules.audit.application.service import record_audit
from app.shared.audit_actions import DECE_REPORT_VIEWED, STUDENT_TIMELINE_VIEWED
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertType, DeceReportType, RiskLevel, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.tenant import assert_same_institution
from app.shared.term_resolver import course_ids_for_term

DECE_TYPE_LABELS = {
    DeceReportType.OBSERVACION_CONDUCTUAL: "Observación conductual",
    DeceReportType.ENTREVISTA: "Entrevista",
    DeceReportType.SEGUIMIENTO: "Seguimiento",
    DeceReportType.ALERTA_EMOCIONAL: "Alerta emocional",
    DeceReportType.DERIVACION: "Derivación",
    DeceReportType.PLAN_INTERVENCION: "Plan de intervención",
}


def _alert_type_for_dece(report_type: DeceReportType) -> AlertType:
    if report_type == DeceReportType.ALERTA_EMOCIONAL:
        return AlertType.EMOCIONAL
    if report_type == DeceReportType.OBSERVACION_CONDUCTUAL:
        return AlertType.CONDUCTUAL
    return AlertType.CONDUCTUAL


class BehavioralService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def summary(
        self, current_user: CurrentUser, term_id: Optional[int] = None
    ) -> BehavioralSummary:
        students = await self._allowed_student_ids(current_user, term_id=term_id)
        if not students:
            return BehavioralSummary(
                dece_reports=0,
                tutor_annotations=0,
                disciplinary_reports=0,
                high_urgency_reports=0,
                follow_up_pending=0,
            )

        dece = await self.session.execute(
            select(DeceReportModel).where(DeceReportModel.student_id.in_(students))
        )
        dece_rows = dece.scalars().all()
        tutor = await self.session.execute(
            select(TutorAnnotationModel).where(TutorAnnotationModel.student_id.in_(students))
        )
        tutor_rows = tutor.scalars().all()
        disc = await self.session.execute(
            select(DisciplinaryReportModel).where(
                DisciplinaryReportModel.student_id.in_(students)
            )
        )
        disc_rows = disc.scalars().all()

        high = sum(
            1
            for r in dece_rows
            if r.urgency_level in {RiskLevel.ALTO, RiskLevel.CRITICO}
        )
        follow = sum(1 for r in dece_rows if r.requires_follow_up)

        return BehavioralSummary(
            dece_reports=len(dece_rows),
            tutor_annotations=len(tutor_rows),
            disciplinary_reports=len(disc_rows),
            high_urgency_reports=high,
            follow_up_pending=follow,
        )

    async def list_dece_reports(
        self,
        current_user: CurrentUser,
        student_id: Optional[int] = None,
        report_type: Optional[DeceReportType] = None,
        urgency_level: Optional[RiskLevel] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        term_id: Optional[int] = None,
    ) -> list[DeceReportResponse]:
        await self._ensure_can_read_dece(current_user)
        allowed = await self._allowed_student_ids(current_user, term_id=term_id)
        query = select(DeceReportModel).where(DeceReportModel.student_id.in_(allowed))
        if student_id:
            await self._ensure_student_access(student_id, current_user)
            query = query.where(DeceReportModel.student_id == student_id)
        if report_type:
            query = query.where(DeceReportModel.report_type == report_type)
        if urgency_level:
            query = query.where(DeceReportModel.urgency_level == urgency_level)
        if date_from:
            query = query.where(DeceReportModel.reported_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.where(DeceReportModel.reported_at <= datetime.combine(date_to, datetime.max.time()))

        result = await self.session.execute(query.order_by(DeceReportModel.reported_at.desc()))
        responses = []
        for row in result.scalars().all():
            responses.append(await self._dece_to_response(row))
        if student_id is not None:
            await record_audit(
                self.session,
                user_id=current_user.id,
                institution_id=current_user.institution_id,
                scope_type="institution",
                action=DECE_REPORT_VIEWED,
                entity_type="student",
                entity_id=student_id,
                detail=f"Listado reportes DECE estudiante {student_id}",
                categories='["dece_report"]',
            )
            await self.session.commit()
        return responses

    async def create_dece_report(
        self, current_user: CurrentUser, data: DeceReportCreate
    ) -> DeceReportResponse:
        if current_user.active_role not in {UserRole.DECE, UserRole.ADMINISTRADOR}:
            raise ValidationError("Only DECE staff can create DECE reports")
        await self._ensure_student_access(data.student_id, current_user)

        report = DeceReportModel(
            student_id=data.student_id,
            dece_user_id=current_user.id,
            report_type=data.report_type,
            description=data.description,
            actions_taken=data.actions_taken,
            urgency_level=data.urgency_level,
            requires_follow_up=data.requires_follow_up,
        )
        self.session.add(report)
        await self.session.flush()

        text = self._build_dece_index_text(report)
        await index_behavioral_document(
            self.session,
            student_id=data.student_id,
            source="reporte_dece",
            source_id=report.id,
            text=text,
        )

        # Flujo 1 paso 9: medium+ urgency auto-generates a linked alert + updates semáforo.
        if data.urgency_level in {RiskLevel.MEDIO, RiskLevel.ALTO, RiskLevel.CRITICO}:
            from app.modules.alerts.application.service import create_alert_from_behavioral

            await create_alert_from_behavioral(
                self.session,
                student_id=data.student_id,
                level=data.urgency_level,
                description=(
                    f"- Reporte DECE ({DECE_TYPE_LABELS[data.report_type]}) con urgencia "
                    f"{data.urgency_level.value}: {data.description[:300]}"
                ),
                created_by=current_user.id,
                alert_type=_alert_type_for_dece(data.report_type),
            )
        else:
            from app.modules.alerts.application.engine import RISK_ORDER

            student = await self.session.get(StudentModel, data.student_id)
            if (
                student is not None
                and RISK_ORDER[data.urgency_level] > RISK_ORDER[student.current_risk_level]
            ):
                student.current_risk_level = data.urgency_level

        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_dece_creado",
            detail=f"Reporte {data.report_type.value} para estudiante {data.student_id}",
        )
        await self.session.commit()
        return await self._dece_to_response(report)

    async def update_dece_report(
        self, current_user: CurrentUser, report_id: int, data: DeceReportUpdate
    ) -> DeceReportResponse:
        if current_user.active_role not in {UserRole.DECE, UserRole.ADMINISTRADOR}:
            raise ValidationError("Only DECE staff can edit DECE reports")
        report = await self.session.get(DeceReportModel, report_id)
        if report is None:
            raise NotFoundError("DECE report")
        await self._ensure_student_access(report.student_id, current_user)

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(report, key, value)
        await self.session.flush()

        await reindex_behavioral_document(
            self.session,
            student_id=report.student_id,
            source="reporte_dece",
            source_id=report.id,
            text=self._build_dece_index_text(report),
        )
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_dece_editado",
            detail=f"Reporte DECE {report_id} editado",
        )
        await self.session.commit()
        return await self._dece_to_response(report)

    async def delete_dece_report(
        self, current_user: CurrentUser, report_id: int
    ) -> None:
        if current_user.active_role not in {UserRole.DECE, UserRole.ADMINISTRADOR}:
            raise ValidationError("Only DECE staff can delete DECE reports")
        report = await self.session.get(DeceReportModel, report_id)
        if report is None:
            raise NotFoundError("DECE report")
        await self._ensure_student_access(report.student_id, current_user)

        await remove_behavioral_document(
            self.session, source="reporte_dece", source_id=report.id
        )
        await self.session.delete(report)
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_dece_eliminado",
            detail=f"Reporte DECE {report_id} eliminado",
        )
        await self.session.commit()

    async def list_tutor_annotations(
        self,
        current_user: CurrentUser,
        student_id: Optional[int] = None,
        term_id: Optional[int] = None,
    ) -> list[TutorAnnotationResponse]:
        allowed = await self._allowed_student_ids(current_user, term_id=term_id)
        query = select(TutorAnnotationModel).where(
            TutorAnnotationModel.student_id.in_(allowed)
        )
        if student_id:
            await self._ensure_student_access(student_id, current_user)
            query = query.where(TutorAnnotationModel.student_id == student_id)
        if current_user.active_role == UserRole.TUTOR:
            query = query.where(TutorAnnotationModel.tutor_id == current_user.id)

        result = await self.session.execute(
            query.order_by(TutorAnnotationModel.annotated_at.desc())
        )
        return [await self._tutor_to_response(row) for row in result.scalars().all()]

    async def create_tutor_annotation(
        self, current_user: CurrentUser, data: TutorAnnotationCreate
    ) -> TutorAnnotationResponse:
        if current_user.active_role != UserRole.TUTOR:
            raise ValidationError("Only tutors can create tutor annotations")
        await self._ensure_tutor_student(data.student_id, current_user.id)

        note = TutorAnnotationModel(
            student_id=data.student_id,
            tutor_id=current_user.id,
            annotation_type=data.annotation_type,
            description=data.description,
        )
        self.session.add(note)
        await self.session.flush()
        await index_behavioral_document(
            self.session,
            student_id=data.student_id,
            source="anotacion_tutor",
            source_id=note.id,
            text=f"[{data.annotation_type.value}] {data.description}",
        )
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="anotacion_tutor_creada",
            detail=f"Anotación {data.annotation_type.value} para estudiante {data.student_id}",
        )
        await self.session.commit()
        return await self._tutor_to_response(note)

    async def update_tutor_annotation(
        self, current_user: CurrentUser, note_id: int, data: TutorAnnotationUpdate
    ) -> TutorAnnotationResponse:
        note = await self.session.get(TutorAnnotationModel, note_id)
        if note is None:
            raise NotFoundError("Tutor annotation")
        self._ensure_can_modify_tutor(note, current_user)

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(note, key, value)
        await self.session.flush()

        await reindex_behavioral_document(
            self.session,
            student_id=note.student_id,
            source="anotacion_tutor",
            source_id=note.id,
            text=f"[{note.annotation_type.value}] {note.description}",
        )
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="anotacion_tutor_editada",
            detail=f"Anotación {note_id} editada",
        )
        await self.session.commit()
        return await self._tutor_to_response(note)

    async def delete_tutor_annotation(
        self, current_user: CurrentUser, note_id: int
    ) -> None:
        note = await self.session.get(TutorAnnotationModel, note_id)
        if note is None:
            raise NotFoundError("Tutor annotation")
        self._ensure_can_modify_tutor(note, current_user)

        await remove_behavioral_document(
            self.session, source="anotacion_tutor", source_id=note.id
        )
        await self.session.delete(note)
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="anotacion_tutor_eliminada",
            detail=f"Anotación {note_id} eliminada",
        )
        await self.session.commit()

    async def list_disciplinary_reports(
        self,
        current_user: CurrentUser,
        student_id: Optional[int] = None,
        term_id: Optional[int] = None,
    ) -> list[DisciplinaryReportResponse]:
        await self._ensure_can_read_disciplinary(current_user)
        allowed = await self._allowed_student_ids(current_user, term_id=term_id)
        query = select(DisciplinaryReportModel).where(
            DisciplinaryReportModel.student_id.in_(allowed)
        )
        if student_id:
            await self._ensure_student_access(student_id, current_user)
            query = query.where(DisciplinaryReportModel.student_id == student_id)

        result = await self.session.execute(
            query.order_by(DisciplinaryReportModel.reported_at.desc())
        )
        return [await self._disciplinary_to_response(row) for row in result.scalars().all()]

    async def create_disciplinary_report(
        self, current_user: CurrentUser, data: DisciplinaryReportCreate
    ) -> DisciplinaryReportResponse:
        if current_user.active_role != UserRole.TUTOR:
            raise ValidationError("Only tutors can create disciplinary reports")
        await self._ensure_tutor_student(data.student_id, current_user.id)

        report = DisciplinaryReportModel(
            student_id=data.student_id,
            inspector_id=current_user.id,
            fault_type=data.fault_type,
            description=data.description,
            sanction=data.sanction,
        )
        self.session.add(report)
        await self.session.flush()
        await index_behavioral_document(
            self.session,
            student_id=data.student_id,
            source="reporte_disciplinario",
            source_id=report.id,
            text=f"[{data.fault_type.value}] {data.description}. Sanción: {data.sanction or 'N/A'}",
        )
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_disciplinario_creado",
            detail=f"Falta {data.fault_type.value} para estudiante {data.student_id}",
        )
        await self.session.commit()
        return await self._disciplinary_to_response(report)

    async def update_disciplinary_report(
        self, current_user: CurrentUser, report_id: int, data: DisciplinaryReportUpdate
    ) -> DisciplinaryReportResponse:
        report = await self.session.get(DisciplinaryReportModel, report_id)
        if report is None:
            raise NotFoundError("Disciplinary report")
        self._ensure_can_modify_disciplinary(report, current_user)

        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(report, key, value)
        await self.session.flush()

        await reindex_behavioral_document(
            self.session,
            student_id=report.student_id,
            source="reporte_disciplinario",
            source_id=report.id,
            text=f"[{report.fault_type.value}] {report.description}. Sanción: {report.sanction or 'N/A'}",
        )
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_disciplinario_editado",
            detail=f"Reporte disciplinario {report_id} editado",
        )
        await self.session.commit()
        return await self._disciplinary_to_response(report)

    async def delete_disciplinary_report(
        self, current_user: CurrentUser, report_id: int
    ) -> None:
        report = await self.session.get(DisciplinaryReportModel, report_id)
        if report is None:
            raise NotFoundError("Disciplinary report")
        self._ensure_can_modify_disciplinary(report, current_user)

        await remove_behavioral_document(
            self.session, source="reporte_disciplinario", source_id=report.id
        )
        await self.session.delete(report)
        from app.modules.audit.application.service import record_audit

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="reporte_disciplinario_eliminado",
            detail=f"Reporte disciplinario {report_id} eliminado",
        )
        await self.session.commit()

    def _ensure_can_modify_tutor(
        self, note: TutorAnnotationModel, current_user: CurrentUser
    ) -> None:
        if current_user.active_role == UserRole.ADMINISTRADOR:
            return
        if current_user.active_role == UserRole.TUTOR and note.tutor_id == current_user.id:
            return
        raise ValidationError("Only the author tutor can modify this annotation")

    def _ensure_can_modify_disciplinary(
        self, report: DisciplinaryReportModel, current_user: CurrentUser
    ) -> None:
        if current_user.active_role == UserRole.ADMINISTRADOR:
            return
        if (
            current_user.active_role == UserRole.TUTOR
            and report.inspector_id == current_user.id
        ):
            return
        raise ValidationError("Only the author can modify this disciplinary report")

    async def student_timeline(
        self, current_user: CurrentUser, student_id: int
    ) -> list[TimelineEntry]:
        await self._ensure_student_access(student_id, current_user)
        entries: list[TimelineEntry] = []

        dece = await self.session.execute(
            select(DeceReportModel)
            .where(DeceReportModel.student_id == student_id)
            .order_by(DeceReportModel.reported_at.desc())
        )
        for row in dece.scalars().all():
            author = await self._user_name(row.dece_user_id)
            entries.append(
                TimelineEntry(
                    id=row.id,
                    source="dece",
                    date=row.reported_at,
                    type=row.report_type.value,
                    type_label=DECE_TYPE_LABELS.get(row.report_type, row.report_type.value),
                    description=row.description,
                    author_name=author,
                    urgency_level=row.urgency_level,
                    requires_follow_up=row.requires_follow_up,
                    actions_taken=row.actions_taken,
                )
            )

        tutor = await self.session.execute(
            select(TutorAnnotationModel)
            .where(TutorAnnotationModel.student_id == student_id)
            .order_by(TutorAnnotationModel.annotated_at.desc())
        )
        for row in tutor.scalars().all():
            if current_user.active_role == UserRole.TUTOR and row.tutor_id != current_user.id:
                continue
            entries.append(
                TimelineEntry(
                    id=row.id,
                    source="tutor",
                    date=row.annotated_at,
                    type=row.annotation_type.value,
                    type_label=row.annotation_type.value.capitalize(),
                    description=row.description,
                    author_name=await self._user_name(row.tutor_id),
                )
            )

        if current_user.active_role in {
            UserRole.DECE,
            UserRole.ADMINISTRADOR,
            UserRole.TUTOR,
        }:
            disc = await self.session.execute(
                select(DisciplinaryReportModel)
                .where(DisciplinaryReportModel.student_id == student_id)
                .order_by(DisciplinaryReportModel.reported_at.desc())
            )
            for row in disc.scalars().all():
                entries.append(
                    TimelineEntry(
                        id=row.id,
                        source="disciplinary",
                        date=row.reported_at,
                        type=row.fault_type.value,
                        type_label=f"Falta {row.fault_type.value.replace('_', ' ')}",
                        description=row.description,
                        author_name=await self._user_name(row.inspector_id),
                        sanction=row.sanction,
                    )
                )

        entries.sort(key=lambda e: e.date, reverse=True)
        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=current_user.institution_id,
            scope_type="institution",
            action=STUDENT_TIMELINE_VIEWED,
            entity_type="student",
            entity_id=student_id,
            detail=f"Timeline estudiante {student_id}",
            categories='["student_timeline"]',
            commit=True,
        )
        return entries

    async def _allowed_student_ids(
        self, current_user: CurrentUser, term_id: Optional[int] = None
    ) -> list[int]:
        term_course_ids = await course_ids_for_term(
            self.session, current_user.institution_id, term_id
        )
        if not term_course_ids:
            return []

        query = select(StudentModel.id).where(
            StudentModel.institution_id == current_user.institution_id,
            StudentModel.course_id.in_(term_course_ids),
        )
        if current_user.active_role == UserRole.TUTOR:
            courses = await self.session.execute(
                select(CourseModel.id).where(
                    CourseModel.tutor_id == current_user.id,
                    CourseModel.id.in_(term_course_ids),
                )
            )
            course_ids = [c[0] for c in courses.all()]
            if not course_ids:
                return []
            query = query.where(StudentModel.course_id.in_(course_ids))
        elif current_user.active_role == UserRole.REPRESENTANTE:
            query = query.where(StudentModel.guardian_id == current_user.id)
        result = await self.session.execute(query)
        return [row[0] for row in result.all()]

    async def _ensure_student_access(self, student_id: int, current_user: CurrentUser) -> StudentModel:
        result = await self.session.execute(
            select(StudentModel, CourseModel.name)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .where(StudentModel.id == student_id)
        )
        row = result.one_or_none()
        if row is None:
            raise NotFoundError("Student")
        student, _ = row
        assert_same_institution(current_user, student.institution_id)

        if current_user.active_role == UserRole.TUTOR:
            await self._ensure_tutor_student(student_id, current_user.id)
        elif current_user.active_role in {UserRole.DECE, UserRole.ADMINISTRADOR}:
            pass
        elif current_user.active_role == UserRole.REPRESENTANTE:
            if student.guardian_id != current_user.id:
                raise ForbiddenError("You can only view your assigned children")
        elif current_user.active_role == UserRole.DOCENTE:
            raise ForbiddenError("Teachers cannot access behavioral records")
        else:
            raise ForbiddenError("Insufficient permissions")
        return student

    async def _ensure_tutor_student(self, student_id: int, tutor_id: int) -> None:
        result = await self.session.execute(
            select(StudentModel)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .where(
                StudentModel.id == student_id,
                CourseModel.tutor_id == tutor_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise ForbiddenError("Student is not in your assigned course")

    async def _ensure_can_read_dece(self, current_user: CurrentUser) -> None:
        if current_user.active_role not in {
            UserRole.DECE,
            UserRole.ADMINISTRADOR,
            UserRole.TUTOR,
        }:
            raise ValidationError("Insufficient permissions to view DECE reports")

    async def _ensure_can_read_disciplinary(self, current_user: CurrentUser) -> None:
        if current_user.active_role not in {
            UserRole.TUTOR,
            UserRole.DECE,
            UserRole.ADMINISTRADOR,
        }:
            raise ValidationError("Insufficient permissions to view disciplinary reports")

    async def _student_context(self, student_id: int) -> tuple[str, str]:
        result = await self.session.execute(
            select(StudentModel, CourseModel.name)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .where(StudentModel.id == student_id)
        )
        row = result.one_or_none()
        if row is None:
            return "—", "—"
        student, course_name = row
        return f"{student.first_name} {student.last_name}", course_name

    async def _user_name(self, user_id: int) -> str:
        user = await self.session.get(UserModel, user_id)
        if user is None:
            return "—"
        return f"{user.first_name} {user.last_name}"

    async def _dece_to_response(self, row: DeceReportModel) -> DeceReportResponse:
        student_name, course_name = await self._student_context(row.student_id)
        return DeceReportResponse(
            id=row.id,
            student_id=row.student_id,
            student_name=student_name,
            course_name=course_name,
            dece_user_id=row.dece_user_id,
            author_name=await self._user_name(row.dece_user_id),
            report_type=row.report_type,
            description=row.description,
            actions_taken=row.actions_taken,
            urgency_level=row.urgency_level,
            requires_follow_up=row.requires_follow_up,
            reported_at=row.reported_at,
        )

    async def _tutor_to_response(self, row: TutorAnnotationModel) -> TutorAnnotationResponse:
        student_name, course_name = await self._student_context(row.student_id)
        return TutorAnnotationResponse(
            id=row.id,
            student_id=row.student_id,
            student_name=student_name,
            course_name=course_name,
            tutor_id=row.tutor_id,
            author_name=await self._user_name(row.tutor_id),
            annotation_type=row.annotation_type,
            description=row.description,
            annotated_at=row.annotated_at,
        )

    async def _disciplinary_to_response(
        self, row: DisciplinaryReportModel
    ) -> DisciplinaryReportResponse:
        student_name, course_name = await self._student_context(row.student_id)
        return DisciplinaryReportResponse(
            id=row.id,
            student_id=row.student_id,
            student_name=student_name,
            course_name=course_name,
            tutor_id=row.inspector_id,
            author_name=await self._user_name(row.inspector_id),
            fault_type=row.fault_type,
            description=row.description,
            sanction=row.sanction,
            reported_at=row.reported_at,
        )

    def _build_dece_index_text(self, report: DeceReportModel) -> str:
        parts = [
            f"Tipo: {report.report_type.value}",
            f"Urgencia: {report.urgency_level.value}",
            report.description,
        ]
        if report.actions_taken:
            parts.append(f"Acciones: {report.actions_taken}")
        return "\n".join(parts)
