from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.action_plans.generation_schema import (
    ActionPlanGeneration,
    FactItem,
    GenerateRequest,
    GenerationAction,
    GenerationAssessment,
    GenerationNormativeRef,
    GenerationPlan,
    GenerationTriage,
    InferenceItem,
)
from app.modules.action_plans.application.role_normalize import (
    normalize_plan_role,
    normalize_supporting_roles,
)
from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.cases.application.triage_rules import suggest_triage
from app.modules.cases.infrastructure.models import DeceCaseAlertModel, DeceCaseModel
from app.modules.institution.infrastructure.models import (
    CourseModel,
    CourseSubjectModel,
    SubjectModel,
)
from app.modules.normative.application.service import NormativeService
from app.modules.normative.seed_data import DOCUMENT_CODE
from app.modules.rag.application.openrouter import AI_PROVIDER_DISABLED, chat_completion
from app.modules.students.infrastructure.models import StudentModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertStatus, AttendanceStatus
from app.shared.exceptions import DomainError, ForbiddenError, NotFoundError
from app.shared.feature_flags import action_plans_enabled
from app.shared.permissions import CASE_VIEW_PROFESSIONAL, require_capability
from app.shared.privacy.minimization import make_student_ref
from app.shared.tenant import assert_same_institution


logger = logging.getLogger(__name__)


