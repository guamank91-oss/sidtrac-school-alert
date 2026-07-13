"""Deterministic triage suggestions (AI assist is optional later; human must confirm)."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.shared.enums import RiskLevel


@dataclass
class TriageSuggestion:
    routine_plan_allowed: bool = True
    protocol_review_required: bool = False
    protocol_type: str | None = None
    urgency: str = "normal"
    flags: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


def suggest_triage(
    *,
    student_risk: RiskLevel,
    alert_levels: list[RiskLevel],
    alert_types: list[str],
) -> TriageSuggestion:
    suggestion = TriageSuggestion()
    levels = list(alert_levels)
    if student_risk:
        levels.append(student_risk)

    if any(level == RiskLevel.CRITICO for level in levels):
        suggestion.routine_plan_allowed = False
        suggestion.protocol_review_required = True
        suggestion.protocol_type = "psychosocial_risk"
        suggestion.urgency = "critical"
        suggestion.flags.append("critical_risk")
        suggestion.reasons.append("Nivel crítico en alerta o semáforo del estudiante")

    emotional = {"emocional", "EMOCIONAL", "alerta_emocional"}
    if any(t.lower() in emotional or t == "emocional" for t in alert_types):
        suggestion.protocol_review_required = True
        suggestion.protocol_type = suggestion.protocol_type or "violence_or_psychosocial"
        suggestion.flags.append("emotional_alert")
        suggestion.reasons.append("Alerta/reporte de tipo emocional")
        if suggestion.urgency == "normal":
            suggestion.urgency = "high"
        # emotional alone does not forbid a plan, but plan cannot be the only path if protocol required
        if suggestion.protocol_review_required:
            suggestion.routine_plan_allowed = False
            suggestion.reasons.append(
                "routine_plan_allowed=false: el plan no puede ser la única actuación"
            )

    if any(level == RiskLevel.ALTO for level in levels) and suggestion.urgency == "normal":
        suggestion.urgency = "high"
        suggestion.flags.append("high_risk")
        suggestion.reasons.append("Nivel alto detectado")

    return suggestion
