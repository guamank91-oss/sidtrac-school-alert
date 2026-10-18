from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.action_plans.application.service import ActionPlanService
from app.modules.action_plans.schemas import (
    ActionPlanCreate,
    ActionPlanOut,
    EvidenceCreate,
    ItemProgressRequest,
    ItemValidateRequest,
    PlanApproveRequest,
    PlanNoteCreate,
)
from app.modules.action_plans.generation_schema import ActionPlanGeneration, GenerateRequest
from app.modules.action_plans.application.generate import PlanGenerationService
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, ForbiddenError, NotFoundError, http_status_for
from app.modules.action_plans.infrastructure.models import ActionPlanItemModel
from app.modules.cases.infrastructure.models import DeceCaseModel
from app.modules.students.infrastructure.models import StudentModel
from sqlalchemy import select

router = APIRouter()

PlanStaff = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE, UserRole.TUTOR, UserRole.DOCENTE))
PlanFamily = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.DOCENTE,
        UserRole.REPRESENTANTE,
    )
)
PlanPro = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("/by-student/{student_id}/active", response_model=Optional[ActionPlanOut])
async def get_active_plan_for_student(
    student_id: int,
    current_user: CurrentUser = PlanFamily,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).get_active_for_student(current_user, student_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/by-case/{case_id}/active", response_model=Optional[ActionPlanOut])
async def get_active_plan_for_case(
    case_id: int,
    current_user: CurrentUser = PlanStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).get_active_for_case(current_user, case_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/{plan_id}/shared-summary")
async def shared_commitment_summary(
    plan_id: int,
    current_user: CurrentUser = PlanFamily,
    session: AsyncSession = Depends(get_db),
):
    """Family/student-safe summary fields only (no confidential notes)."""
    try:
        service = ActionPlanService(session)
        plan_model = await service._get_plan(current_user, plan_id)
        if current_user.active_role == UserRole.REPRESENTANTE:
            case = await session.get(DeceCaseModel, plan_model.case_id)
            if case is None:
                raise NotFoundError("Case")
            student = await session.get(StudentModel, case.student_id)
            if student is None or student.guardian_id != current_user.id:
                raise ForbiddenError("Solo puede ver compromisos de sus representados")

        items = await session.execute(
            select(ActionPlanItemModel)
            .where(ActionPlanItemModel.plan_id == plan_model.id)
            .order_by(ActionPlanItemModel.priority, ActionPlanItemModel.id)
        )
        public_items = [
            {"title": i.title, "status": i.status, "due_hint": i.due_hint}
            for i in items.scalars().all()
            if i.status in {"pending", "in_progress", "reported_completed", "validated"}
        ]
        validated = [i for i in public_items if i["status"] == "validated"]
        pct = int(round(100 * len(validated) / len(public_items))) if public_items else 0
        return {
            "plan_id": plan_model.id,
            "general_objective": plan_model.general_objective if plan_model.status == "active" else None,
            "commitments": public_items,
            "validated_progress_pct": pct,
        }
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/generate", response_model=ActionPlanGeneration)
async def generate_plan_draft(
    data: GenerateRequest,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    """JSON draft only — does not persist."""
    try:
        return await PlanGenerationService(session).generate(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("", response_model=ActionPlanOut, status_code=201)
async def create_plan(
    data: ActionPlanCreate,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).create_draft(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/{plan_id}", response_model=ActionPlanOut)
async def get_plan(
    plan_id: int,
    current_user: CurrentUser = PlanStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).get_plan(current_user, plan_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/submit", response_model=ActionPlanOut)
async def submit_plan(
    plan_id: int,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).submit(current_user, plan_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/approve", response_model=ActionPlanOut)
async def approve_plan(
    plan_id: int,
    data: PlanApproveRequest,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).approve(current_user, plan_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/discard", response_model=ActionPlanOut)
async def discard_plan(
    plan_id: int,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).discard(current_user, plan_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/items/{item_id}/progress", response_model=ActionPlanOut)
async def report_progress(
    plan_id: int,
    item_id: int,
    data: ItemProgressRequest,
    current_user: CurrentUser = PlanStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).report_progress(current_user, plan_id, item_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/items/{item_id}/validate", response_model=ActionPlanOut)
async def validate_item(
    plan_id: int,
    item_id: int,
    data: ItemValidateRequest,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).validate_item(current_user, plan_id, item_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/notes", response_model=ActionPlanOut)
async def add_note(
    plan_id: int,
    data: PlanNoteCreate,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).add_note(current_user, plan_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/evidence", response_model=ActionPlanOut, status_code=201)
async def register_evidence(
    plan_id: int,
    data: EvidenceCreate,
    current_user: CurrentUser = PlanPro,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await ActionPlanService(session).register_evidence(current_user, plan_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{plan_id}/signatures", status_code=201)
async def sign_action_plan(
    plan_id: int,
    payload: dict,
    current_user: CurrentUser = PlanFamily,
    session: AsyncSession = Depends(get_db),
):
    """Registers a legal digital signature for an Action Plan."""
    from app.modules.action_plans.infrastructure.models import ActionPlanSignatureModel

    signer_role = payload.get("signer_role", current_user.active_role)
    signer_name = payload.get("signer_name", current_user.username)
    signer_national_id = payload.get("signer_national_id", "")
    signature_data = payload.get("signature_data", "")

    if not signature_data:
        raise HTTPException(status_code=400, detail="Datos de firma digital requeridos")

    sig = ActionPlanSignatureModel(
        plan_id=plan_id,
        signer_role=signer_role,
        signer_name=signer_name,
        signer_national_id=signer_national_id,
        signature_data=signature_data,
        signature_type=payload.get("signature_type", "digital_draw"),
        ip_address="127.0.0.1",
    )
    session.add(sig)
    await session.commit()
    await session.refresh(sig)
    return {"status": "signed", "signature_id": sig.id, "signed_at": sig.signed_at}


@router.get("/{plan_id}/signatures")
async def get_plan_signatures(
    plan_id: int,
    current_user: CurrentUser = PlanFamily,
    session: AsyncSession = Depends(get_db),
):
    """Lists all legal digital signatures registered for an Action Plan."""
    from app.modules.action_plans.infrastructure.models import ActionPlanSignatureModel

    stmt = select(ActionPlanSignatureModel).where(ActionPlanSignatureModel.plan_id == plan_id)
    res = await session.execute(stmt)
    sigs = res.scalars().all()
    return [
        {
            "id": s.id,
            "plan_id": s.plan_id,
            "signer_role": s.signer_role,
            "signer_name": s.signer_name,
            "signer_national_id": s.signer_national_id,
            "signature_type": s.signature_type,
            "signed_at": s.signed_at,
        }
        for s in sigs
    ]
