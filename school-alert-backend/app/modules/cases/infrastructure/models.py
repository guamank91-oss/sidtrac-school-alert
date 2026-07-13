from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeceCaseModel(Base):
    __tablename__ = "casos_dece"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    status: Mapped[str] = mapped_column("estado", String(40), nullable=False, default="pending_triage")
    title: Mapped[str] = mapped_column("titulo", String(200), nullable=False)
    opening_summary: Mapped[Optional[str]] = mapped_column("resumen_apertura", Text)
    opened_by: Mapped[int] = mapped_column("abierto_por", ForeignKey("usuarios.id"), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column("cerrado_en", DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "actualizado_en", DateTime(timezone=True), server_default=func.now()
    )
    retention_class: Mapped[Optional[str]] = mapped_column(String(40))
    retain_until: Mapped[Optional[date]] = mapped_column(Date)
    legal_hold: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    anonymized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deletion_reason: Mapped[Optional[str]] = mapped_column(Text)


class DeceCaseAlertModel(Base):
    __tablename__ = "caso_alerta"
    __table_args__ = (UniqueConstraint("caso_id", "alerta_id", name="uq_caso_alerta"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        "caso_id", ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False
    )
    alert_id: Mapped[int] = mapped_column("alerta_id", ForeignKey("alertas.id"), nullable=False)
    linked_at: Mapped[datetime] = mapped_column(
        "vinculado_en", DateTime(timezone=True), server_default=func.now()
    )


class CaseTriageModel(Base):
    __tablename__ = "triages_caso"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        "caso_id", ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False
    )
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    routine_plan_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    protocol_review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    protocol_type: Mapped[Optional[str]] = mapped_column(String(80))
    urgency: Mapped[str] = mapped_column(String(40), nullable=False, default="normal")
    flags_json: Mapped[Optional[str]] = mapped_column(Text)
    reasons_json: Mapped[Optional[str]] = mapped_column(Text)
    ai_suggested_json: Mapped[Optional[str]] = mapped_column(Text)
    professional_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confirmed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"))
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[Optional[str]] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )


class ProtocolActivationModel(Base):
    __tablename__ = "activaciones_protocolo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    case_id: Mapped[Optional[int]] = mapped_column(ForeignKey("casos_dece.id"))
    protocol_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column("estado", String(40), nullable=False, default="reported")
    reported_by: Mapped[int] = mapped_column("reportado_por", ForeignKey("usuarios.id"), nullable=False)
    activated_by: Mapped[Optional[int]] = mapped_column("activado_por", ForeignKey("usuarios.id"))
    reason: Mapped[str] = mapped_column("motivo", Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        "actualizado_en", DateTime(timezone=True), server_default=func.now()
    )


class ExternalReferralModel(Base):
    __tablename__ = "derivaciones_externas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    case_id: Mapped[int] = mapped_column(
        "caso_id", ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False
    )
    destination: Mapped[str] = mapped_column("destino", String(120), nullable=False)
    reason: Mapped[str] = mapped_column("motivo", Text, nullable=False)
    registered_by: Mapped[int] = mapped_column(
        "registrado_por", ForeignKey("usuarios.id"), nullable=False
    )
    referral_date: Mapped[Optional[date]] = mapped_column("fecha_derivacion", Date)
    notes: Mapped[Optional[str]] = mapped_column("notas", Text)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
