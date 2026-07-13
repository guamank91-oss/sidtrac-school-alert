from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.audit.application.service import record_audit
from app.modules.notifications.application.service import NotificationService
from app.modules.notifications.schemas import (
    EmailNotificationResponse,
    InternalNotificationResponse,
    TestEmailRequest,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import EmailStatus, UserRole
from app.shared.exceptions import DomainError

router = APIRouter()

AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))
AnyUser = Depends(get_current_user)


def _handle(exc: DomainError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400
    return HTTPException(status_code=status, detail=exc.message)


@router.get("/email", response_model=list[EmailNotificationResponse])
async def list_email_notifications(
    status: Optional[EmailStatus] = Query(None),
    _: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    return await NotificationService(session).list_email_notifications(status)


@router.post("/email/{notification_id}/resend", response_model=EmailNotificationResponse)
async def resend_email(
    notification_id: int,
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    try:
        result = await NotificationService(session).resend_email(notification_id)
        await record_audit(
            session,
            user_id=current_user.id,
            action="reenvio_email",
            detail=f"Reenvío manual del correo {notification_id}",
            commit=True,
        )
        return result
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/email/test", response_model=EmailNotificationResponse)
async def send_test_email(
    data: TestEmailRequest,
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    result = await NotificationService(session).send_test_email(data.recipient)
    await record_audit(
        session,
        user_id=current_user.id,
        action="email_prueba",
        detail=f"Correo de prueba a {data.recipient}",
        commit=True,
    )
    return result


@router.get("/internal", response_model=list[InternalNotificationResponse])
async def list_internal_notifications(
    unread_only: bool = Query(False),
    current_user: CurrentUser = AnyUser,
    session: AsyncSession = Depends(get_db),
):
    return await NotificationService(session).list_internal(current_user, unread_only)


@router.post("/internal/{notification_id}/read", status_code=204)
async def mark_notification_read(
    notification_id: int,
    current_user: CurrentUser = AnyUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        await NotificationService(session).mark_read(current_user, notification_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/internal/read-all", status_code=204)
async def mark_all_notifications_read(
    current_user: CurrentUser = AnyUser,
    session: AsyncSession = Depends(get_db),
):
    await NotificationService(session).mark_all_read(current_user)
