"""Fase 2: DeceCase, triage, protocols, referrals.

Revision ID: 20260713_0004
Revises: 20260713_0003
Create Date: 2026-07-13
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0004"
down_revision: Union[str, None] = "20260713_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "casos_dece",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("estudiante_id", sa.Integer(), sa.ForeignKey("estudiantes.id"), nullable=False),
        sa.Column("estado", sa.String(length=40), nullable=False, server_default="pending_triage"),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("resumen_apertura", sa.Text(), nullable=True),
        sa.Column("abierto_por", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("cerrado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("retention_class", sa.String(length=40), nullable=True),
        sa.Column("retain_until", sa.Date(), nullable=True),
        sa.Column("legal_hold", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("anonymized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_casos_dece_institucion", "casos_dece", ["institucion_id"])
    op.create_index("ix_casos_dece_estudiante", "casos_dece", ["estudiante_id"])

    op.create_table(
        "caso_alerta",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("caso_id", sa.Integer(), sa.ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alerta_id", sa.Integer(), sa.ForeignKey("alertas.id"), nullable=False),
        sa.Column("vinculado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("caso_id", "alerta_id", name="uq_caso_alerta"),
    )

    op.create_table(
        "triages_caso",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("caso_id", sa.Integer(), sa.ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("routine_plan_allowed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("protocol_review_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("protocol_type", sa.String(length=80), nullable=True),
        sa.Column("urgency", sa.String(length=40), nullable=False, server_default="normal"),
        sa.Column("flags_json", sa.Text(), nullable=True),
        sa.Column("reasons_json", sa.Text(), nullable=True),
        sa.Column("ai_suggested_json", sa.Text(), nullable=True),
        sa.Column("professional_confirmed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("confirmed_by", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("outcome", sa.String(length=40), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "activaciones_protocolo",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("estudiante_id", sa.Integer(), sa.ForeignKey("estudiantes.id"), nullable=False),
        sa.Column("caso_id", sa.Integer(), sa.ForeignKey("casos_dece.id"), nullable=True),
        sa.Column("protocol_type", sa.String(length=80), nullable=False),
        sa.Column("estado", sa.String(length=40), nullable=False, server_default="reported"),
        sa.Column("reportado_por", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("activado_por", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "derivaciones_externas",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("institucion_id", sa.Integer(), sa.ForeignKey("instituciones.id"), nullable=False),
        sa.Column("caso_id", sa.Integer(), sa.ForeignKey("casos_dece.id", ondelete="CASCADE"), nullable=False),
        sa.Column("destino", sa.String(length=120), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("registrado_por", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("fecha_derivacion", sa.Date(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("derivaciones_externas")
    op.drop_table("activaciones_protocolo")
    op.drop_table("triages_caso")
    op.drop_table("caso_alerta")
    op.drop_index("ix_casos_dece_estudiante", table_name="casos_dece")
    op.drop_index("ix_casos_dece_institucion", table_name="casos_dece")
    op.drop_table("casos_dece")
