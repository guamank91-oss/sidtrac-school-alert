from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ActionPlanModel(Base):
    __tablename__ = "planes_accion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column("institucion_id", ForeignKey("instituciones.id"), nullable=False)
    case_id: Mapped[int] = mapped_column("caso_id", ForeignKey("casos_dece.id"), nullable=False)
    plan_type: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column("estado", String(40), nullable=False, default="draft")
    general_objective: Mapped[str] = mapped_column("objetivo_general", Text, nullable=False)
    limitations: Mapped[Optional[str]] = mapped_column("limitaciones", Text)
    review_criteria: Mapped[Optional[str]] = mapped_column("criterios_revision", Text)
    opening_reason: Mapped[Optional[str]] = mapped_column("motivo_apertura", Text)
    review_at_hint: Mapped[Optional[str]] = mapped_column(String(120))
    document_json: Mapped[Optional[str]] = mapped_column(Text)
    approval_mode: Mapped[str] = mapped_column(String(40), nullable=False, default="dece_only")
    approved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approval_comment: Mapped[Optional[str]] = mapped_column(Text)
    supersedes_plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("planes_accion.id"))
    created_by: Mapped[int] = mapped_column("creado_por", ForeignKey("usuarios.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column("creado_en", DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("actualizado_en", DateTime(timezone=True), server_default=func.now())


class ActionPlanItemModel(Base):
    __tablename__ = "acciones_plan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column("titulo", String(200), nullable=False)
    objective: Mapped[str] = mapped_column("objetivo", Text, nullable=False)
    action_type: Mapped[Optional[str]] = mapped_column(String(80))
    dece_axis: Mapped[Optional[str]] = mapped_column(String(80))
    case_dimension: Mapped[Optional[str]] = mapped_column(String(80))
    responsible_role: Mapped[str] = mapped_column(String(40), nullable=False)
    assignee_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"))
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    due_hint: Mapped[Optional[str]] = mapped_column(String(120))
    expected_result: Mapped[Optional[str]] = mapped_column(Text)
    success_indicator: Mapped[Optional[str]] = mapped_column(Text)
    rationale: Mapped[Optional[str]] = mapped_column(Text)
    supporting_roles: Mapped[Optional[str]] = mapped_column(String(200))
    evidence_required: Mapped[bool] = mapped_column(Boolean, default=False)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    confidentiality_level: Mapped[str] = mapped_column(String(40), default="professional")
    status: Mapped[str] = mapped_column("estado", String(40), nullable=False, default="pending")
    progress_pct_validated: Mapped[int] = mapped_column("progreso_pct_validated", Integer, default=0)


class ActionPlanNoteModel(Base):
    __tablename__ = "notas_plan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[Optional[int]] = mapped_column(
        "accion_id", ForeignKey("acciones_plan.id", ondelete="SET NULL")
    )
    author_id: Mapped[int] = mapped_column("autor_id", ForeignKey("usuarios.id"), nullable=False)
    visibility_scope: Mapped[str] = mapped_column(String(40), nullable=False, default="professional")
    note_kind: Mapped[Optional[str]] = mapped_column(String(40))
    text: Mapped[str] = mapped_column("texto", Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column("creado_en", DateTime(timezone=True), server_default=func.now())


class ActionPlanNormativeRefModel(Base):
    __tablename__ = "referencias_normativas_plan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False)
    article_id: Mapped[Optional[int]] = mapped_column(
        "articulo_id", ForeignKey("articulos_normativos.id")
    )
    document_code: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[str] = mapped_column(String(120), nullable=False)
    article: Mapped[str] = mapped_column(String(40), nullable=False)
    article_title: Mapped[str] = mapped_column(String(400), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    source_chunk_id: Mapped[str] = mapped_column(String(150), nullable=False)


class ActionPlanEvidenceModel(Base):
    __tablename__ = "evidencias_plan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("acciones_plan.id", ondelete="SET NULL"))
    institution_id: Mapped[int] = mapped_column("institucion_id", ForeignKey("instituciones.id"), nullable=False)
    storage_backend: Mapped[str] = mapped_column(String(40), nullable=False, default="local")
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    confidentiality_level: Mapped[str] = mapped_column(String(40), default="professional")
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column("creado_en", DateTime(timezone=True), server_default=func.now())


class ActionPlanSignatureModel(Base):
    __tablename__ = "firmas_plan_accion"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False)
    signer_role: Mapped[str] = mapped_column(String(40), nullable=False)
    signer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    signer_national_id: Mapped[Optional[str]] = mapped_column(String(20))
    signature_data: Mapped[str] = mapped_column(Text, nullable=False)
    signature_type: Mapped[str] = mapped_column(String(40), default="digital_draw")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
