from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.alerts.infrastructure.models import AlertConfigModel, AlertModel
from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.institution.infrastructure.models import CourseModel, InstitutionModel
from app.modules.notifications.application.emailer import (
    build_alert_email_html,
    send_email_via_resend,
)
from app.modules.notifications.infrastructure.models import (
    EmailNotificationModel,
    InternalNotificationModel,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel, UserRoleAssignmentModel
from app.shared.enums import (
    AlertStatus,
    AlertType,
    AttendanceStatus,
    DeceReportType,
    EmailStatus,
    FaultType,
    RiskLevel,
    StudentStatus,
    TutorAnnotationType,
    UserRole,
)

logger = logging.getLogger(__name__)

RISK_ORDER = {
    RiskLevel.BAJO: 0,
    RiskLevel.MEDIO: 1,
    RiskLevel.ALTO: 2,
    RiskLevel.CRITICO: 3,
}

INTERVENTION_LOOKBACK_DAYS = 21
ACTIVE_ALERT_DEDUP_DAYS = 7
MIN_ACTIONS_FOR_INTERVENTION = 5


@dataclass
class Indicator:
    code: str
    label: str
    detail: str
    extreme: bool = False


@dataclass
class EvaluationOutcome:
    students_evaluated: int = 0
    alerts_created: int = 0
    emails_sent: int = 0
    internal_notifications: int = 0
    details: list[str] = field(default_factory=list)


async def get_or_create_config(session: AsyncSession, institution_id: int) -> AlertConfigModel:
    result = await session.execute(
        select(AlertConfigModel).where(AlertConfigModel.institution_id == institution_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = AlertConfigModel(institution_id=institution_id)
        session.add(config)
        await session.flush()
    return config


class AlertEngine:
    """RF-28/29/30/31: daily risk evaluation for all active students."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def evaluate_institution(self, institution_id: int) -> EvaluationOutcome:
        outcome = EvaluationOutcome()
        config = await get_or_create_config(self.session, institution_id)

        students_result = await self.session.execute(
            select(StudentModel).where(
                StudentModel.institution_id == institution_id,
                StudentModel.status == StudentStatus.ACTIVO,
            )
        )
        students = list(students_result.scalars().all())
        outcome.students_evaluated = len(students)

        for student in students:
            indicators, raw_level = await self._evaluate_student(student, config)
            intervention = await self._has_active_intervention(student.id)
            student.current_risk_level = self.apply_mitigation(
                raw_level, bool(indicators), intervention
            )

            if raw_level == RiskLevel.BAJO or not indicators:
                continue

            if not await self._should_create_alert(student.id, raw_level):
                continue

            alert = await self._create_alert(student, indicators, raw_level)
            outcome.alerts_created += 1

            internal = await self._notify_internal(student, alert)
            outcome.internal_notifications += internal

            if raw_level in {RiskLevel.ALTO, RiskLevel.CRITICO}:
                sent = await self._notify_email(student, alert, config)
                outcome.emails_sent += sent

        await self.session.commit()
        return outcome

    async def update_student_risk_level(
        self,
        student: StudentModel,
        *,
        force_intervention_mitigation: bool = False,
    ) -> tuple[RiskLevel, RiskLevel, list[Indicator]]:
        """Recompute semáforo for one student. Returns (raw_level, final_level, indicators)."""
        config = await get_or_create_config(self.session, student.institution_id)
        indicators, raw_level = await self._evaluate_student(student, config)
        intervention = force_intervention_mitigation or await self._has_active_intervention(
            student.id
        )
        final_level = self.apply_mitigation(raw_level, bool(indicators), intervention)
        student.current_risk_level = final_level
        return raw_level, final_level, indicators

    async def evaluate_all(self) -> EvaluationOutcome:
        institutions = await self.session.execute(select(InstitutionModel.id))
        total = EvaluationOutcome()
        for (institution_id,) in institutions.all():
            partial = await self.evaluate_institution(institution_id)
            total.students_evaluated += partial.students_evaluated
            total.alerts_created += partial.alerts_created
            total.emails_sent += partial.emails_sent
            total.internal_notifications += partial.internal_notifications
        return total

    async def _evaluate_student(
        self, student: StudentModel, config: AlertConfigModel
    ) -> tuple[list[Indicator], RiskLevel]:
        indicators: list[Indicator] = []
        thirty_days_ago = date.today() - timedelta(days=30)

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score)).where(GradeModel.student_id == student.id)
        )
        average = avg_result.scalar()
        if average is not None and float(average) < config.min_average:
            extreme = float(average) < max(config.min_average - 1.5, 0)
            indicators.append(
                Indicator(
                    code="academico",
                    label="Indicador académico",
                    detail=(
                        f"Promedio general {float(average):.2f} por debajo del umbral "
                        f"{config.min_average:.2f}"
                    ),
                    extreme=extreme,
                )
            )

        absences_result = await self.session.execute(
            select(func.count(AttendanceModel.id)).where(
                AttendanceModel.student_id == student.id,
                AttendanceModel.status == AttendanceStatus.AUSENTE,
                AttendanceModel.attendance_date >= thirty_days_ago,
            )
        )
        absences = absences_result.scalar() or 0
        if absences >= config.absences_medium:
            indicators.append(
                Indicator(
                    code="asistencia",
                    label="Indicador de ausencias",
                    detail=(
                        f"{absences} ausencias en los últimos 30 días "
                        f"(umbral medio: {config.absences_medium}, alto: {config.absences_high})"
                    ),
                    extreme=absences >= config.absences_high,
                )
            )

        faults_result = await self.session.execute(
            select(func.count(DisciplinaryReportModel.id)).where(
                DisciplinaryReportModel.student_id == student.id,
                DisciplinaryReportModel.fault_type.in_(
                    [FaultType.GRAVE, FaultType.MUY_GRAVE]
                ),
                DisciplinaryReportModel.reported_at
                >= datetime.now(timezone.utc) - timedelta(days=30),
            )
        )
        serious_faults = faults_result.scalar() or 0
        if serious_faults >= config.serious_faults_month:
            indicators.append(
                Indicator(
                    code="disciplinario",
                    label="Indicador disciplinario",
                    detail=(
                        f"{serious_faults} faltas graves o muy graves en el último mes "
                        f"(umbral: {config.serious_faults_month})"
                    ),
                    extreme=serious_faults >= config.serious_faults_month * 2,
                )
            )

        thirty_days_ago_dt = datetime.now(timezone.utc) - timedelta(days=30)
        dece_result = await self.session.execute(
            select(DeceReportModel).where(
                DeceReportModel.student_id == student.id,
                DeceReportModel.reported_at >= thirty_days_ago_dt,
            )
        )
        dece_reports = list(dece_result.scalars().all())
        if dece_reports:
            high_urgency = any(
                r.urgency_level in {RiskLevel.ALTO, RiskLevel.CRITICO} for r in dece_reports
            )
            emotional_types = {
                DeceReportType.ALERTA_EMOCIONAL,
                DeceReportType.OBSERVACION_CONDUCTUAL,
            }
            relevant = [
                r
                for r in dece_reports
                if r.report_type in emotional_types
                or r.urgency_level in {RiskLevel.MEDIO, RiskLevel.ALTO, RiskLevel.CRITICO}
                or r.requires_follow_up
            ]
            if relevant:
                has_emotional = any(
                    r.report_type == DeceReportType.ALERTA_EMOCIONAL for r in relevant
                )
                indicators.append(
                    Indicator(
                        code="emocional" if has_emotional else "conductual",
                        label="Indicador conductual/emocional (DECE)",
                        detail=(
                            f"{len(relevant)} reporte(s) DECE relevante(s) en los últimos 30 días"
                        ),
                        extreme=high_urgency or len(relevant) >= 2,
                    )
                )

        tutor_result = await self.session.execute(
            select(func.count(TutorAnnotationModel.id)).where(
                TutorAnnotationModel.student_id == student.id,
                TutorAnnotationModel.annotated_at >= thirty_days_ago_dt,
                TutorAnnotationModel.annotation_type.in_(
                    [TutorAnnotationType.COMPORTAMIENTO, TutorAnnotationType.EMOCIONAL]
                ),
            )
        )
        tutor_flags = tutor_result.scalar() or 0
        if tutor_flags >= 1:
            indicators.append(
                Indicator(
                    code="conductual",
                    label="Indicador de anotaciones del tutor",
                    detail=(
                        f"{tutor_flags} anotación(es) de comportamiento/emocional "
                        "del tutor en 30 días"
                    ),
                    extreme=tutor_flags >= 2,
                )
            )

        level = self._classify(indicators)
        return indicators, level

    @staticmethod
    def step_down_risk(level: RiskLevel) -> RiskLevel:
        mapping = {
            RiskLevel.CRITICO: RiskLevel.ALTO,
            RiskLevel.ALTO: RiskLevel.MEDIO,
            RiskLevel.MEDIO: RiskLevel.MEDIO,
            RiskLevel.BAJO: RiskLevel.BAJO,
        }
        return mapping[level]

    @staticmethod
    def apply_mitigation(
        raw_level: RiskLevel,
        has_indicators: bool,
        intervention_active: bool,
    ) -> RiskLevel:
        """Mitigación A/B: bajar un escalón si hay intervención activa; piso medio con indicadores."""
        level = (
            AlertEngine.step_down_risk(raw_level)
            if intervention_active
            else raw_level
        )
        if has_indicators and level == RiskLevel.BAJO:
            return RiskLevel.MEDIO
        return level

    async def _has_active_intervention(self, student_id: int) -> bool:
        """Mitigación B: alerta atendida reciente, sin empeoramiento posterior."""
        baseline = await self._get_intervention_baseline(student_id)
        if baseline is None:
            return False

        attended_at, _level, _actions = baseline

        newer_active = await self.session.execute(
            select(AlertModel.id).where(
                AlertModel.student_id == student_id,
                AlertModel.status == AlertStatus.ACTIVA,
                AlertModel.created_at > attended_at,
            )
        )
        if newer_active.scalar_one_or_none() is not None:
            return False

        worsening_dece = await self.session.execute(
            select(DeceReportModel.id).where(
                DeceReportModel.student_id == student_id,
                DeceReportModel.reported_at > attended_at,
                DeceReportModel.urgency_level.in_({RiskLevel.ALTO, RiskLevel.CRITICO}),
            )
        )
        return worsening_dece.scalar_one_or_none() is None

    async def _get_intervention_baseline(
        self, student_id: int
    ) -> tuple[datetime, RiskLevel, str] | None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=INTERVENTION_LOOKBACK_DAYS)
        result = await self.session.execute(
            select(AlertModel)
            .where(
                AlertModel.student_id == student_id,
                AlertModel.status == AlertStatus.ATENDIDA,
                AlertModel.attended_at.isnot(None),
                AlertModel.attended_at >= cutoff,
            )
            .order_by(AlertModel.attended_at.desc())
            .limit(1)
        )
        alert = result.scalar_one_or_none()
        if alert is None:
            return None
        actions = (alert.actions_taken or "").strip()
        if len(actions) < MIN_ACTIONS_FOR_INTERVENTION:
            return None
        return alert.attended_at, alert.level, actions

    async def _should_create_alert(self, student_id: int, level: RiskLevel) -> bool:
        """RF-31 + RN: no duplicar alertas activas ni recrear casos ya atendidos."""
        if await self._has_recent_active_alert(student_id, level):
            return False

        baseline = await self._get_intervention_baseline(student_id)
        if baseline is None:
            return True

        _attended_at, attended_level, _actions = baseline
        if RISK_ORDER[level] <= RISK_ORDER[attended_level]:
            return False
        return True

    @staticmethod
    def _classify(indicators: list[Indicator]) -> RiskLevel:
        """RF-30 risk matrix."""
        active = len(indicators)
        extremes = sum(1 for i in indicators if i.extreme)

        if active == 0:
            return RiskLevel.BAJO
        if active >= 3 or (active >= 2 and extremes >= 1):
            return RiskLevel.CRITICO
        if active >= 2 or extremes >= 1:
            return RiskLevel.ALTO
        return RiskLevel.MEDIO

    async def _has_recent_active_alert(self, student_id: int, level: RiskLevel) -> bool:
        """RF-31 / RN-05: no duplicate active alerts of same level within 7 days."""
        dedup_since = datetime.now(timezone.utc) - timedelta(days=ACTIVE_ALERT_DEDUP_DAYS)
        result = await self.session.execute(
            select(AlertModel.id).where(
                AlertModel.student_id == student_id,
                AlertModel.level == level,
                AlertModel.status == AlertStatus.ACTIVA,
                AlertModel.created_at >= dedup_since,
            )
        )
        return result.scalar_one_or_none() is not None

    async def _create_alert(
        self, student: StudentModel, indicators: list[Indicator], level: RiskLevel
    ) -> AlertModel:
        if len(indicators) >= 2:
            alert_type = AlertType.COMBINADA
        else:
            alert_type = {
                "academico": AlertType.ACADEMICA,
                "asistencia": AlertType.ASISTENCIA,
                "disciplinario": AlertType.DISCIPLINARIA,
                "conductual": AlertType.CONDUCTUAL,
                "emocional": AlertType.EMOCIONAL,
            }.get(indicators[0].code, AlertType.COMBINADA)

        description = "\n".join(f"- {i.label}: {i.detail}" for i in indicators)
        recommendations = self._build_recommendations(indicators, level)

        alert = AlertModel(
            institution_id=student.institution_id,
            student_id=student.id,
            alert_type=alert_type,
            level=level,
            description=description,
            recommendations=recommendations,
            is_manual=False,
        )
        self.session.add(alert)
        await self.session.flush()
        return alert

    @staticmethod
    def _build_recommendations(indicators: list[Indicator], level: RiskLevel) -> str:
        recs: list[str] = []
        codes = {i.code for i in indicators}
        if "academico" in codes:
            recs.append(
                "Coordinar refuerzo académico con los docentes de las materias con menor rendimiento."
            )
            recs.append("Citar al representante para acordar un plan de apoyo en casa.")
        if "asistencia" in codes:
            recs.append(
                "Contactar al representante para identificar las causas de las ausencias."
            )
            recs.append("Verificar si las ausencias requieren justificación médica o social.")
        if "disciplinario" in codes:
            recs.append(
                "Programar una entrevista con el estudiante y el inspector para revisar las faltas."
            )
        if "conductual" in codes or "emocional" in codes:
            recs.append(
                "Revisar reportes DECE y anotaciones del tutor; programar entrevista psicopedagógica."
            )
            recs.append(
                "Coordinar con el tutor del curso un plan de seguimiento conductual/emocional."
            )
        if level in {RiskLevel.ALTO, RiskLevel.CRITICO}:
            recs.append(
                "Registrar un plan de intervención DECE con seguimiento semanal del caso."
            )
        if level == RiskLevel.CRITICO:
            recs.append(
                "Evaluar riesgo de deserción y activar protocolo institucional de retención."
            )
        return "\n".join(f"- {r}" for r in recs)

    async def _dece_user_ids(self, institution_id: int) -> list[tuple[int, str | None]]:
        result = await self.session.execute(
            select(UserModel.id, UserModel.email)
            .join(UserRoleAssignmentModel, UserRoleAssignmentModel.user_id == UserModel.id)
            .where(
                UserModel.institution_id == institution_id,
                UserRoleAssignmentModel.role == UserRole.DECE,
            )
            .distinct()
        )
        return [(row[0], row[1]) for row in result.all()]

    async def _notify_internal(self, student: StudentModel, alert: AlertModel) -> int:
        """RF-46: internal notifications for DECE staff and the course tutor."""
        recipients: set[int] = set()
        for user_id, _ in await self._dece_user_ids(student.institution_id):
            recipients.add(user_id)

        course = await self.session.get(CourseModel, student.course_id)
        if course is not None and course.tutor_id:
            recipients.add(course.tutor_id)

        label = {
            RiskLevel.MEDIO: "media",
            RiskLevel.ALTO: "alta",
            RiskLevel.CRITICO: "crítica",
        }.get(alert.level, alert.level.value)

        for user_id in recipients:
            self.session.add(
                InternalNotificationModel(
                    user_id=user_id,
                    alert_id=alert.id,
                    title=f"Alerta {label}: {student.first_name} {student.last_name}",
                    message=alert.description,
                )
            )
        return len(recipients)

    async def _notify_email(
        self, student: StudentModel, alert: AlertModel, config: AlertConfigModel
    ) -> int:
        """RF-42/43/44: email to guardian and DECE staff for high/critical alerts."""
        institution = await self.session.get(InstitutionModel, student.institution_id)
        institution_name = institution.name if institution else "SIDTRAC"
        course = await self.session.get(CourseModel, student.course_id)
        course_name = course.name if course else "—"

        recipients: list[str] = []
        if student.guardian_id:
            guardian = await self.session.get(UserModel, student.guardian_id)
            if guardian is not None and guardian.email:
                recipients.append(guardian.email)
        for _, email in await self._dece_user_ids(student.institution_id):
            if email:
                recipients.append(email)

        html = build_alert_email_html(
            student_name=f"{student.first_name} {student.last_name}",
            course_name=course_name,
            level=alert.level.value,
            description=alert.description,
            recommendations=alert.recommendations,
            institution_name=institution_name,
        )
        subject = (
            f"[SIDTRAC] Alerta {alert.level.value.upper()} — "
            f"{student.first_name} {student.last_name}"
        )

        sent_count = 0
        sender = None
        if config.sender_email:
            sender = f"SIDTRAC <{config.sender_email}>"
        for recipient in dict.fromkeys(recipients):
            success, resend_id, error = send_email_via_resend(
                recipient=recipient, subject=subject, html=html, sender=sender
            )
            self.session.add(
                EmailNotificationModel(
                    alert_id=alert.id,
                    recipient=recipient,
                    subject=subject,
                    body_html=html,
                    status=EmailStatus.ENVIADO if success else EmailStatus.ERROR,
                    resend_id=resend_id,
                    error_detail=error,
                    sent_at=datetime.now(timezone.utc) if success else None,
                )
            )
            if success:
                sent_count += 1

        alert.email_sent = sent_count > 0
        return sent_count
