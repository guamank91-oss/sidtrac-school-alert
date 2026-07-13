from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.notifications.application.emailer import (
    build_alert_email_html,
    send_email_via_resend,
)
from app.modules.notifications.infrastructure.models import (
    EmailNotificationModel,
    InternalNotificationModel,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import EmailStatus
from app.shared.exceptions import NotFoundError, ValidationError


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_email_notifications(
        self, status: Optional[EmailStatus] = None
    ) -> list[EmailNotificationModel]:
        query = select(EmailNotificationModel).order_by(
            EmailNotificationModel.created_at.desc()
        )
        if status:
            query = query.where(EmailNotificationModel.status == status)
        result = await self.session.execute(query.limit(200))
        return list(result.scalars().all())

    async def resend_email(self, notification_id: int) -> EmailNotificationModel:
        """RF-45: manual retry of failed emails."""
        notification = await self.session.get(EmailNotificationModel, notification_id)
        if notification is None:
            raise NotFoundError("Email notification")
        if notification.status == EmailStatus.ENVIADO:
            raise ValidationError("Este correo ya fue enviado correctamente")

        success, resend_id, error = send_email_via_resend(
            recipient=notification.recipient,
            subject=notification.subject,
            html=notification.body_html,
        )
        notification.status = EmailStatus.ENVIADO if success else EmailStatus.ERROR
        notification.resend_id = resend_id
        notification.error_detail = error
        notification.sent_at = datetime.now(timezone.utc) if success else None
        await self.session.commit()
        return notification

    async def send_test_email(self, recipient: str) -> EmailNotificationModel:
        """RF-47: test email from admin panel."""
        html = build_alert_email_html(
            student_name="Estudiante de Prueba",
            course_name="1ro de Bachillerato A",
            level="medio",
            description="- Este es un correo de prueba del sistema SIDTRAC.\n- Verifica que la integración con Resend funciona.",
            recommendations="- No se requiere ninguna acción.\n- Este mensaje puede eliminarse.",
            institution_name="SIDTRAC",
        )
        success, resend_id, error = send_email_via_resend(
            recipient=recipient,
            subject="[SIDTRAC] Correo de prueba",
            html=html,
        )
        notification = EmailNotificationModel(
            alert_id=None,
            recipient=recipient,
            subject="[SIDTRAC] Correo de prueba",
            body_html=html,
            status=EmailStatus.ENVIADO if success else EmailStatus.ERROR,
            resend_id=resend_id,
            error_detail=error,
            sent_at=datetime.now(timezone.utc) if success else None,
        )
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def list_internal(
        self, current_user: CurrentUser, unread_only: bool = False
    ) -> list[InternalNotificationModel]:
        query = (
            select(InternalNotificationModel)
            .where(InternalNotificationModel.user_id == current_user.id)
            .order_by(InternalNotificationModel.created_at.desc())
            .limit(50)
        )
        if unread_only:
            query = query.where(InternalNotificationModel.is_read.is_(False))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def mark_read(self, current_user: CurrentUser, notification_id: int) -> None:
        notification = await self.session.get(InternalNotificationModel, notification_id)
        if notification is None or notification.user_id != current_user.id:
            raise NotFoundError("Notification")
        notification.is_read = True
        await self.session.commit()

    async def mark_all_read(self, current_user: CurrentUser) -> None:
        result = await self.session.execute(
            select(InternalNotificationModel).where(
                InternalNotificationModel.user_id == current_user.id,
                InternalNotificationModel.is_read.is_(False),
            )
        )
        for n in result.scalars().all():
            n.is_read = True
        await self.session.commit()
