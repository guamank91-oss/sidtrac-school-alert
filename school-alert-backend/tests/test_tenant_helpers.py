"""Unit tests for tenant resolution (no HTTP)."""
from __future__ import annotations

import pytest

from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError
from app.shared.tenant import assert_same_institution, resolve_institution_id


def _user(institution_id: int | None = 1) -> CurrentUser:
    return CurrentUser(
        id=10,
        institution_id=institution_id,
        username="u",
        first_name="U",
        last_name="Ser",
        email=None,
        roles=[UserRole.DECE],
        active_role=UserRole.DECE,
    )


def test_resolve_uses_session_institution():
    assert resolve_institution_id(_user(5), None) == 5
    assert resolve_institution_id(_user(5), 5) == 5


def test_resolve_rejects_mismatched_query_institution():
    with pytest.raises(ForbiddenError):
        resolve_institution_id(_user(5), 99)


def test_assert_same_institution():
    assert_same_institution(_user(5), 5)
    with pytest.raises(ForbiddenError):
        assert_same_institution(_user(5), 9)
