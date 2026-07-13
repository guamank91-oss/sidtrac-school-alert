"""Fase 1: canonical normative documents / versions / articles.

Revision ID: 20260713_0003
Revises: 20260713_0002
Create Date: 2026-07-13
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0003"
down_revision: Union[str, None] = "20260713_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documentos_normativos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("codigo", sa.String(length=80), nullable=False),
        sa.Column("nombre", sa.String(length=300), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("jurisdiccion", sa.String(length=80), nullable=False, server_default="EC"),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("codigo", name="uq_documentos_normativos_codigo"),
    )
    op.create_table(
        "versiones_normativas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "documento_id",
            sa.Integer(),
            sa.ForeignKey("documentos_normativos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("etiqueta_version", sa.String(length=120), nullable=False),
        sa.Column("vigente_desde", sa.Date(), nullable=False),
        sa.Column("vigente_hasta", sa.Date(), nullable=True),
        sa.Column("fuente_url", sa.Text(), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("es_vigente", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "documento_id", "etiqueta_version", name="uq_version_normativa_doc_etiqueta"
        ),
    )
    op.create_table(
        "articulos_normativos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "version_id",
            sa.Integer(),
            sa.ForeignKey("versiones_normativas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.String(length=40), nullable=False),
        sa.Column("titulo", sa.String(length=400), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("eje_sidtrac", sa.String(length=80), nullable=True),
        sa.Column("source_chunk_id", sa.String(length=150), nullable=False),
        sa.Column("notas_uso", sa.Text(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("version_id", "numero", name="uq_articulo_version_numero"),
        sa.UniqueConstraint("source_chunk_id", name="uq_articulo_source_chunk"),
    )
    op.create_index("ix_articulos_normativos_numero", "articulos_normativos", ["numero"])


def downgrade() -> None:
    op.drop_index("ix_articulos_normativos_numero", table_name="articulos_normativos")
    op.drop_table("articulos_normativos")
    op.drop_table("versiones_normativas")
    op.drop_table("documentos_normativos")
