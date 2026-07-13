from __future__ import annotations

import json
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.cases.application.triage_rules import suggest_triage
from app.modules.cases.infrastructure.models import DeceCaseAlertModel, DeceCaseModel
from app.modules.normative.application.service import NormativeService
from app.modules.normative.seed_data import DOCUMENT_CODE
from app.modules.rag.application.openrouter import AI_PROVIDER_DISABLED, chat_completion
from app.modules.students.infrastructure.models import StudentModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import RiskLevel
from app.shared.exceptions import DomainError, NotFoundError
from app.shared.feature_flags import action_plans_enabled
from app.shared.exceptions import ForbiddenError
from app.shared.permissions import CASE_VIEW_PROFESSIONAL, require_capability
from app.shared.privacy.minimization import make_student_ref
from app.shared.tenant import assert_same_institution


SYSTEM_GENERATE = """Eres asistente DECE. Responde SOLO JSON válido según el esquema pedido.
No inventes artículos normativos fuera de la lista permitida.
No uses nombres reales ni cédulas; usa student_ref.
No emitas diagnósticos clínicos."""


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
        alert_rows = await self.session.execute(
            select(AlertModel)
            .join(DeceCaseAlertModel, DeceCaseAlertModel.alert_id == AlertModel.id)
            .where(DeceCaseAlertModel.case_id == case.id)
        )
        alerts = list(alert_rows.scalars().all())
        suggestion = suggest_triage(
            student_risk=student.current_risk_level,
            alert_levels=[a.level for a in alerts],
            alert_types=[a.alert_type.value for a in alerts],
        )

        facts = [
            FactItem(
                fact_id=f"risk_{student.current_risk_level.value}",
                text=f"Semáforo institucional: {student.current_risk_level.value}",
                source="student_risk",
                date=None,
            )
        ]
        for alert in alerts[:5]:
            facts.append(
                FactItem(
                    fact_id=f"alert_{alert.id}",
                    text=f"Alerta {alert.alert_type.value} nivel {alert.level.value}",
                    source="alert",
                    date=None,
                )
            )

        allowed_refs = await NormativeService(self.session).list_articles(
            code=DOCUMENT_CODE, current_only=True
        )
        allowed_chunk_ids = {r.source_chunk_id for r in allowed_refs}

        minimized_payload = {
            "student_ref": student_ref,
            "risk_level": student.current_risk_level.value,
            "facts": [f.model_dump(mode="json") for f in facts],
            "triage_hint": {
                "routine_plan_allowed": suggestion.routine_plan_allowed,
                "protocol_review_required": suggestion.protocol_review_required,
                "protocol_type": suggestion.protocol_type,
                "urgency": suggestion.urgency,
                "flags": suggestion.flags,
                "reasons": suggestion.reasons,
            },
            "allowed_normative_chunk_ids": sorted(allowed_chunk_ids),
            "focus": data.question_focus,
        }

        messages = [
            {"role": "system", "content": SYSTEM_GENERATE},
            {
                "role": "user",
                "content": (
                    "Genera un borrador de plan de atención en JSON estricto con claves "
                    "triage, assessment, plan, actions, normative_references. "
                    f"Contexto minimizado:\n{json.dumps(minimized_payload, ensure_ascii=False)}"
                ),
            },
        ]
        content, _tokens, error = await chat_completion(messages, temperature=0.1, max_tokens=2000)
        if error == AI_PROVIDER_DISABLED:
            raise DomainError(
                "El proveedor de IA está deshabilitado",
                code=AI_PROVIDER_DISABLED,
            )
        if content:
            try:
                raw = json.loads(content)
                draft = ActionPlanGeneration.model_validate(raw)
                draft.normative_references = [
                    r
                    for r in draft.normative_references
                    if r.source_chunk_id in allowed_chunk_ids
                ]
                return draft
            except Exception:
                pass

        # Deterministic fallback when provider fails or returns invalid JSON (not when disabled).
        return self._local_draft(suggestion, facts, allowed_refs, student_ref)

    def _local_draft(self, suggestion, facts, allowed_refs, student_ref: str) -> ActionPlanGeneration:
        ref32 = next((r for r in allowed_refs if r.article == "32"), None)
        refs: list[GenerationNormativeRef] = []
        if ref32:
            refs.append(
                GenerationNormativeRef(
                    document_code=ref32.document_code,
                    document_name=ref32.document_name,
                    version=ref32.version,
                    article=ref32.article,
                    article_title=ref32.article_title,
                    effective_from=ref32.effective_from,
                    source_chunk_id=ref32.source_chunk_id,
                )
            )
        return ActionPlanGeneration(
            triage=GenerationTriage(
                routine_plan_allowed=suggestion.routine_plan_allowed,
                protocol_review_required=suggestion.protocol_review_required,
                protocol_type=suggestion.protocol_type,
                urgency=suggestion.urgency if suggestion.urgency in {"normal", "high", "critical"} else "normal",
                flags=suggestion.flags,
                reasons=suggestion.reasons,
                professional_confirmation_required=["triage_flags"],
            ),
            assessment=GenerationAssessment(
                situation_summary=f"Borrador local para {student_ref}",
                facts=facts,
                inferences=[
                    InferenceItem(
                        text="Se requiere seguimiento profesional confirmado",
                        based_on_fact_ids=[facts[0].fact_id] if facts else [],
                    )
                ],
                protective_factors=[],
                risk_factors=[f.text for f in facts],
                missing_information=["Perspectiva familiar", "Contexto de aula"],
            ),
            plan=GenerationPlan(
                general_objective="Estabilizar trayectoria educativa y bienestar",
                limitations=["Borrador no aprobado", "Requiere confirmación DECE"],
                review_criteria="Revisión en 15 días lectivos",
            ),
            actions=[
                GenerationAction(
                    title="Entrevista de seguimiento DECE",
                    objective="Recoger hechos y factores de protección",
                    source_fact_ids=[facts[0].fact_id] if facts else [],
                    due_hint="7 días",
                    priority=1,
                ),
                GenerationAction(
                    title="Coordinación con tutor",
                    objective="Alinear observación en aula",
                    responsible_role="tutor",
                    case_dimension="behavioral",
                    due_hint="10 días",
                    priority=2,
                    evidence_required=False,
                ),
            ],
            normative_references=refs,
        )
