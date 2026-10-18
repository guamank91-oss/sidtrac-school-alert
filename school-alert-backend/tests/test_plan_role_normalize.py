"""Normalize free-text plan roles to SIDTRAC codes."""
from __future__ import annotations

from app.modules.action_plans.application.role_normalize import (
    normalize_plan_role,
    normalize_supporting_roles,
)


def test_normalize_common_ai_labels():
    assert normalize_plan_role("Tutor") == "tutor"
    assert normalize_plan_role("Psicólogo del DECE") == "dece"
    assert normalize_plan_role("Docente") == "docente"
    assert normalize_plan_role("dece") == "dece"
    assert normalize_plan_role(None) == "dece"


def test_normalize_supporting_roles_list():
    assert normalize_supporting_roles(["Tutor", "Docente"]) == ["tutor", "docente"]
    assert normalize_supporting_roles("tutor, Psicólogo del DECE") == ["tutor", "dece"]
