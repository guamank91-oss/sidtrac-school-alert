from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NormativeDocumentModel(Base):
    __tablename__ = "documentos_normativos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column("codigo", String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column("nombre", String(300), nullable=False)
    doc_type: Mapped[str] = mapped_column("tipo", String(50), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(
        "jurisdiccion", String(80), nullable=False, server_default="EC"
    )
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )

    versions: Mapped[list["NormativeVersionModel"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class NormativeVersionModel(Base):
    __tablename__ = "versiones_normativas"
    __table_args__ = (
        UniqueConstraint("documento_id", "etiqueta_version", name="uq_version_normativa_doc_etiqueta"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        "documento_id", ForeignKey("documentos_normativos.id", ondelete="CASCADE"), nullable=False
    )
    version_label: Mapped[str] = mapped_column("etiqueta_version", String(120), nullable=False)
    effective_from: Mapped[date] = mapped_column("vigente_desde", Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column("vigente_hasta", Date, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column("fuente_url", Text)
    checksum_sha256: Mapped[Optional[str]] = mapped_column("checksum_sha256", String(64))
    is_current: Mapped[bool] = mapped_column(
        "es_vigente", Boolean, nullable=False, server_default="true"
    )
    notes: Mapped[Optional[str]] = mapped_column("notas", Text)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped[NormativeDocumentModel] = relationship(back_populates="versions")
    articles: Mapped[list["NormativeArticleModel"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class NormativeArticleModel(Base):
    __tablename__ = "articulos_normativos"
    __table_args__ = (
        UniqueConstraint("version_id", "numero", name="uq_articulo_version_numero"),
        UniqueConstraint("source_chunk_id", name="uq_articulo_source_chunk"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(
        "version_id", ForeignKey("versiones_normativas.id", ondelete="CASCADE"), nullable=False
    )
    article: Mapped[str] = mapped_column("numero", String(40), nullable=False)
    title: Mapped[str] = mapped_column("titulo", String(400), nullable=False)
    body: Mapped[str] = mapped_column("texto", Text, nullable=False)
    sidtrac_axis: Mapped[Optional[str]] = mapped_column("eje_sidtrac", String(80))
    source_chunk_id: Mapped[str] = mapped_column("source_chunk_id", String(150), nullable=False)
    usage_notes: Mapped[Optional[str]] = mapped_column("notas_uso", Text)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )

    version: Mapped[NormativeVersionModel] = relationship(back_populates="articles")
