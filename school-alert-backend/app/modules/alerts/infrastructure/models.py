from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.enums import AlertStatus, AlertType, RiskLevel


class AlertModel(Base):
    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    alert_type: Mapped[AlertType] = mapped_column(
        "tipo", Enum(AlertType, name="tipo_alerta"), nullable=False
    )
    level: Mapped[RiskLevel] = mapped_column(
        "nivel", Enum(RiskLevel, name="nivel_riesgo"), nullable=False
    )
    description: Mapped[str] = mapped_column("descripcion", Text, nullable=False)
    recommendations: Mapped[Optional[str]] = mapped_column("recomendaciones", Text)
    status: Mapped[AlertStatus] = mapped_column(
        "estado", Enum(AlertStatus, name="estado_alerta"), default=AlertStatus.ACTIVA
    )
    is_manual: Mapped[bool] = mapped_column("es_manual", Boolean, default=False)
    created_by: Mapped[Optional[int]] = mapped_column(
        "creada_por", ForeignKey("usuarios.id"), nullable=True
    )
    attended_by: Mapped[Optional[int]] = mapped_column(
        "atendida_por", ForeignKey("usuarios.id"), nullable=True
    )
    actions_taken: Mapped[Optional[str]] = mapped_column("acciones_tomadas", Text)
    attended_at: Mapped[Optional[datetime]] = mapped_column(
        "fecha_atencion", DateTime(timezone=True), nullable=True
    )
    email_sent: Mapped[bool] = mapped_column("notificada_email", Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )


class AlertConfigModel(Base):
    """RF-05 / RF-06: configurable thresholds and sender email per institution."""

    __tablename__ = "configuracion_alertas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False, unique=True
    )
    min_average: Mapped[float] = mapped_column("promedio_minimo", Float, default=5.5)
    absences_medium: Mapped[int] = mapped_column("ausencias_riesgo_medio", Integer, default=5)
    absences_high: Mapped[int] = mapped_column("ausencias_riesgo_alto", Integer, default=10)
    serious_faults_month: Mapped[int] = mapped_column(
        "faltas_graves_mes", Integer, default=2
    )
    sender_email: Mapped[Optional[str]] = mapped_column(
        "correo_remitente", String(255), nullable=True
    )
    evaluation_hour: Mapped[int] = mapped_column("hora_evaluacion", Integer, default=23)
    updated_at: Mapped[datetime] = mapped_column(
        "actualizado_en", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
