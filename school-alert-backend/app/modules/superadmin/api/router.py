from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.superadmin.application.service import SuperAdminService
from app.modules.superadmin.schemas import (
    InstitutionCreateRequest,
    InstitutionStatusUpdateRequest,
    SaaSGlobalMetrics,
    SaaSInstitutionItem,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()
SuperAdminOnly = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("/metrics", response_model=SaaSGlobalMetrics)
async def get_global_saas_metrics(
    _: CurrentUser = SuperAdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """Retrieve global SaaS metrics across all registered schools."""
    try:
        return await SuperAdminService(session).get_global_metrics()
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/institutions", response_model=list[SaaSInstitutionItem])
async def list_saas_institutions(
    _: CurrentUser = SuperAdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """List all institutions registered in the SaaS platform."""
    try:
        return await SuperAdminService(session).list_institutions()
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/institutions", response_model=SaaSInstitutionItem)
async def create_saas_institution(
    data: InstitutionCreateRequest,
    _: CurrentUser = SuperAdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """Create a new institution (school tenant) in the SaaS platform."""
    try:
        return await SuperAdminService(session).create_institution(data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.put("/institutions/{institution_id}/status", response_model=SaaSInstitutionItem)
async def update_saas_institution_status(
    institution_id: int,
    data: InstitutionStatusUpdateRequest,
    _: CurrentUser = SuperAdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """Update subscription status (activa, prueba_gratuita, suspendida) or plan tier."""
    try:
        return await SuperAdminService(session).update_institution_status(institution_id, data)
    except DomainError as exc:
        raise _handle(exc) from exc
