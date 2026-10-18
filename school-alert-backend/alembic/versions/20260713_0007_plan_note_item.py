"""Add item_id to action plan notes for progress/validation comments.

Revision ID: 20260713_0007
Revises: 20260713_0006
Create Date: 2026-07-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0007"
down_revision: Union[str, None] = "20260713_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notas_plan",
        sa.Column("accion_id", sa.Integer(), sa.ForeignKey("acciones_plan.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "notas_plan",
        sa.Column("note_kind", sa.String(length=40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notas_plan", "note_kind")
    op.drop_column("notas_plan", "accion_id")