SYSTEM_GENERATE = """Eres asistente DECE. Responde SOLO JSON válido según el esquema pedido.
Usa EXCLUSIVAMENTE los facts y el contexto minimizado: no inventes ausencias, notas ni alertas.
Si un dato no está en facts, ponlo en missing_information.
Genera un PLAN operativo (triage, hechos, factores, objetivo, 4-6 acciones con responsable,
due_hint, expected_result, success_indicator, evidence_required, rationale).
Prioriza acciones según los facts reales (asistencia vs académico vs conductual).
En assessment.situation_summary escribe un párrafo breve de contexto (curso, riesgo, cantidad de hechos
y necesidad de entrevista). NO enumeres ni copies los hechos: esos van solo en assessment.facts.
No uses nombres reales ni cédulas; usa student_ref.
No emitas diagnósticos clínicos.
responsible_role y supporting_roles SOLO códigos exactos en minúsculas: dece, tutor, docente, inspector.
Nunca etiquetas como "Tutor", "Docente" o "Psicólogo del DECE".

Los facts pueden incluir faltas disciplinarias (disciplinary_report), reportes DECE
(dece_report: entrevista/observación conductual/alerta emocional/seguimiento), anotaciones de
tutor (tutor_annotation) y alertas ya atendidas (alert_atendida) con sus acciones previas. Estos
hechos de conducta/protección son PRIORITARIOS sobre los académicos: si existen, el plan NO puede
ser solo académico. Reflájalos en triage (violence_presumption, rights_violation,
urgent_protocol_needed según corresponda) y en risk_factors, y que al menos la mitad de las
acciones prioritarias respondan directamente a esos hechos (no solo a notas/asistencia).

Ningún campo de texto puede quedar vacío, "none", "n/a" ni "no aplica": si no hay evidencia,
escribe una frase profesional explicando eso (ej. "No identificado en los registros disponibles",
"Sin evidencia registrada, requiere verificación en entrevista").
- assessment.risk_factors: 2-5 frases que resuman por qué el caso preocupa, basadas en facts reales
  (semáforo, ausencias, promedios bajos, alertas). Nunca [].
- assessment.protective_factors: al menos 1-3 frases (aunque sean estructurales, ej. "Cuenta con
  acompañamiento de tutor/DECE disponible"). Nunca [].
- assessment.missing_information: 2-4 frases sobre qué falta por confirmar (perspectiva del
  estudiante, representante, contexto familiar/salud). Nunca [].
- plan.limitations: 2-4 frases (ej. "Borrador basado solo en registros disponibles", "No sustituye
  entrevista ni valoración profesional", "No es un diagnóstico clínico"). Nunca [].
- triage.immediate_integrity_risk, violence_presumption, self_harm_risk, rights_violation,
  repeated_absences, urgent_protocol_needed: cada uno una frase clara en español, nunca "none".

Se te da allowed_normative_articles (lista de {source_chunk_id, article, article_title} realmente
vigentes). Revisa los facts y, si el motivo calza con alguno, inclúyelo en normative_references
usando ESE source_chunk_id exacto: ausencias -> artículo de inasistencia; notas bajas -> refuerzo
pedagógico; faltas disciplinarias/conducta/acoso/bullying -> artículos de protección de derechos y
atención DECE, y también el de procedimiento disciplinario si hay disciplinary_report entre los
facts (aclarando siempre que requiere confirmación profesional, SIDTRAC no tipifica sanciones).
document_name/version/effective_from puedes dejarlos aproximados: el sistema los reemplaza
automáticamente por el dato oficial. No inventes artículos fuera de allowed_normative_articles; si
ninguno aplica, deja normative_references en [].

Responde EXCLUSIVAMENTE un objeto JSON (sin ```` ```json ```` ni texto fuera del JSON) con
EXACTAMENTE esta forma y estos nombres de clave (no los traduzcas ni los renombres):
{
  "triage": {
    "routine_plan_allowed": bool, "protocol_review_required": bool,
    "protocol_type": string|null, "urgency": "normal"|"high"|"critical",
    "flags": [string], "reasons": [string],
    "professional_confirmation_required": [string],
    "immediate_integrity_risk": string, "violence_presumption": string,
    "self_harm_risk": string, "rights_violation": string,
    "repeated_absences": string, "urgent_protocol_needed": string
  },
  "assessment": {
    "situation_summary": string, "opening_reason": string,
    "facts": [{"fact_id": string, "text": string, "source": string, "date": "YYYY-MM-DD"|null}],
    "inferences": [{"text": string, "based_on_fact_ids": [string]}],
    "protective_factors": [string], "risk_factors": [string], "missing_information": [string]
  },
  "plan": {
    "plan_type": string, "general_objective": string, "limitations": [string],
    "review_criteria": string, "review_at_hint": string|null, "review_triggers": [string]
  },
  "actions": [
    {
      "title": string, "objective": string, "action_type": string, "dece_axis": string,
      "case_dimension": string, "rationale": string, "source_fact_ids": [string],
      "responsible_role": string, "supporting_roles": [string], "due_hint": string,
      "expected_result": string, "success_indicator": string, "evidence_required": bool,
      "priority": integer, "confidentiality_level": string, "normative_hint": string|null
    }
  ],
  "normative_references": [
    {
      "document_code": string, "document_name": string, "version": string, "article": string,
      "article_title": string, "effective_from": "YYYY-MM-DD",
      "source_chunk_id": string
    }
  ]
}
"actions" va SIEMPRE al nivel raíz (hermana de "plan"), NUNCA anidada dentro de "plan".
"normative_references" son objetos completos, nunca strings sueltos; usa solo
source_chunk_id presentes en allowed_normative_articles, o deja la lista vacía []."""


class PlanGenerationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def generate(self, user: CurrentUser, data: GenerateRequest) -> ActionPlanGeneration:
        if not action_plans_enabled():
            raise ForbiddenError("FEATURE_ACTION_PLANS is disabled")
        require_capability(user, CASE_VIEW_PROFESSIONAL)

        case = await self.session.get(DeceCaseModel, data.case_id)
        if case is None:
            raise NotFoundError("Case")
        assert_same_institution(user, case.institution_id)
        student = await self.session.get(StudentModel, case.student_id)
        if student is None:
            raise NotFoundError("Student")

        student_ref = make_student_ref(
            institution_id=student.institution_id, student_id=student.id
        )
        course = await self.session.get(CourseModel, student.course_id)
        course_name = course.name if course else "curso no registrado"

        facts = await self._build_student_facts(case=case, student=student, course_name=course_name)

        case_alert_rows = await self.session.execute(
            select(AlertModel)
            .join(DeceCaseAlertModel, DeceCaseAlertModel.alert_id == AlertModel.id)
            .where(DeceCaseAlertModel.case_id == case.id)
        )
        case_alerts = list(case_alert_rows.scalars().all())
        if not case_alerts:
            active_alert_rows = await self.session.execute(
                select(AlertModel).where(
                    AlertModel.student_id == student.id,
                    AlertModel.status == AlertStatus.ACTIVA,
                )
            )
            triage_alerts = list(active_alert_rows.scalars().all())
        else:
            triage_alerts = case_alerts
        suggestion = suggest_triage(
            student_risk=student.current_risk_level,
            alert_levels=[a.level for a in triage_alerts],
            alert_types=[a.alert_type.value for a in triage_alerts],
        )

        allowed_refs = await NormativeService(self.session).list_articles(
            code=DOCUMENT_CODE, current_only=True
        )
        allowed_chunk_ids = {r.source_chunk_id for r in allowed_refs}
        refs_by_chunk_id = {r.source_chunk_id: r for r in allowed_refs}

        minimized_payload = {
            "student_ref": student_ref,
            "course": course_name,
            "risk_level": student.current_risk_level.value,
            "case_title": case.title,
            "case_opening_summary": case.opening_summary,
            "facts": [f.model_dump(mode="json") for f in facts],
            "triage_hint": {
                "routine_plan_allowed": suggestion.routine_plan_allowed,
                "protocol_review_required": suggestion.protocol_review_required,
                "protocol_type": suggestion.protocol_type,
                "urgency": suggestion.urgency,
                "flags": suggestion.flags,
                "reasons": suggestion.reasons,
            },
            "allowed_normative_articles": [
                {
                    "source_chunk_id": r.source_chunk_id,
                    "article": r.article,
                    "article_title": r.article_title,
                }
                for r in allowed_refs
            ],
            "focus": data.question_focus,
        }

        messages = [
            {"role": "system", "content": SYSTEM_GENERATE},
            {
                "role": "user",
                "content": (
                    "Genera un borrador de plan de atención en JSON estricto con claves "
                    "triage, assessment, plan, actions, normative_references. "
                    "Basado SOLO en estos facts del estudiante seleccionado:\n"
                    f"{json.dumps(minimized_payload, ensure_ascii=False)}"
                ),
            },
        ]
        content, _tokens, error = await chat_completion(
            messages,
            temperature=0.1,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        if error == AI_PROVIDER_DISABLED:
            raise DomainError(
                "El proveedor de IA está deshabilitado",
                code=AI_PROVIDER_DISABLED,
            )
        if error or not content:
            raise DomainError(
                "No se pudo generar el plan con IA. Verifique la conexión o la clave de OpenRouter e intente de nuevo.",
                code="AI_GENERATION_FAILED",
            )
        # Some models still wrap JSON-mode output in a markdown fence despite instructions.
        cleaned_content = content.strip()
        if cleaned_content.startswith("```"):
            cleaned_content = re.sub(
                r"^```(?:json)?\s*|\s*```$", "", cleaned_content, flags=re.I | re.M
            ).strip()
        try:
            raw = json.loads(cleaned_content)
            draft = ActionPlanGeneration.model_validate(raw)
            # Never trust document_name/version/effective_from from the model: rebuild each
            # selected reference from the authoritative record so citations can't drift.
            selected_chunk_ids = {
                r.source_chunk_id
                for r in draft.normative_references
                if r.source_chunk_id in allowed_chunk_ids
            }
            draft.normative_references = [
                GenerationNormativeRef(
                    document_code=refs_by_chunk_id[cid].document_code,
                    document_name=refs_by_chunk_id[cid].document_name,
                    version=refs_by_chunk_id[cid].version,
                    article=refs_by_chunk_id[cid].article,
                    article_title=refs_by_chunk_id[cid].article_title,
                    effective_from=refs_by_chunk_id[cid].effective_from,
                    source_chunk_id=cid,
                )
                for cid in selected_chunk_ids
            ]
            # Keep institutional facts as source of truth in the document.
            if not draft.assessment.facts:
                draft.assessment.facts = facts
            self._fill_ai_gaps(draft, facts=facts, course_name=course_name)
            for action in draft.actions:
                action.responsible_role = normalize_plan_role(action.responsible_role)
                action.supporting_roles = normalize_supporting_roles(action.supporting_roles)
            draft.draft_origin = "ai"
            draft.context_course = course_name
            draft.context_risk = student.current_risk_level.value
            return draft
        except DomainError:
            raise
        except Exception as exc:
            logger.warning(
                "AI draft failed schema validation for case_id=%s: %s | content=%s",
                case.id,
                exc,
                content[:800],
            )
            raise DomainError(
                "La IA respondió, pero el borrador no es válido. Intente generar de nuevo.",
                code="AI_GENERATION_FAILED",
            ) from exc

    async def _build_student_facts(
        self, *, case: DeceCaseModel, student: StudentModel, course_name: str
    ) -> list[FactItem]:
        today = date.today()
        thirty_days_ago = today - timedelta(days=30)
        facts: list[FactItem] = [
            FactItem(
                fact_id=f"risk_{student.current_risk_level.value}",
                text=f"Semáforo institucional: {student.current_risk_level.value}",
                source="student_risk",
                date=today,
            ),
            FactItem(
                fact_id=f"course_{student.course_id}",
                text=f"Curso registrado: {course_name}",
                source="enrollment",
                date=today,
            ),
        ]
        if case.opening_summary:
            facts.append(
                FactItem(
                    fact_id=f"case_summary_{case.id}",
                    text=f"Motivo de apertura del caso: {case.opening_summary[:240]}",
                    source="case_opening",
                    date=today,
                )
            )

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score)).where(GradeModel.student_id == student.id)
        )
        average = avg_result.scalar()
        if average is not None:
            facts.append(
                FactItem(
                    fact_id="grade_avg",
                    text=f"Promedio general registrado: {float(average):.2f}/10",
                    source="grades",
                    date=today,
                )
            )

        subject_rows = await self.session.execute(
            select(SubjectModel.name, func.avg(GradeModel.score))
            .join(CourseSubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(GradeModel, GradeModel.course_subject_id == CourseSubjectModel.id)
            .where(GradeModel.student_id == student.id)
            .group_by(SubjectModel.name)
            .order_by(func.avg(GradeModel.score))
            .limit(5)
        )
        for name, avg in subject_rows.all():
            facts.append(
                FactItem(
                    fact_id=f"grade_subject_{name}",
                    text=f"Promedio en {name}: {float(avg):.2f}/10",
                    source="grades_by_subject",
                    date=today,
                )
            )

        attendance_rows = await self.session.execute(
            select(AttendanceModel.status, func.count(AttendanceModel.id))
            .where(
                AttendanceModel.student_id == student.id,
                AttendanceModel.attendance_date >= thirty_days_ago,
            )
            .group_by(AttendanceModel.status)
        )
        attendance = {status: count for status, count in attendance_rows.all()}
        absences = attendance.get(AttendanceStatus.AUSENTE, 0)
        tardies = attendance.get(AttendanceStatus.TARDANZA, 0)
        justified = attendance.get(AttendanceStatus.JUSTIFICADO, 0)
        presents = attendance.get(AttendanceStatus.PRESENTE, 0)
        if absences or tardies or justified or presents:
            facts.append(
                FactItem(
                    fact_id="attendance_30d",
                    text=(
                        f"Asistencia últimos 30 días: {absences} ausencias, "
                        f"{tardies} tardanzas, {justified} justificadas, {presents} presentes"
                    ),
                    source="attendance",
                    date=today,
                )
            )
        else:
            facts.append(
                FactItem(
                    fact_id="attendance_30d_empty",
                    text="Sin registros de asistencia en los últimos 30 días",
                    source="attendance",
                    date=today,
                )
            )

        att_by_subject = await self.session.execute(
            select(
                SubjectModel.name,
                AttendanceModel.status,
                func.count(AttendanceModel.id),
            )
            .join(CourseSubjectModel, CourseSubjectModel.id == AttendanceModel.course_subject_id)
            .join(SubjectModel, SubjectModel.id == CourseSubjectModel.subject_id)
            .where(
                AttendanceModel.student_id == student.id,
                AttendanceModel.attendance_date >= thirty_days_ago,
                AttendanceModel.status == AttendanceStatus.AUSENTE,
            )
            .group_by(SubjectModel.name, AttendanceModel.status)
            .order_by(func.count(AttendanceModel.id).desc())
            .limit(5)
        )
        for subject_name, _status, count in att_by_subject.all():
            facts.append(
                FactItem(
                    fact_id=f"absence_subject_{subject_name}",
                    text=f"Ausencias en {subject_name} (30 días): {count}",
                    source="attendance_by_subject",
                    date=today,
                )
            )

        alert_rows = await self.session.execute(
            select(AlertModel)
            .where(
                AlertModel.student_id == student.id,
                AlertModel.status == AlertStatus.ACTIVA,
            )
            .order_by(AlertModel.created_at.desc())
            .limit(5)
        )
        for alert in alert_rows.scalars().all():
            facts.append(
                FactItem(
                    fact_id=f"alert_{alert.id}",
                    text=(
                        f"Alerta {alert.alert_type.value} nivel {alert.level.value}: "
                        f"{(alert.description or '')[:160]}"
                    ),
                    source="alert_activa",
                    date=alert.created_at.date() if alert.created_at else today,
                )
            )

        # Conduct/discipline/DECE follow-up history is often the actual reason a case was
        # opened; without it the draft only sees grades/attendance and reads as purely
        # academic even when there's an active bullying/behavioral situation.
        one_year_ago = datetime.combine(today - timedelta(days=365), datetime.min.time())

        disciplinary_rows = await self.session.execute(
            select(DisciplinaryReportModel)
            .where(
                DisciplinaryReportModel.student_id == student.id,
                DisciplinaryReportModel.reported_at >= one_year_ago,
            )
            .order_by(DisciplinaryReportModel.reported_at.desc())
            .limit(5)
        )
        for row in disciplinary_rows.scalars().all():
            text = f"Falta disciplinaria ({row.fault_type.value}): {(row.description or '')[:200]}"
            if row.sanction:
                text += f" | Sanción: {row.sanction[:120]}"
            facts.append(
                FactItem(
                    fact_id=f"disciplinary_{row.id}",
                    text=text,
                    source="disciplinary_report",
                    date=row.reported_at.date(),
                )
            )

        dece_report_rows = await self.session.execute(
            select(DeceReportModel)
            .where(
                DeceReportModel.student_id == student.id,
                DeceReportModel.reported_at >= one_year_ago,
            )
            .order_by(DeceReportModel.reported_at.desc())
            .limit(6)
        )
        for row in dece_report_rows.scalars().all():
            text = (
                f"Reporte DECE ({row.report_type.value}, urgencia {row.urgency_level.value}): "
                f"{(row.description or '')[:200]}"
            )
            if row.actions_taken:
                text += f" | Acciones previas: {row.actions_taken[:160]}"
            facts.append(
                FactItem(
                    fact_id=f"dece_report_{row.id}",
                    text=text,
                    source="dece_report",
                    date=row.reported_at.date(),
                )
            )

        tutor_annotation_rows = await self.session.execute(
            select(TutorAnnotationModel)
            .where(
                TutorAnnotationModel.student_id == student.id,
                TutorAnnotationModel.annotated_at >= one_year_ago,
            )
            .order_by(TutorAnnotationModel.annotated_at.desc())
            .limit(5)
        )
        for row in tutor_annotation_rows.scalars().all():
            facts.append(
                FactItem(
                    fact_id=f"tutor_annotation_{row.id}",
                    text=(
                        f"Anotación de tutor ({row.annotation_type.value}): "
                        f"{(row.description or '')[:200]}"
                    ),
                    source="tutor_annotation",
                    date=row.annotated_at.date(),
                )
            )

        attended_alert_rows = await self.session.execute(
            select(AlertModel)
            .where(
                AlertModel.student_id == student.id,
                AlertModel.status == AlertStatus.ATENDIDA,
            )
            .order_by(AlertModel.created_at.desc())
            .limit(5)
        )
        for alert in attended_alert_rows.scalars().all():
            text = (
                f"Alerta atendida ({alert.alert_type.value}, nivel {alert.level.value}): "
                f"{(alert.description or '')[:160]}"
            )
            if alert.actions_taken:
                text += f" | Acciones tomadas: {alert.actions_taken[:160]}"
            resolved_at = alert.attended_at or alert.created_at
            facts.append(
                FactItem(
                    fact_id=f"alert_atendida_{alert.id}",
                    text=text,
                    source="alert_atendida",
                    date=resolved_at.date() if resolved_at else today,
                )
            )

        return facts

    _LAZY_PLACEHOLDERS = {"", "none", "n/a", "na", "ninguno", "ninguna", "no aplica", "no disponible"}

    def _fill_ai_gaps(
        self, draft: ActionPlanGeneration, *, facts: list[FactItem], course_name: str
    ) -> None:
        """Backstop specific empty/lazy fields the model tends to skip, without
        discarding any of the AI's own synthesis (summary, actions, urgency, etc.)."""
        default_triage = GenerationTriage()
        for field in (
            "immediate_integrity_risk",
            "violence_presumption",
            "self_harm_risk",
            "rights_violation",
            "repeated_absences",
            "urgent_protocol_needed",
        ):
            value = getattr(draft.triage, field, "") or ""
            if value.strip().lower() in self._LAZY_PLACEHOLDERS:
                setattr(draft.triage, field, getattr(default_triage, field))

        if not draft.assessment.risk_factors:
            # Conduct/discipline facts matter more than routine academic ones, so they
            # lead the backstop list when both are present.
            priority_sources = {
                "disciplinary_report",
                "dece_report",
                "tutor_annotation",
                "alert_atendida",
                "alert_activa",
            }
            secondary_sources = {
                "student_risk",
                "attendance",
                "attendance_by_subject",
                "grades",
                "grades_by_subject",
            }
            priority_facts = [f.text for f in facts if f.source in priority_sources]
            secondary_facts = [f.text for f in facts if f.source in secondary_sources]
            draft.assessment.risk_factors = (priority_facts + secondary_facts)[:5] or [
                "Semáforo institucional en nivel de riesgo elevado"
            ]

        if not draft.assessment.protective_factors:
            draft.assessment.protective_factors = [
                f"Estudiante matriculado en {course_name}",
                "Existe estructura de tutor/DECE para acompañamiento",
            ]

        if not draft.assessment.missing_information:
            draft.assessment.missing_information = [
                "Perspectiva del estudiante",
                "Información actualizada del representante",
                "Situación familiar / salud / transporte / economía",
            ]

        if not draft.plan.limitations:
            draft.plan.limitations = [
                "El borrador se basa solo en registros disponibles al momento de generar",
                "No sustituye entrevista ni valoración profesional presencial",
                "No representa un diagnóstico psicológico o clínico",
            ]

    def _local_draft(
        self,
        *,
        suggestion,
        facts: list[FactItem],
        allowed_refs,
        student_ref: str,
        course_name: str,
        case: DeceCaseModel,
        risk: str,
    ) -> ActionPlanGeneration:
        ref32 = next((r for r in allowed_refs if r.article == "32"), None)
        ref171 = next((r for r in allowed_refs if r.article == "171"), None)
        refs: list[GenerationNormativeRef] = []
        for ref in (ref171, ref32):
            if ref:
                refs.append(
                    GenerationNormativeRef(
                        document_code=ref.document_code,
                        document_name=ref.document_name,
                        version=ref.version,
                        article=ref.article,
                        article_title=ref.article_title,
                        effective_from=ref.effective_from,
                        source_chunk_id=ref.source_chunk_id,
                    )
                )

        fact_ids = [f.fact_id for f in facts]
        top_facts = [f.text for f in facts[:3]]
        fact_blob = " ".join(f.text.lower() for f in facts)
        has_absences = any(
            key in fact_blob for key in ("ausencia", "ausencias", "inasistencia")
        ) and "sin registros de asistencia" not in fact_blob
        has_low_grades = any(
            f.source in {"grades", "grades_by_subject"} and "/10" in f.text for f in facts
        )
        has_alerts = any(f.source == "alert_activa" for f in facts)

        situation = (
            f"Estudiante de {course_name} con riesgo institucional {risk}. "
            f"Constan {len(facts)} hechos en el expediente. "
            "Se requieren entrevistas para precisar causas; el detalle documental aparece "
            "en la sección de hechos registrados."
        )
        opening = case.opening_summary or (
            f"Caso «{case.title}» abierto para valoración DECE con base en semáforo {risk}, "
            "registros académicos/de asistencia y alertas activas disponibles."
        )

        actions: list[GenerationAction] = [
            GenerationAction(
                title="Entrevistar al estudiante",
                objective=(
                    "Conocer la perspectiva del estudiante e identificar factores "
                    "relacionados con los hechos registrados."
                ),
                case_dimension="socioemocional",
                responsible_role="dece",
                due_hint="3 días lectivos",
                priority=1,
                rationale=f"Hechos base: {top_facts[0] if top_facts else 'semáforo institucional'}.",
                expected_result="Registro de entrevista con causas preliminares y acuerdos.",
                success_indicator="Entrevista realizada y registrada en el expediente.",
                evidence_required=True,
                source_fact_ids=fact_ids[:2],
            ),
            GenerationAction(
                title="Convocar al representante",
                objective="Informar la situación y establecer compromisos de acompañamiento.",
                case_dimension="familiar",
                responsible_role="dece",
                supporting_roles=["tutor"],
                due_hint="5 días lectivos",
                priority=2,
                rationale="Corresponsabilidad familiar ante riesgo institucional registrado.",
                expected_result="Representante informado y acuerdos documentados.",
                success_indicator="Reunión o intento de contacto documentado.",
                evidence_required=True,
            ),
        ]
        priority = 3
        if has_low_grades or has_alerts:
            actions.append(
                GenerationAction(
                    title="Elaborar estrategia de refuerzo pedagógico",
                    objective="Definir recuperación en materias con mayor afectación según promedios registrados.",
                    case_dimension="academica",
                    responsible_role="docente",
                    supporting_roles=["tutor", "dece"],
                    due_hint="7 días lectivos",
                    priority=priority,
                    rationale="Constan indicadores académicos/alertas que justifican refuerzo.",
                    expected_result="Estrategia de refuerzo con actividades, responsables y fechas.",
                    success_indicator="Plan de refuerzo registrado y comunicado.",
                    evidence_required=True,
                    normative_hint="Art. 32 RGLOEI-DE-675 (refuerzo pedagógico)" if ref32 else None,
                )
            )
            priority += 1
        if has_absences:
            actions.append(
                GenerationAction(
                    title="Realizar seguimiento semanal de asistencia",
                    objective="Verificar si las inasistencias registradas disminuyen tras las intervenciones.",
                    case_dimension="asistencia",
                    responsible_role="tutor",
                    supporting_roles=["dece"],
                    due_hint="4 semanas (seguimiento semanal)",
                    priority=priority,
                    evidence_required=True,
                    expected_result="Reducción de inasistencias injustificadas.",
                    success_indicator="Registro semanal de asistencia y novedades.",
                    rationale="Hay ausencias/tardanzas en el expediente de 30 días.",
                    normative_hint="Art. 171 RGLOEI-DE-675 (inasistencias)" if ref171 else None,
                )
            )
            priority += 1
        actions.append(
            GenerationAction(
                title="Reevaluar el nivel de riesgo",
                objective=(
                    "Determinar si las medidas generaron mejora o si corresponde reformular, "
                    "derivar o revisar protocolo."
                ),
                case_dimension="institucional",
                responsible_role="dece",
                due_hint="15 días lectivos",
                priority=priority,
                evidence_required=True,
                expected_result="Evaluación documentada del avance del plan.",
                success_indicator="Acta de reevaluación con indicadores revisados.",
                rationale=f"Cierre de ciclo partiendo del riesgo actual ({risk}).",
            )
        )

        return ActionPlanGeneration(
            draft_origin="local_fallback",
            context_course=course_name,
            context_risk=risk,
            triage=GenerationTriage(
                routine_plan_allowed=suggestion.routine_plan_allowed,
                protocol_review_required=suggestion.protocol_review_required,
                protocol_type=suggestion.protocol_type,
                urgency=suggestion.urgency
                if suggestion.urgency in {"normal", "high", "critical"}
                else "normal",
                flags=suggestion.flags,
                reasons=suggestion.reasons,
                professional_confirmation_required=["triage_flags", "hechos", "fechas"],
                immediate_integrity_risk="No identificado en los registros disponibles",
                violence_presumption="Sin evidencia registrada",
                self_harm_risk="Sin evidencia registrada",
                rights_violation="Requiere entrevista y verificación profesional",
                repeated_absences="Confirmado en registros de 30 días"
                if has_absences
                else "No confirmado en registros de asistencia recientes",
                urgent_protocol_needed="Sí — revisión requerida"
                if suggestion.protocol_review_required
                else "No confirmada actualmente",
            ),
            assessment=GenerationAssessment(
                situation_summary=situation,
                opening_reason=opening,
                facts=facts,
                inferences=[
                    InferenceItem(
                        text="Se requiere confirmación profesional antes de atribuir causas",
                        based_on_fact_ids=fact_ids[:3],
                    )
                ],
                protective_factors=[
                    f"Estudiante matriculado en {course_name}",
                    "Existe estructura de tutor/DECE para acompañamiento",
                    "No se registra protocolo urgente activado en este borrador",
                ],
                risk_factors=[
                    *[
                        f.text
                        for f in facts
                        if f.source
                        in {"student_risk", "attendance", "alert_activa", "grades", "grades_by_subject"}
                    ][:5],
                    "Falta de entrevista reciente que explique el origen de la situación",
                ],
                missing_information=[
                    "Perspectiva del estudiante",
                    "Información actualizada del representante",
                    "Situación familiar / salud / transporte / economía",
                    "Medidas pedagógicas previas no tipificadas en el expediente",
                ],
            ),
            plan=GenerationPlan(
                general_objective=(
                    "Atender los hechos institucionales registrados para este estudiante, "
                    "coordinar apoyos y favorecer la continuidad educativa en las próximas cuatro semanas."
                ),
                limitations=[
                    "El borrador se basa solo en registros disponibles al momento de generar",
                    "No sustituye entrevista ni valoración profesional presencial",
                    "No representa un diagnóstico psicológico o clínico",
                    "Las referencias normativas deben verificarse antes de aprobar",
                ],
                review_criteria=(
                    "Revisar evolución de los mismos indicadores que originaron el caso "
                    "(asistencia, promedios, alertas) y cumplimiento de acciones."
                ),
                review_at_hint="15 días lectivos",
                review_triggers=[
                    "Aumento de inasistencias",
                    "Nueva alerta activa",
                    "Indicadores de violencia o vulneración de derechos",
                    "Falta reiterada de contacto con el representante",
                    "Incumplimiento de acciones prioritarias",
                ],
            ),
            actions=actions,
            normative_references=refs,
        )
