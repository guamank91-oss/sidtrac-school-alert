from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.enums import EmailStatus


class EmailNotificationModel(Base):
    __tablename__ = "notificaciones_email"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    alert_id: Mapped[Optional[int]] = mapped_column(
        "alerta_id", ForeignKey("alertas.id"), nullable=True
    )
    recipient: Mapped[str] = mapped_column("destinatario", String(255), nullable=False)
    subject: Mapped[str] = mapped_column("asunto", String(255), nullable=False)
    body_html: Mapped[str] = mapped_column("cuerpo_html", Text, nullable=False)
    status: Mapped[EmailStatus] = mapped_column(
        "estado", Enum(EmailStatus, name="estado_email"), default=EmailStatus.PENDIENTE
    )
    resend_id: Mapped[Optional[str]] = mapped_column("resend_id", String(120), nullable=True)
    error_detail: Mapped[Optional[str]] = mapped_column("detalle_error", Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        "fecha_envio", DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )


class InternalNotificationModel(Base):
    __tablename__ = "notificaciones_internas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id"), nullable=False
    )
    alert_id: Mapped[Optional[int]] = mapped_column(
        "alerta_id", ForeignKey("alertas.id"), nullable=True
    )
    title: Mapped[str] = mapped_column("titulo", String(200), nullable=False)
    message: Mapped[str] = mapped_column("mensaje", Text, nullable=False)
    is_read: Mapped[bool] = mapped_column("leida", Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
