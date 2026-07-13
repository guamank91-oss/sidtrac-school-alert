from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.cases.application.service import CaseService
from app.modules.cases.schemas import (
    CaseCreate,
    CaseResponse,
    ProtocolCreate,
    ProtocolResponse,
    ProtocolStatusUpdate,
    ReferralCreate,
    ReferralResponse,
    TriageConfirmRequest,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

CaseStaff = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
ProtocolReporter = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.DOCENTE,
        UserRole.INSPECTOR,
    )
)


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.post("", response_model=CaseResponse, status_code=201)
async def create_case(
    data: CaseCreate,
    current_user: CurrentUser = CaseStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).create_case(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    student_id: Optional[int] = Query(None),
    current_user: CurrentUser = CaseStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).list_cases(current_user, student_id=student_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: int,
    current_user: CurrentUser = CaseStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).get_case(current_user, case_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{case_id}/triage", response_model=CaseResponse)
async def confirm_triage(
    case_id: int,
    data: TriageConfirmRequest,
    current_user: CurrentUser = CaseStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).confirm_triage(current_user, case_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{case_id}/protocols", response_model=ProtocolResponse, status_code=201)
async def create_protocol(
    case_id: int,
    data: ProtocolCreate,
    current_user: CurrentUser = ProtocolReporter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).create_protocol(current_user, case_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.patch("/protocols/{protocol_id}", response_model=ProtocolResponse)
async def update_protocol(
    protocol_id: int,
    data: ProtocolStatusUpdate,
    current_user: CurrentUser = ProtocolReporter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).update_protocol_status(current_user, protocol_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{case_id}/referrals", response_model=ReferralResponse, status_code=201)
async def create_referral(
    case_id: int,
    data: ReferralCreate,
    current_user: CurrentUser = CaseStaff,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await CaseService(session).create_referral(current_user, case_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc
