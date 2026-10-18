from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.audit.application.service import record_audit
from app.modules.cases.application.triage_rules import suggest_triage
from app.modules.cases.infrastructure.models import (
    CaseTriageModel,
    DeceCaseAlertModel,
    DeceCaseModel,
    ExternalReferralModel,
    ProtocolActivationModel,
)
from app.modules.cases.schemas import (
    CaseCreate,
    CaseResponse,
    ProtocolCreate,
    ProtocolResponse,
    ProtocolStatusUpdate,
    ReferralCreate,
    ReferralResponse,
    TriageConfirmRequest,
    TriageResponse,
    TriageSuggestionResponse,
)
from app.modules.students.infrastructure.models import StudentModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import RiskLevel, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.permissions import (
    CASE_VIEW_PROFESSIONAL,
    has_capability,
    require_capability,
    require_dece_cases_enabled,
)
from app.shared.tenant import assert_same_institution


class CaseService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _ensure_module(self) -> None:
        require_dece_cases_enabled()

    async def create_case(self, current_user: CurrentUser, data: CaseCreate) -> CaseResponse:
        self._ensure_module()
        if current_user.active_role not in {UserRole.DECE, UserRole.ADMINISTRADOR}:
            raise ForbiddenError("Only DECE or admin can open cases")
        # Opening a case is institutional write; professional view still gated later.
        student = await self.session.get(StudentModel, data.student_id)
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        case = DeceCaseModel(
            institution_id=student.institution_id,
            student_id=student.id,
            status="pending_triage",
            title=data.title,
            opening_summary=data.opening_summary,
            opened_by=current_user.id,
        )
        self.session.add(case)
        await self.session.flush()

        for alert_id in data.alert_ids:
            alert = await self.session.get(AlertModel, alert_id)
            if alert is None:
                raise NotFoundError("Alert")
            assert_same_institution(current_user, alert.institution_id)
            if alert.student_id != student.id:
                raise ValidationError("Alert does not belong to this student")
            self.session.add(DeceCaseAlertModel(case_id=case.id, alert_id=alert_id))

        suggestion = await self._build_suggestion(case)
        triage = CaseTriageModel(
            case_id=case.id,
            institution_id=case.institution_id,
            routine_plan_allowed=suggestion.routine_plan_allowed,
            protocol_review_required=suggestion.protocol_review_required,
            protocol_type=suggestion.protocol_type,
            urgency=suggestion.urgency,
            flags_json=json.dumps(suggestion.flags),
            reasons_json=json.dumps(suggestion.reasons),
            professional_confirmed=False,
        )
        self.session.add(triage)
        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=case.institution_id,
            scope_type="institution",
            action="case_created",
            entity_type="dece_case",
            entity_id=case.id,
            detail=f"Caso creado estudiante {student.id}",
            categories='["case"]',
        )
        await self.session.commit()
        return await self.get_case(current_user, case.id)

    async def list_cases(
        self, current_user: CurrentUser, student_id: Optional[int] = None
    ) -> list[CaseResponse]:
        self._ensure_module()
        query = select(DeceCaseModel).where(
            DeceCaseModel.institution_id == current_user.institution_id,
            DeceCaseModel.deleted_at.is_(None),
        )
        if student_id is not None:
            query = query.where(DeceCaseModel.student_id == student_id)
        result = await self.session.execute(query.order_by(DeceCaseModel.created_at.desc()))
        return [await self._to_response(current_user, c) for c in result.scalars().all()]

    async def get_case(self, current_user: CurrentUser, case_id: int) -> CaseResponse:
        self._ensure_module()
        case = await self._get_case(current_user, case_id)
        return await self._to_response(current_user, case)

    async def confirm_triage(
        self, current_user: CurrentUser, case_id: int, data: TriageConfirmRequest
    ) -> CaseResponse:
        self._ensure_module()
        require_capability(current_user, CASE_VIEW_PROFESSIONAL)
        case = await self._get_case(current_user, case_id)
        triage = await self._latest_triage(case.id)
        if triage is None:
            raise NotFoundError("Triage")
        if not data.confirm:
            raise ValidationError("Professional confirmation required")

        triage.routine_plan_allowed = data.routine_plan_allowed
        triage.protocol_review_required = data.protocol_review_required
        triage.protocol_type = data.protocol_type
        triage.urgency = data.urgency
        triage.reasons_json = json.dumps(data.reasons)
        triage.professional_confirmed = True
        triage.confirmed_by = current_user.id
        triage.confirmed_at = datetime.now(timezone.utc)
        triage.outcome = data.outcome

        if data.outcome == "discarded":
            case.status = "discarded"
        elif data.outcome == "attended_without_case":
            case.status = "attended_without_case"
        elif data.outcome in {"converted_to_case", "open"}:
            case.status = "open"
        elif data.outcome == "under_assessment":
            case.status = "under_assessment"
        else:
            raise ValidationError("Invalid triage outcome")

        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=case.institution_id,
            scope_type="institution",
            action="case_triage_confirmed",
            entity_type="dece_case",
            entity_id=case.id,
            detail=f"Triage confirmado outcome={data.outcome}",
            categories='["case","triage"]',
        )
        await self.session.commit()
        return await self.get_case(current_user, case.id)

    async def create_protocol(
        self, current_user: CurrentUser, case_id: int, data: ProtocolCreate
    ) -> ProtocolResponse:
        self._ensure_module()
        case = await self._get_case(current_user, case_id)
        student_id = data.student_id or case.student_id
        if student_id != case.student_id:
            raise ValidationError("Protocol student must match case student")
        proto = ProtocolActivationModel(
            institution_id=case.institution_id,
            student_id=student_id,
            case_id=case.id,
            protocol_type=data.protocol_type,
            status="reported",
            reported_by=current_user.id,
            reason=data.reason,
        )
        self.session.add(proto)
        await self.session.commit()
        await self.session.refresh(proto)
        return self._protocol_response(proto)

    async def update_protocol_status(
        self, current_user: CurrentUser, protocol_id: int, data: ProtocolStatusUpdate
    ) -> ProtocolResponse:
        self._ensure_module()
        proto = await self.session.get(ProtocolActivationModel, protocol_id)
        if proto is None:
            raise NotFoundError("Protocol")
        assert_same_institution(current_user, proto.institution_id)
        allowed = {
            "reported",
            "under_review",
            "confirmed",
            "activated",
            "closed",
            "discarded",
        }
        if data.status not in allowed:
            raise ValidationError("Invalid protocol status")
        if data.status in {"confirmed", "activated"} and current_user.active_role not in {
            UserRole.DECE,
            UserRole.ADMINISTRADOR,
        }:
            raise ForbiddenError("Only DECE/admin can confirm or activate protocols")
        proto.status = data.status
        if data.status == "activated":
            proto.activated_by = current_user.id
        proto.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(proto)
        return self._protocol_response(proto)

    async def create_referral(
        self, current_user: CurrentUser, case_id: int, data: ReferralCreate
    ) -> ReferralResponse:
        self._ensure_module()
        require_capability(current_user, CASE_VIEW_PROFESSIONAL)
        case = await self._get_case(current_user, case_id)
        ref = ExternalReferralModel(
            institution_id=case.institution_id,
            case_id=case.id,
            destination=data.destination,
            reason=data.reason,
            registered_by=current_user.id,
            referral_date=data.referral_date,
            notes=data.notes,
        )
        self.session.add(ref)
        await self.session.commit()
        await self.session.refresh(ref)
        return ReferralResponse(
            id=ref.id,
            case_id=ref.case_id,
            destination=ref.destination,
            reason=ref.reason,
            registered_by=ref.registered_by,
            referral_date=ref.referral_date,
            notes=ref.notes,
        )

    async def soft_delete_case(
        self,
        current_user: CurrentUser,
        case_id: int,
        *,
        reason: str = "Eliminado desde Perfil 360",
    ) -> CaseResponse:
        """Soft-delete a DECE case and discard linked draft/pending/active plans."""
        self._ensure_module()
        require_capability(current_user, CASE_VIEW_PROFESSIONAL)
        case = await self._get_case(current_user, case_id)
        if case.legal_hold:
            raise ValidationError("Este caso está en retención legal y no se puede eliminar")

        now = datetime.now(timezone.utc)
        case.deleted_at = now
        case.deletion_reason = reason
        case.status = "discarded"
        case.closed_at = now
        case.updated_at = now

        # Discard linked plans so nothing remains "active" for the student.
        from app.modules.action_plans.infrastructure.models import ActionPlanModel

        plans = await self.session.execute(
            select(ActionPlanModel).where(
                ActionPlanModel.case_id == case.id,
                ActionPlanModel.status.in_(("draft", "pending_approval", "active")),
            )
        )
        for plan in plans.scalars().all():
            plan.status = "discarded"

        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=case.institution_id,
            scope_type="institution",
            action="case_soft_deleted",
            entity_type="dece_case",
            entity_id=case.id,
            detail=reason,
            categories='["case"]',
        )
        await self.session.commit()
        # Return snapshot before list filters hide deleted cases
        return CaseResponse(
            id=case.id,
            institution_id=case.institution_id,
            student_id=case.student_id,
            status=case.status,
            title=case.title,
            opening_summary=case.opening_summary,
            opened_by=case.opened_by,
            alert_ids=[],
            triage=None,
            created_at=case.created_at,
            professional_view=True,
        )

    async def _get_case(self, current_user: CurrentUser, case_id: int) -> DeceCaseModel:
        case = await self.session.get(DeceCaseModel, case_id)
        if case is None or case.deleted_at is not None:
            raise NotFoundError("Case")
        assert_same_institution(current_user, case.institution_id)
        return case

    async def _latest_triage(self, case_id: int) -> CaseTriageModel | None:
        result = await self.session.execute(
            select(CaseTriageModel)
            .where(CaseTriageModel.case_id == case_id)
            .order_by(CaseTriageModel.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _build_suggestion(self, case: DeceCaseModel):
        student = await self.session.get(StudentModel, case.student_id)
        alert_ids = await self.session.execute(
            select(DeceCaseAlertModel.alert_id).where(DeceCaseAlertModel.case_id == case.id)
        )
        ids = [r[0] for r in alert_ids.all()]
        levels: list[RiskLevel] = []
        types: list[str] = []
        if ids:
            alerts = await self.session.execute(select(AlertModel).where(AlertModel.id.in_(ids)))
            for alert in alerts.scalars().all():
                levels.append(alert.level)
                types.append(alert.alert_type.value if hasattr(alert.alert_type, "value") else str(alert.alert_type))
        return suggest_triage(
            student_risk=student.current_risk_level if student else RiskLevel.BAJO,
            alert_levels=levels,
            alert_types=types,
        )

    async def _to_response(self, current_user: CurrentUser, case: DeceCaseModel) -> CaseResponse:
        professional = has_capability(current_user, CASE_VIEW_PROFESSIONAL)
        alert_rows = await self.session.execute(
            select(DeceCaseAlertModel.alert_id).where(DeceCaseAlertModel.case_id == case.id)
        )
        alert_ids = [r[0] for r in alert_rows.all()]
        triage_model = await self._latest_triage(case.id)
        triage = None
        if triage_model is not None:
            suggestion = None
            if professional:
                suggestion = TriageSuggestionResponse(
                    routine_plan_allowed=triage_model.routine_plan_allowed,
                    protocol_review_required=triage_model.protocol_review_required,
                    protocol_type=triage_model.protocol_type,
                    urgency=triage_model.urgency,
                    flags=json.loads(triage_model.flags_json or "[]"),
                    reasons=json.loads(triage_model.reasons_json or "[]"),
                )
            triage = TriageResponse(
                id=triage_model.id,
                case_id=case.id,
                routine_plan_allowed=triage_model.routine_plan_allowed if professional else True,
                protocol_review_required=(
                    triage_model.protocol_review_required if professional else False
                ),
                protocol_type=triage_model.protocol_type if professional else None,
                urgency=triage_model.urgency if professional else "normal",
                professional_confirmed=triage_model.professional_confirmed,
                outcome=triage_model.outcome if professional else None,
                suggestion=suggestion,
            )
        return CaseResponse(
            id=case.id,
            institution_id=case.institution_id,
            student_id=case.student_id,
            status=case.status,
            title=case.title,
            opening_summary=case.opening_summary if professional else None,
            opened_by=case.opened_by,
            alert_ids=alert_ids,
            triage=triage,
            created_at=case.created_at,
            professional_view=professional,
        )

    def _protocol_response(self, proto: ProtocolActivationModel) -> ProtocolResponse:
        return ProtocolResponse(
            id=proto.id,
            institution_id=proto.institution_id,
            student_id=proto.student_id,
            case_id=proto.case_id,
            protocol_type=proto.protocol_type,
            status=proto.status,
            reason=proto.reason,
            reported_by=proto.reported_by,
            activated_by=proto.activated_by,
        )
