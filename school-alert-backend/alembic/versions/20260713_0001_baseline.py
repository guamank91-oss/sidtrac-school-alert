"""Baseline: full current SIDTRAC schema (pre–Fase 0 security columns).

Revision ID: 20260713_0001
Revises:
Create Date: 2026-07-13

Creates every table registered in app.infrastructure.models_registry so that
`alembic upgrade head` can bootstrap a brand-new database.

Existing databases that already match this schema must be verified and then:
  alembic stamp 20260713_0001
Do NOT run upgrade on those DBs (would try to recreate tables).
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.core.database import Base
from app.infrastructure import models_registry  # noqa: F401

revision: str = "20260713_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
