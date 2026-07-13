from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.enums import DeceReportType, FaultType, RiskLevel, TutorAnnotationType


class DeceReportModel(Base):
    __tablename__ = "reportes_dece"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    dece_user_id: Mapped[int] = mapped_column(
        "usuario_dece_id", ForeignKey("usuarios.id"), nullable=False
    )
    report_type: Mapped[DeceReportType] = mapped_column(
        "tipo", Enum(DeceReportType, name="tipo_reporte_dece"), nullable=False
    )
    description: Mapped[str] = mapped_column("descripcion", Text, nullable=False)
    actions_taken: Mapped[Optional[str]] = mapped_column("acciones_tomadas", Text)
    urgency_level: Mapped[RiskLevel] = mapped_column(
        "nivel_urgencia", Enum(RiskLevel, name="nivel_riesgo"), default=RiskLevel.BAJO
    )
    requires_follow_up: Mapped[bool] = mapped_column(
        "requiere_seguimiento", Boolean, default=False
    )
    reported_at: Mapped[datetime] = mapped_column(
        "fecha", DateTime(timezone=True), server_default=func.now()
    )


class TutorAnnotationModel(Base):
    __tablename__ = "anotaciones_tutor"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    tutor_id: Mapped[int] = mapped_column("tutor_id", ForeignKey("usuarios.id"), nullable=False)
    annotation_type: Mapped[TutorAnnotationType] = mapped_column(
        "tipo", Enum(TutorAnnotationType, name="tipo_anotacion_tutor"), nullable=False
    )
    description: Mapped[str] = mapped_column("descripcion", Text, nullable=False)
    annotated_at: Mapped[datetime] = mapped_column(
        "fecha", DateTime(timezone=True), server_default=func.now()
    )


class DisciplinaryReportModel(Base):
    __tablename__ = "reportes_disciplinarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    inspector_id: Mapped[int] = mapped_column(
        "inspector_id", ForeignKey("usuarios.id"), nullable=False
    )
    fault_type: Mapped[FaultType] = mapped_column(
        "tipo_falta", Enum(FaultType, name="tipo_falta"), nullable=False
    )
    description: Mapped[str] = mapped_column("descripcion", Text, nullable=False)
    sanction: Mapped[Optional[str]] = mapped_column("sancion_aplicada", Text)
    reported_at: Mapped[datetime] = mapped_column(
        "fecha", DateTime(timezone=True), server_default=func.now()
    )
