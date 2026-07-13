"""Fase 0: tenant columns, audit scope, RAG redaction metadata.

Revision ID: 20260713_0002
Revises: 20260713_0001
Create Date: 2026-07-13

Adds institution scoping and audit metadata. Does NOT add education_levels/funding_type.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0002"
down_revision: Union[str, None] = "20260713_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- logs_auditoria ---
    op.add_column(
        "logs_auditoria",
        sa.Column("institucion_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "logs_auditoria",
        sa.Column("alcance", sa.String(length=20), server_default="institution", nullable=False),
    )
    op.add_column("logs_auditoria", sa.Column("tipo_entidad", sa.String(length=80), nullable=True))
    op.add_column("logs_auditoria", sa.Column("entidad_id", sa.Integer(), nullable=True))
    op.add_column("logs_auditoria", sa.Column("categorias", sa.Text(), nullable=True))
    op.add_column("logs_auditoria", sa.Column("motivo", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_logs_auditoria_institucion",
        "logs_auditoria",
        "instituciones",
        ["institucion_id"],
        ["id"],
    )
    op.execute(
        """
        UPDATE logs_auditoria AS l
        SET institucion_id = u.institucion_id
        FROM usuarios AS u
        WHERE l.usuario_id = u.id AND l.institucion_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE logs_auditoria
        SET alcance = CASE WHEN institucion_id IS NULL THEN 'global' ELSE 'institution' END
        """
    )

    # --- documentos_indexados ---
    op.add_column(
        "documentos_indexados",
        sa.Column("institucion_id", sa.Integer(), nullable=True),
    )
    op.execute(
        """
        UPDATE documentos_indexados AS d
        SET institucion_id = e.institucion_id
        FROM estudiantes AS e
        WHERE d.estudiante_id = e.id
        """
    )
    op.execute("DELETE FROM documentos_indexados WHERE institucion_id IS NULL")
    op.alter_column("documentos_indexados", "institucion_id", nullable=False)
    op.create_foreign_key(
        "fk_documentos_indexados_institucion",
        "documentos_indexados",
        "instituciones",
        ["institucion_id"],
        ["id"],
    )
    op.alter_column("documentos_indexados", "estudiante_id", existing_type=sa.Integer(), nullable=True)
    op.create_index(
        "ix_documentos_indexados_institucion_estudiante",
        "documentos_indexados",
        ["institucion_id", "estudiante_id"],
    )

    # --- consultas_rag ---
    op.add_column(
        "consultas_rag",
        sa.Column("institucion_id", sa.Integer(), nullable=True),
    )
    op.add_column("consultas_rag", sa.Column("student_ref", sa.String(length=128), nullable=True))
    op.add_column("consultas_rag", sa.Column("categorias_contexto", sa.Text(), nullable=True))
    op.add_column(
        "consultas_rag",
        sa.Column("proveedor_ia_usado", sa.Boolean(), server_default="false", nullable=False),
    )
    op.execute(
        """
        UPDATE consultas_rag AS c
        SET institucion_id = e.institucion_id
        FROM estudiantes AS e
        WHERE c.estudiante_id = e.id
        """
    )
    op.execute("DELETE FROM consultas_rag WHERE institucion_id IS NULL")
    op.alter_column("consultas_rag", "institucion_id", nullable=False)
    op.create_foreign_key(
        "fk_consultas_rag_institucion",
        "consultas_rag",
        "instituciones",
        ["institucion_id"],
        ["id"],
    )
    # Redact historical clear-text context (retention minimization).
    op.execute(
        """
        UPDATE consultas_rag
        SET contexto_recuperado = '[REDACTED_FASE0]',
            categorias_contexto = '["historical_redacted"]'
        WHERE contexto_recuperado IS NOT NULL
          AND contexto_recuperado <> ''
          AND contexto_recuperado <> '[REDACTED_FASE0]'
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_consultas_rag_institucion", "consultas_rag", type_="foreignkey")
    op.drop_column("consultas_rag", "proveedor_ia_usado")
    op.drop_column("consultas_rag", "categorias_contexto")
    op.drop_column("consultas_rag", "student_ref")
    op.drop_column("consultas_rag", "institucion_id")

    op.drop_index("ix_documentos_indexados_institucion_estudiante", table_name="documentos_indexados")
    op.drop_constraint("fk_documentos_indexados_institucion", "documentos_indexados", type_="foreignkey")
    op.alter_column("documentos_indexados", "estudiante_id", existing_type=sa.Integer(), nullable=False)
    op.drop_column("documentos_indexados", "institucion_id")

    op.drop_constraint("fk_logs_auditoria_institucion", "logs_auditoria", type_="foreignkey")
    op.drop_column("logs_auditoria", "motivo")
    op.drop_column("logs_auditoria", "categorias")
    op.drop_column("logs_auditoria", "entidad_id")
    op.drop_column("logs_auditoria", "tipo_entidad")
    op.drop_column("logs_auditoria", "alcance")
    op.drop_column("logs_auditoria", "institucion_id")
