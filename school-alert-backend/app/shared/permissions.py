"""Granular capabilities independent of role display names."""
from __future__ import annotations

from app.core.config import settings
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole

CASE_VIEW_PROFESSIONAL = "case.view_professional"
CASE_VIEW_INSTITUTIONAL_SUMMARY = "case.view_institutional_summary"
CASE_VIEW_ASSIGNED_ACTIONS = "case.view_assigned_actions"
CASE_VIEW_SENSITIVE_SECTIONS = "case.view_sensitive_sections"
CASE_EMERGENCY_ACCESS = "case.emergency_access"


def _professional_allowlist() -> set[int]:
    raw = (settings.PROFESSIONAL_ACCESS_USER_IDS or "").strip()
    if not raw:
        return set()
    ids: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            ids.add(int(part))
    return ids


def has_capability(user: CurrentUser, capability: str) -> bool:
    role = user.active_role
    allow = _professional_allowlist()

    if capability == CASE_VIEW_PROFESSIONAL:
        if user.id in allow:
            return True
        # administrador does NOT get professional access by default
        return role == UserRole.DECE

    if capability == CASE_VIEW_SENSITIVE_SECTIONS:
        return has_capability(user, CASE_VIEW_PROFESSIONAL)

    if capability == CASE_VIEW_INSTITUTIONAL_SUMMARY:
        return role in {
            UserRole.ADMINISTRADOR,
            UserRole.DECE,
            UserRole.INSPECTOR,
        } or user.id in allow

    if capability == CASE_VIEW_ASSIGNED_ACTIONS:
        return role in {
            UserRole.DECE,
            UserRole.TUTOR,
            UserRole.DOCENTE,
            UserRole.INSPECTOR,
            UserRole.ADMINISTRADOR,
        }

    if capability == CASE_EMERGENCY_ACCESS:
        return user.id in allow or role == UserRole.DECE

    return False
