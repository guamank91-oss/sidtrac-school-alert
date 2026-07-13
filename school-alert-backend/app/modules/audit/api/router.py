from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.audit.application.service import AuditService
from app.modules.audit.schemas import AuditLogResponse
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole

router = APIRouter()

AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))


@router.get("/logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(200, le=1000),
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """RF-51: audit trail, admin only (institution-scoped + global)."""
    return await AuditService(session).list_logs(
        current_user,
        action=action,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )


@router.get("/actions", response_model=list[str])
async def list_audit_actions(
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    return await AuditService(session).list_actions(current_user)
