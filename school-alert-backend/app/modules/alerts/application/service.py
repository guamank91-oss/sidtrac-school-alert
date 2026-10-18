from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.alerts.application.engine import AlertEngine, get_or_create_config
from app.modules.alerts.infrastructure.models import AlertConfigModel, AlertModel
from app.modules.alerts.schemas import (
    AlertConfigUpdate,
    AlertResponse,
    AlertStats,
    AttendAlertRequest,
    EvaluationResult,
    ManualAlertCreate,
)
from app.modules.audit.application.service import record_audit
from app.modules.institution.infrastructure.models import CourseModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertStatus, AlertType, RiskLevel, StudentStatus, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.term_resolver import course_ids_for_term
from app.shared.tenant import assert_same_institution

RISK_ORDER_SQL = {
    RiskLevel.CRITICO: 0,
    RiskLevel.ALTO: 1,
    RiskLevel.MEDIO: 2,
    RiskLevel.BAJO: 3,
}


class AlertService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_alerts(
        self,
        current_user: CurrentUser,
        status: Optional[AlertStatus] = None,
        level: Optional[RiskLevel] = None,
        alert_type: Optional[AlertType] = None,
        course_id: Optional[int] = None,
        student_id: Optional[int] = None,
        term_id: Optional[int] = None,
    ) -> list[AlertResponse]:
        institution_id = current_user.institution_id
        term_course_ids = await course_ids_for_term(self.session, institution_id, term_id)
        if not term_course_ids:
            return []

        attendant = aliased(UserModel)
        query = (
            select(AlertModel, StudentModel, CourseModel, attendant)
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .join(CourseModel, StudentModel.course_id == CourseModel.id)
            .outerjoin(attendant, AlertModel.attended_by == attendant.id)
            .where(
                AlertModel.institution_id == institution_id,
                StudentModel.course_id.in_(term_course_ids),
            )
            .order_by(AlertModel.created_at.desc())
            .limit(300)
        )

        if current_user.active_role == UserRole.TUTOR:
            query = query.where(CourseModel.tutor_id == current_user.id)

        if status:
            query = query.where(AlertModel.status == status)
        if level:
            query = query.where(AlertModel.level == level)
        if alert_type:
            query = query.where(AlertModel.alert_type == alert_type)
        if course_id:
            query = query.where(StudentModel.course_id == course_id)
        if student_id:
            query = query.where(AlertModel.student_id == student_id)

        result = await self.session.execute(query)
        responses: list[AlertResponse] = []
        for alert, student, course, attended_by in result.all():
            responses.append(
                AlertResponse(
                    id=alert.id,
                    student_id=student.id,
                    student_name=f"{student.first_name} {student.last_name}",
                    course_name=course.name,
                    alert_type=alert.alert_type,
                    level=alert.level,
                    description=alert.description,
                    recommendations=alert.recommendations,
                    status=alert.status,
                    is_manual=alert.is_manual,
                    attended_by_name=(
                        f"{attended_by.first_name} {attended_by.last_name}"
                        if attended_by
                        else None
                    ),
                    actions_taken=alert.actions_taken,
                    attended_at=alert.attended_at,
                    email_sent=alert.email_sent,
                    created_at=alert.created_at,
                )
            )
        responses.sort(key=lambda a: (a.status != AlertStatus.ACTIVA, RISK_ORDER_SQL[a.level]))
        return responses

    async def stats(self, current_user: CurrentUser, term_id: Optional[int] = None) -> AlertStats:
        institution_id = current_user.institution_id
        term_course_ids = await course_ids_for_term(self.session, institution_id, term_id)
        if not term_course_ids:
            return AlertStats(
                active_critical=0,
                active_high=0,
                active_medium=0,
                low_pct=100.0,
                total_students=0,
            )

        active = (
            select(AlertModel.level, func.count(AlertModel.id))
            .join(StudentModel, AlertModel.student_id == StudentModel.id)
            .where(
                AlertModel.institution_id == institution_id,
                AlertModel.status == AlertStatus.ACTIVA,
                StudentModel.course_id.in_(term_course_ids),
            )
        )
        result = await self.session.execute(active.group_by(AlertModel.level))
        counts = {level: count for level, count in result.all()}

        total_result = await self.session.execute(
            select(func.count(StudentModel.id)).where(
                StudentModel.institution_id == institution_id,
                StudentModel.status == StudentStatus.ACTIVO,
                StudentModel.course_id.in_(term_course_ids),
            )
        )
        total_students = total_result.scalar() or 0

        low_result = await self.session.execute(
            select(func.count(StudentModel.id)).where(
                StudentModel.institution_id == institution_id,
                StudentModel.status == StudentStatus.ACTIVO,
                StudentModel.current_risk_level == RiskLevel.BAJO,
                StudentModel.course_id.in_(term_course_ids),
            )
        )
        low_students = low_result.scalar() or 0

        return AlertStats(
            active_critical=counts.get(RiskLevel.CRITICO, 0),
            active_high=counts.get(RiskLevel.ALTO, 0),
            active_medium=counts.get(RiskLevel.MEDIO, 0),
            low_pct=round(low_students * 100 / total_students, 1) if total_students else 100.0,
            total_students=total_students,
        )

    async def create_manual_alert(
        self, current_user: CurrentUser, data: ManualAlertCreate
    ) -> AlertResponse:
        """RF-34: manual alert from a student profile."""
        student = await self.session.get(StudentModel, data.student_id)
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        alert = AlertModel(
            institution_id=student.institution_id,
            student_id=student.id,
            alert_type=data.alert_type,
            level=data.level,
            description=data.description,
            recommendations=data.recommendations,
            is_manual=True,
            created_by=current_user.id,
        )
        self.session.add(alert)

        # Manual alerts also raise the visible risk level if higher.
        from app.modules.alerts.application.engine import RISK_ORDER

        if RISK_ORDER[data.level] > RISK_ORDER[student.current_risk_level]:
            student.current_risk_level = data.level

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="alerta_manual",
            detail=f"Alerta manual nivel {data.level.value} para estudiante {student.id}",
        )
        await self.session.commit()
        await self.session.refresh(alert)
        alerts = await self.list_alerts(current_user, student_id=student.id)
        return next(a for a in alerts if a.id == alert.id)

    async def attend_alert(
        self, current_user: CurrentUser, alert_id: int, data: AttendAlertRequest
    ) -> AlertResponse:
        """RF-32: attend an alert and archive it."""
        alert = await self.session.get(AlertModel, alert_id)
        if alert is None:
            raise NotFoundError("Alert")
        assert_same_institution(current_user, alert.institution_id)
        if alert.status != AlertStatus.ACTIVA:
            raise ValidationError("La alerta ya fue atendida")

        alert.status = AlertStatus.ATENDIDA
        alert.attended_by = current_user.id
        alert.actions_taken = data.actions_taken
        alert.attended_at = datetime.now(timezone.utc)

        student = await self.session.get(StudentModel, alert.student_id)
        if student is not None:
            engine = AlertEngine(self.session)
            raw_level, final_level, _indicators = await engine.update_student_risk_level(
                student,
                force_intervention_mitigation=True,
            )
            if raw_level != final_level:
                await record_audit(
                    self.session,
                    user_id=current_user.id,
                    action="semaforo_mitigado_por_atencion",
                    detail=(
                        f"Estudiante {student.id}: {raw_level.value} → {final_level.value} "
                        f"tras atender alerta {alert_id}"
                    ),
                )

        await record_audit(
            self.session,
            user_id=current_user.id,
            action="alerta_atendida",
            detail=f"Alerta {alert_id} atendida",
        )
        await self.session.commit()
        alerts = await self.list_alerts(current_user, student_id=alert.student_id)
        return next(a for a in alerts if a.id == alert_id)

    async def get_config(self, current_user: CurrentUser) -> AlertConfigModel:
        config = await get_or_create_config(self.session, current_user.institution_id)
        await self.session.commit()
        return config

    async def update_config(
        self, current_user: CurrentUser, data: AlertConfigUpdate
    ) -> AlertConfigModel:
        """RF-05 / RF-33: adjustable thresholds without code changes."""
        config = await get_or_create_config(self.session, current_user.institution_id)
        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(config, key, value)
        await record_audit(
            self.session,
            user_id=current_user.id,
            action="configuracion_umbrales",
            detail=f"Umbrales actualizados: {updates}",
        )
        await self.session.commit()
        await self.session.refresh(config)
        return config

    async def run_evaluation(self, current_user: CurrentUser) -> EvaluationResult:
        """Manual trigger of the daily evaluation (also used by the scheduler)."""
        engine = AlertEngine(self.session)
        outcome = await engine.evaluate_institution(current_user.institution_id)
        await record_audit(
            self.session,
            user_id=current_user.id,
            action="evaluacion_alertas",
            detail=(
                f"{outcome.students_evaluated} estudiantes evaluados, "
                f"{outcome.alerts_created} alertas creadas"
            ),
            commit=True,
        )
        return EvaluationResult(
            students_evaluated=outcome.students_evaluated,
            alerts_created=outcome.alerts_created,
            emails_sent=outcome.emails_sent,
            internal_notifications=outcome.internal_notifications,
        )


