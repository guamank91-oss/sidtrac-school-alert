"""Fix AI-generated free-text responsible_role labels to role codes."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text

from app.core.config import settings
from app.modules.action_plans.application.role_normalize import normalize_plan_role

engine = create_engine(settings.sync_database_url, connect_args={"sslmode": "disable"})
with engine.begin() as c:
    rows = c.execute(text("SELECT id, responsible_role FROM acciones_plan")).mappings().all()
    updated = 0
    for row in rows:
        normalized = normalize_plan_role(row["responsible_role"])
        if normalized != row["responsible_role"]:
            c.execute(
                text("UPDATE acciones_plan SET responsible_role = :role WHERE id = :id"),
                {"role": normalized, "id": row["id"]},
            )
            updated += 1
            print(f"item {row['id']}: {row['responsible_role']!r} -> {normalized!r}")
    print(f"updated={updated}")
