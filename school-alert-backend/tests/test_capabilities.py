"""Feature flags and case capabilities (Fase 0)."""
from __future__ import annotations

import pytest

from app.core.config import settings
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError
from app.shared.feature_flags import action_plans_enabled, dece_cases_enabled
from app.shared.permissions import (
    CASE_VIEW_PROFESSIONAL,
    has_capability,
    require_capability,
    require_dece_cases_enabled,
)


def _user(*, user_id: int, role: UserRole) -> CurrentUser:
    return CurrentUser(
        id=user_id,
        institution_id=1,
        username="u",
        first_name="U",
        last_name="Ser",
        email=None,
        roles=[role],
        active_role=role,
    )


def test_feature_flags_off_by_default():
    assert dece_cases_enabled() is False
    assert action_plans_enabled() is False


def test_admin_lacks_professional_by_default():
    admin = _user(user_id=1, role=UserRole.ADMINISTRADOR)
    dece = _user(user_id=2, role=UserRole.DECE)
    assert has_capability(admin, CASE_VIEW_PROFESSIONAL) is False
    assert has_capability(dece, CASE_VIEW_PROFESSIONAL) is True
    with pytest.raises(ForbiddenError):
        require_capability(admin, CASE_VIEW_PROFESSIONAL)


def test_professional_allowlist_grants_admin(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "PROFESSIONAL_ACCESS_USER_IDS", "99")
    admin = _user(user_id=99, role=UserRole.ADMINISTRADOR)
    other = _user(user_id=100, role=UserRole.ADMINISTRADOR)
    assert has_capability(admin, CASE_VIEW_PROFESSIONAL) is True
    assert has_capability(other, CASE_VIEW_PROFESSIONAL) is False


def test_dece_cases_flag_blocks(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", False)
    with pytest.raises(ForbiddenError):
        require_dece_cases_enabled()
