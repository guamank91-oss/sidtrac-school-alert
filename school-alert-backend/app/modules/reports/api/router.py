from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.audit.application.service import record_audit
from app.modules.reports.application.service import ReportService
from app.modules.reports.schemas import (
    InstitutionalReport,
    PeriodComparison,
    PeriodSummary,
    StudentFullReport,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError

router = APIRouter()

ReportReader = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400
    return HTTPException(status_code=status, detail=exc.message)


@router.get("/institutional", response_model=InstitutionalReport)
async def institutional_report(
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """RF-48: institutional risk situation report."""
    return await ReportService(session).institutional_report(
        current_user.institution_id, term_id=term_id
    )


@router.get("/period-summary", response_model=PeriodSummary)
async def period_summary(
    term_id: int = Query(...),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """Métricas de un periodo lectivo (filtro por periodo)."""
    try:
        return await ReportService(session).period_summary(
            current_user.institution_id, term_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/period-comparison", response_model=PeriodComparison)
async def period_comparison(
    term_a_id: int = Query(...),
    term_b_id: Optional[int] = Query(None),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """Comparación estadística entre dos periodos lectivos."""
    try:
        return await ReportService(session).period_comparison(
            current_user.institution_id, term_a_id, term_b_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/students/{student_id}", response_model=StudentFullReport)
async def student_report(
    student_id: int,
    _: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """RF-49: consolidated individual student report."""
    try:
        return await ReportService(session).student_report(student_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/export/{dataset}")
async def export_csv(
    dataset: str,
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """RF-50: CSV export (students | alerts | grades | attendance)."""
    try:
        filename, content = await ReportService(session).export_csv(dataset)
    except DomainError as exc:
        raise _handle(exc) from exc
    await record_audit(
        session,
        user_id=current_user.id,
        action="exportacion_csv",
        detail=f"Exportación del dataset {dataset}",
        commit=True,
    )
    return Response(
        content="\ufeff" + content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
