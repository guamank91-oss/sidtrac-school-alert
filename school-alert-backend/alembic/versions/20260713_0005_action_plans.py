"""Fase 3: versioned action plans, items, notes, evidence stub, normative refs.

Revision ID: 20260713_0005
Revises: 20260713_0004
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0005"
down_revision: Union[str, None] = "20260713_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "planes_accion",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("caso_id", sa.Integer(), sa.ForeignKey("casos_dece.id"), nullable=False),
        sa.Column("plan_type", sa.String(length=80), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("estado", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("objetivo_general", sa.Text(), nullable=False),
        sa.Column("limitaciones", sa.Text(), nullable=True),
        sa.Column("criterios_revision", sa.Text(), nullable=True),
        sa.Column("approval_mode", sa.String(length=40), nullable=False, server_default="dece_only"),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_comment", sa.Text(), nullable=True),
        sa.Column("supersedes_plan_id", sa.Integer(), sa.ForeignKey("planes_accion.id"), nullable=True),
        sa.Column("creado_por", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_planes_accion_caso", "planes_accion", ["caso_id"])

    op.create_table(
        "acciones_plan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("objetivo", sa.Text(), nullable=False),
        sa.Column("action_type", sa.String(length=80), nullable=True),
        sa.Column("dece_axis", sa.String(length=80), nullable=True),
        sa.Column("case_dimension", sa.String(length=80), nullable=True),
        sa.Column("responsible_role", sa.String(length=40), nullable=False),
        sa.Column("assignee_user_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_hint", sa.String(length=120), nullable=True),
        sa.Column("expected_result", sa.Text(), nullable=True),
        sa.Column("success_indicator", sa.Text(), nullable=True),
        sa.Column("evidence_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("priority", sa.Integer(), server_default="1", nullable=False),
        sa.Column("confidentiality_level", sa.String(length=40), server_default="professional", nullable=False),
        sa.Column("estado", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("progreso_pct_validated", sa.Integer(), server_default="0", nullable=False),
    )

    op.create_table(
        "notas_plan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False),
        sa.Column("autor_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("visibility_scope", sa.String(length=40), nullable=False, server_default="professional"),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "referencias_normativas_plan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False),
        sa.Column("articulo_id", sa.Integer(), sa.ForeignKey("articulos_normativos.id"), nullable=True),
        sa.Column("document_code", sa.String(length=80), nullable=False),
        sa.Column("version", sa.String(length=120), nullable=False),
        sa.Column("article", sa.String(length=40), nullable=False),
        sa.Column("article_title", sa.String(length=400), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("source_chunk_id", sa.String(length=150), nullable=False),
    )

    op.create_table(
        "evidencias_plan",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("planes_accion.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("acciones_plan.id", ondelete="SET NULL"), nullable=True),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("storage_backend", sa.String(length=40), nullable=False, server_default="local"),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("confidentiality_level", sa.String(length=40), server_default="professional", nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("evidencias_plan")
    op.drop_table("referencias_normativas_plan")
    op.drop_table("notas_plan")
    op.drop_table("acciones_plan")
    op.drop_index("ix_planes_accion_caso", table_name="planes_accion")
    op.drop_table("planes_accion")
