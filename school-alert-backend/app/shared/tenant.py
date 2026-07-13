"""Institution / tenant isolation helpers."""
from __future__ import annotations

from typing import Optional

from app.shared.auth_context import CurrentUser
from app.shared.exceptions import ForbiddenError


def resolve_institution_id(
    current_user: CurrentUser,
    requested_institution_id: Optional[int] = None,
) -> int:
    """
    Always use the authenticated user's institution.

    A query/body institution_id that differs from the session is rejected.
    Matching or omitted values resolve to the session institution.
    """
    session_institution = current_user.institution_id
    if session_institution is None:
        raise ForbiddenError("User has no institution")
    if requested_institution_id is not None and requested_institution_id != session_institution:
        raise ForbiddenError("Cannot access another institution")
    return int(session_institution)


def assert_same_institution(
    current_user: CurrentUser,
    resource_institution_id: Optional[int],
    *,
    message: str = "Resource belongs to another institution",
) -> None:
    if resource_institution_id is None:
        raise ForbiddenError(message)
    if current_user.institution_id != resource_institution_id:
        raise ForbiddenError(message)


def require_institution_match(
    current_user: CurrentUser,
    resource_institution_id: Optional[int],
) -> None:
    assert_same_institution(current_user, resource_institution_id)
