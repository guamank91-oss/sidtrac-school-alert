from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.action_plans.infrastructure.models import (
    ActionPlanEvidenceModel,
    ActionPlanItemModel,
    ActionPlanModel,
    ActionPlanNormativeRefModel,
    ActionPlanNoteModel,
)
from app.modules.action_plans.schemas import (
    ActionPlanCreate,
    ActionPlanOut,
    EvidenceCreate,
    ItemProgressRequest,
    ItemStatusUpdate,
    ItemValidateRequest,
    PlanApproveRequest,
    PlanItemOut,
    PlanNoteCreate,
)
from app.modules.audit.application.service import record_audit
from app.modules.cases.infrastructure.models import DeceCaseModel
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.shared.feature_flags import action_plans_enabled
from app.shared.permissions import CASE_VIEW_PROFESSIONAL, has_capability, require_capability
from app.shared.tenant import assert_same_institution


class ActionPlanService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _ensure(self) -> None:
        if not action_plans_enabled():
            raise ForbiddenError("FEATURE_ACTION_PLANS is disabled")

    async def create_draft(self, user: CurrentUser, data: ActionPlanCreate) -> ActionPlanOut:
        self._ensure()
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        case = await self.session.get(DeceCaseModel, data.case_id)
        if case is None:
            raise NotFoundError("Case")
        assert_same_institution(user, case.institution_id)

        # version: max existing for (case, plan_type) + 1 among non-superseded drafts/active
        existing = await self.session.execute(
            select(ActionPlanModel)
            .where(
                ActionPlanModel.case_id == case.id,
                ActionPlanModel.plan_type == data.plan_type,
            )
            .order_by(ActionPlanModel.version.desc())
            .limit(1)
        )
        latest = existing.scalar_one_or_none()
        version = (latest.version + 1) if latest else 1

        plan = ActionPlanModel(
            institution_id=case.institution_id,
            case_id=case.id,
            plan_type=data.plan_type,
            version=version,
            status="draft",
            general_objective=data.general_objective,
            limitations=data.limitations,
            review_criteria=data.review_criteria,
            approval_mode="dece_only",
            created_by=user.id,
        )
        self.session.add(plan)
        await self.session.flush()
        for item in data.items:
            self.session.add(
                ActionPlanItemModel(
                    plan_id=plan.id,
                    title=item.title,
                    objective=item.objective,
                    responsible_role=item.responsible_role,
                    assignee_user_id=item.assignee_user_id,
                    due_hint=item.due_hint,
                    evidence_required=item.evidence_required,
                    priority=item.priority,
                    confidentiality_level=item.confidentiality_level,
                    case_dimension=item.case_dimension,
                    dece_axis=item.dece_axis,
                    status="pending",
                )
            )
        for ref in data.normative_references:
            self.session.add(
                ActionPlanNormativeRefModel(
                    plan_id=plan.id,
                    article_id=ref.article_id,
                    document_code=ref.document_code,
                    version=ref.version,
                    article=ref.article,
                    article_title=ref.article_title,
                    effective_from=ref.effective_from,
                    source_chunk_id=ref.source_chunk_id,
                )
            )
        await record_audit(
            self.session,
            user_id=user.id,
            institution_id=plan.institution_id,
            scope_type="institution",
            action="action_plan_created",
            entity_type="action_plan",
            entity_id=plan.id,
            categories='["action_plan"]',
        )
        await self.session.commit()
        return await self.get_plan(user, plan.id)

    async def submit(self, user: CurrentUser, plan_id: int) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        if plan.status != "draft":
            raise ValidationError("Only draft plans can be submitted")
        plan.status = "pending_approval"
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def approve(self, user: CurrentUser, plan_id: int, data: PlanApproveRequest) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        if plan.approval_mode != "dece_only":
            raise ValidationError("Unsupported approval mode")
        if plan.status != "pending_approval":
            raise ValidationError("Plan is not pending approval")
        # deactivate other active plans of same type on case
        others = await self.session.execute(
            select(ActionPlanModel).where(
                ActionPlanModel.case_id == plan.case_id,
                ActionPlanModel.plan_type == plan.plan_type,
                ActionPlanModel.status == "active",
                ActionPlanModel.id != plan.id,
            )
        )
        for old in others.scalars().all():
            old.status = "superseded"
            plan.supersedes_plan_id = plan.supersedes_plan_id or old.id
        plan.status = "active"
        plan.approved_by = user.id
        plan.approved_at = datetime.now(timezone.utc)
        plan.approval_comment = data.comment
        await record_audit(
            self.session,
            user_id=user.id,
            institution_id=plan.institution_id,
            scope_type="institution",
            action="action_plan_approved",
            entity_type="action_plan",
            entity_id=plan.id,
            categories='["action_plan"]',
        )
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def report_progress(
        self, user: CurrentUser, plan_id: int, item_id: int, data: ItemProgressRequest
    ) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        item = await self._get_item(plan, item_id)
        if not self._can_report(user, item):
            raise ForbiddenError("Cannot report progress on this action")
        if item.status not in {"pending", "in_progress", "reported_completed"}:
            raise ValidationError("Invalid item status for progress")
        item.status = "reported_completed"
        if data.note:
            self.session.add(
                ActionPlanNoteModel(
                    plan_id=plan.id,
                    author_id=user.id,
                    visibility_scope="professional",
                    text=data.note,
                )
            )
        await record_audit(
            self.session,
            user_id=user.id,
            institution_id=plan.institution_id,
            scope_type="institution",
            action="action_item_reported_completed",
            entity_type="action_plan_item",
            entity_id=item.id,
            categories='["action_plan"]',
        )
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def validate_item(
        self, user: CurrentUser, plan_id: int, item_id: int, data: ItemValidateRequest
    ) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        item = await self._get_item(plan, item_id)
        if item.status != "reported_completed":
            raise ValidationError("Item must be reported_completed before validation")
        if data.approved:
            item.status = "validated"
            item.progress_pct_validated = 100
        else:
            item.status = "in_progress"
            item.progress_pct_validated = 0
        await record_audit(
            self.session,
            user_id=user.id,
            institution_id=plan.institution_id,
            scope_type="institution",
            action="action_item_validated" if data.approved else "action_item_validation_rejected",
            entity_type="action_plan_item",
            entity_id=item.id,
            categories='["action_plan"]',
            reason=data.comment,
        )
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def add_note(self, user: CurrentUser, plan_id: int, data: PlanNoteCreate) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        if data.visibility_scope == "dece_only" and not has_capability(user, CASE_VIEW_PROFESSIONAL):
            raise ForbiddenError("Cannot write dece_only notes")
        self.session.add(
            ActionPlanNoteModel(
                plan_id=plan.id,
                author_id=user.id,
                visibility_scope=data.visibility_scope,
                text=data.text,
            )
        )
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def register_evidence(
        self, user: CurrentUser, plan_id: int, data: EvidenceCreate
    ) -> ActionPlanOut:
        """Metadata-only evidence registration (no blob). Storage abstracted."""
        plan = await self._get_plan(user, plan_id)
        require_capability(user, CASE_VIEW_PROFESSIONAL)
        allowed_mime = {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        if data.mime_type not in allowed_mime:
            raise ValidationError("Unsupported evidence MIME type")
        if data.size_bytes > 15 * 1024 * 1024:
            raise ValidationError("Evidence too large")
        self.session.add(
            ActionPlanEvidenceModel(
                plan_id=plan.id,
                item_id=data.item_id,
                institution_id=plan.institution_id,
                storage_backend=data.storage_backend,
                object_key=data.object_key,
                filename=data.filename,
                mime_type=data.mime_type,
                size_bytes=data.size_bytes,
                checksum_sha256=data.checksum_sha256,
                confidentiality_level=data.confidentiality_level,
                uploaded_by=user.id,
            )
        )
        await self.session.commit()
        return await self.get_plan(user, plan_id)

    async def get_plan(self, user: CurrentUser, plan_id: int) -> ActionPlanOut:
        plan = await self._get_plan(user, plan_id)
        items = await self._items_for_view(user, plan)
        validated = [i for i in items if i.status == "validated"]
        pct = int(round(100 * len(validated) / len(items))) if items else 0
        return ActionPlanOut(
            id=plan.id,
            case_id=plan.case_id,
            institution_id=plan.institution_id,
            plan_type=plan.plan_type,
            version=plan.version,
            status=plan.status,
            general_objective=plan.general_objective
            if has_capability(user, CASE_VIEW_PROFESSIONAL)
            else (plan.general_objective[:80] + "…"),
            items=items,
            validated_progress_pct=pct,
        )

    async def get_active_for_case(self, user: CurrentUser, case_id: int) -> ActionPlanOut | None:
        self._ensure()
        case = await self.session.get(DeceCaseModel, case_id)
        if case is None:
            raise NotFoundError("Case")
        assert_same_institution(user, case.institution_id)
        result = await self.session.execute(
            select(ActionPlanModel)
            .where(ActionPlanModel.case_id == case_id, ActionPlanModel.status == "active")
            .order_by(ActionPlanModel.version.desc())
            .limit(1)
        )
        plan = result.scalar_one_or_none()
        if plan is None:
            return None
        return await self.get_plan(user, plan.id)

    async def _get_plan(self, user: CurrentUser, plan_id: int) -> ActionPlanModel:
        self._ensure()
        plan = await self.session.get(ActionPlanModel, plan_id)
        if plan is None:
            raise NotFoundError("Action plan")
        assert_same_institution(user, plan.institution_id)
        return plan

    async def _get_item(self, plan: ActionPlanModel, item_id: int) -> ActionPlanItemModel:
        item = await self.session.get(ActionPlanItemModel, item_id)
        if item is None or item.plan_id != plan.id:
            raise NotFoundError("Action item")
        return item

    def _can_report(self, user: CurrentUser, item: ActionPlanItemModel) -> bool:
        if has_capability(user, CASE_VIEW_PROFESSIONAL):
            return True
        if item.assignee_user_id == user.id:
            return True
        if item.responsible_role == user.active_role.value:
            return True
        return False

    async def _items_for_view(self, user: CurrentUser, plan: ActionPlanModel) -> list[PlanItemOut]:
        result = await self.session.execute(
            select(ActionPlanItemModel)
            .where(ActionPlanItemModel.plan_id == plan.id)
            .order_by(ActionPlanItemModel.priority, ActionPlanItemModel.id)
        )
        items = list(result.scalars().all())
        professional = has_capability(user, CASE_VIEW_PROFESSIONAL)
        out: list[PlanItemOut] = []
        for item in items:
            if not professional and not self._can_report(user, item):
                continue
            out.append(
                PlanItemOut(
                    id=item.id,
                    title=item.title,
                    objective=item.objective if professional else item.title,
                    status=item.status,
                    responsible_role=item.responsible_role,
                    assignee_user_id=item.assignee_user_id,
                    due_hint=item.due_hint,
                    evidence_required=item.evidence_required,
                    priority=item.priority,
                )
            )
        return out