async def create_alert_from_behavioral(
    session: AsyncSession,
    *,
    student_id: int,
    level: RiskLevel,
    description: str,
    created_by: int,
    alert_type: AlertType = AlertType.EMOCIONAL,
) -> AlertModel | None:
    """DECE report with medium+ urgency auto-generates a linked alert."""
    from app.modules.alerts.application.engine import AlertEngine, RISK_ORDER, get_or_create_config

    student = await session.get(StudentModel, student_id)
    if student is None:
        return None

    engine = AlertEngine(session)
    if RISK_ORDER[level] > RISK_ORDER[student.current_risk_level]:
        student.current_risk_level = level

    if not await engine._should_create_alert(student_id, level):
        return None

    alert = AlertModel(
        institution_id=student.institution_id,
        student_id=student_id,
        alert_type=alert_type,
        level=level,
        description=description,
        recommendations=(
            "- Dar seguimiento al reporte DECE que originó esta alerta.\n"
            "- Coordinar con el tutor del curso y el representante legal.\n"
            "- Registrar plan de intervención si aún no existe."
        ),
        is_manual=False,
        created_by=created_by,
    )
    session.add(alert)
    await session.flush()

    await engine._notify_internal(student, alert)
    config = await get_or_create_config(session, student.institution_id)
    if level in {RiskLevel.ALTO, RiskLevel.CRITICO}:
        await engine._notify_email(student, alert, config)

    return alert
