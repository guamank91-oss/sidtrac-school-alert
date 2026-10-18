"""Granular capabilities independent of role display names."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.audit.application.service import record_audit
from app.shared.audit_actions import BREAK_GLASS_USED
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import ForbiddenError
from app.shared.feature_flags import action_plans_enabled, dece_cases_enabled

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
        } or user.id in allow

    if capability == CASE_VIEW_ASSIGNED_ACTIONS:
        return role in {
            UserRole.DECE,
            UserRole.TUTOR,
            UserRole.DOCENTE,
            UserRole.ADMINISTRADOR,
        }

    if capability == CASE_EMERGENCY_ACCESS:
        return user.id in allow or role == UserRole.DECE

    return False


def require_capability(user: CurrentUser, capability: str) -> None:
    if not has_capability(user, capability):
        raise ForbiddenError(f"Missing capability: {capability}")


def require_dece_cases_enabled() -> None:
    if not dece_cases_enabled():
        raise ForbiddenError("FEATURE_DECE_CASES is disabled")


def require_action_plans_enabled() -> None:
    if not action_plans_enabled():
        raise ForbiddenError("FEATURE_ACTION_PLANS is disabled")


async def request_break_glass(
    session: AsyncSession,
    *,
    current_user: CurrentUser,
    entity_type: str,
    entity_id: int,
    reason: str,
) -> None:
    """Stub for emergency access. Fase 0 only audits; no domain unlock yet."""
    require_capability(current_user, CASE_EMERGENCY_ACCESS)
    await record_audit(
        session,
        user_id=current_user.id,
        institution_id=current_user.institution_id,
        scope_type="institution",
        action=BREAK_GLASS_USED,
        entity_type=entity_type,
        entity_id=entity_id,
        detail="break_glass_used",
        categories='["break_glass"]',
        reason=reason,
        commit=True,
    )
