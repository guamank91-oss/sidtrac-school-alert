from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.alerts.application.service import AlertService
from app.modules.alerts.schemas import (
    AlertConfigResponse,
    AlertConfigUpdate,
    AlertResponse,
    AlertStats,
    AttendAlertRequest,
    EvaluationResult,
    ManualAlertCreate,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertStatus, AlertType, RiskLevel, UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

AlertReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
    )
)
AlertManager = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    status: Optional[AlertStatus] = Query(None),
    level: Optional[RiskLevel] = Query(None),
    alert_type: Optional[AlertType] = Query(None),
    course_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = AlertReader,
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).list_alerts(
        current_user,
        status=status,
        level=level,
        alert_type=alert_type,
        course_id=course_id,
        student_id=student_id,
        term_id=term_id,
    )


@router.get("/stats", response_model=AlertStats)
async def alert_stats(
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = AlertReader,
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).stats(current_user, term_id=term_id)


@router.post("/manual", response_model=AlertResponse, status_code=201)
async def create_manual_alert(
    data: ManualAlertCreate,
    current_user: CurrentUser = AlertManager,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AlertService(session).create_manual_alert(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/{alert_id}/attend", response_model=AlertResponse)
async def attend_alert(
    alert_id: int,
    data: AttendAlertRequest,
    current_user: CurrentUser = AlertManager,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AlertService(session).attend_alert(current_user, alert_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/evaluate", response_model=EvaluationResult)
async def run_evaluation(
    current_user: CurrentUser = AlertManager,
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).run_evaluation(current_user)


@router.get("/config", response_model=AlertConfigResponse)
async def get_alert_config(
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).get_config(current_user)


@router.patch("/config", response_model=AlertConfigResponse)
async def update_alert_config(
    data: AlertConfigUpdate,
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).update_config(current_user, data)
