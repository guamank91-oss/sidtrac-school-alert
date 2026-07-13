"""Feature flags for DECE case/plan module (off by default in Fase 0)."""
from __future__ import annotations

from app.core.config import settings


def dece_cases_enabled() -> bool:
    return bool(settings.FEATURE_DECE_CASES)


def action_plans_enabled() -> bool:
    return bool(settings.FEATURE_ACTION_PLANS)
