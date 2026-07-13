from __future__ import annotations

# ruff: noqa: E402

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IndexedDocumentModel(Base):
    __tablename__ = "documentos_indexados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    student_id: Mapped[Optional[int]] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=True
    )
    source: Mapped[str] = mapped_column("origen", String(50), nullable=False)
    source_id: Mapped[int] = mapped_column("origen_id", Integer, nullable=False)
    chroma_document_id: Mapped[Optional[str]] = mapped_column(
        "chroma_document_id", String(150)
    )
    indexed_text: Mapped[str] = mapped_column("texto_indexado", Text, nullable=False)
    indexed_at: Mapped[datetime] = mapped_column(
        "fecha_indexacion", DateTime(timezone=True), server_default=func.now()
    )


class RagQueryModel(Base):
    """RF-40: audit log of every RAG query (redacted persistence)."""

    __tablename__ = "consultas_rag"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id"), nullable=False
    )
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    student_ref: Mapped[Optional[str]] = mapped_column("student_ref", String(128), nullable=True)
    question: Mapped[str] = mapped_column("pregunta", Text, nullable=False)
    answer: Mapped[str] = mapped_column("respuesta", Text, nullable=False)
    context_used: Mapped[Optional[str]] = mapped_column("contexto_recuperado", Text)
    context_categories: Mapped[Optional[str]] = mapped_column("categorias_contexto", Text)
    ai_provider_used: Mapped[bool] = mapped_column(
        "proveedor_ia_usado", Boolean, nullable=False, server_default="false"
    )
    model: Mapped[str] = mapped_column("modelo", String(120), nullable=False)
    tokens_used: Mapped[Optional[int]] = mapped_column("tokens_consumidos", Integer)
    latency_ms: Mapped[int] = mapped_column("latencia_ms", Integer, nullable=False)
    detected_risk: Mapped[Optional[str]] = mapped_column("riesgo_detectado", String(20))
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
