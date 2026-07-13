"""Minimize PII before calling external AI providers."""
from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any

from app.core.config import settings


ALLOWED_CONTEXT_CATEGORIES = frozenset(
    {
        "risk_level",
        "grade_averages",
        "attendance_counts",
        "alert_types_levels",
        "report_types_dates",
        "dimension_summary",
        "temporal_note",
        "normative_refs",
    }
)


def make_student_ref(*, institution_id: int, student_id: int, conversation_id: str | None = None) -> str:
    """Opaque per-tenant student reference. Not reversible without server secret."""
    secret = (settings.STUDENT_REF_HMAC_SECRET or settings.SECRET_KEY or "").encode("utf-8")
    if not secret or secret == b"change-me":
        # Force non-trivial secret in production; still avoid raw IDs.
        secret = b"sidtrac-dev-student-ref-secret"
    conv = conversation_id or secrets.token_hex(8)
    msg = f"inst:{institution_id}|stu:{student_id}|conv:{conv}".encode("utf-8")
    digest = hmac.new(secret, msg, hashlib.sha256).hexdigest()[:24]
    return f"sref_{institution_id}_{digest}"


def redact_text(value: str, *, placeholder: str = "[REDACTED]") -> str:
    return placeholder if value else value


def build_minimized_categories(used: list[str]) -> list[str]:
    return [c for c in used if c in ALLOWED_CONTEXT_CATEGORIES]
