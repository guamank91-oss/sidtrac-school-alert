"""Fase: document snapshot and action rationale for professional plan document.

Revision ID: 20260713_0006
Revises: 20260713_0005
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0006"
down_revision: Union[str, None] = "20260713_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("planes_accion", sa.Column("document_json", sa.Text(), nullable=True))
    op.add_column("planes_accion", sa.Column("motivo_apertura", sa.Text(), nullable=True))
    op.add_column("planes_accion", sa.Column("review_at_hint", sa.String(length=120), nullable=True))
    op.add_column("acciones_plan", sa.Column("rationale", sa.Text(), nullable=True))
    op.add_column("acciones_plan", sa.Column("supporting_roles", sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column("acciones_plan", "supporting_roles")
    op.drop_column("acciones_plan", "rationale")
    op.drop_column("planes_accion", "review_at_hint")
    op.drop_column("planes_accion", "motivo_apertura")
    op.drop_column("planes_accion", "document_json")
