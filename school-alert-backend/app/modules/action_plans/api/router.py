from __future__ import annotations

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
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

PlanStaff = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE, UserRole.TUTOR, UserRole.DOCENTE))
PlanPro = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


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
