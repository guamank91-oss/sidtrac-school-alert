"""Typed RAG intents: classification + block filtering."""
from __future__ import annotations

import pytest

from app.modules.rag.application.intent import (
    ContextBlock,
    RagIntent,
    assemble_context_for_intent,
    classify_intent,
    parse_structured_blocks,
    policy_for,
    score_intent,
    sticky_intent_from_history,
)


SAMPLE_STRUCTURED = """Fecha de hoy: 2026-07-14
--- DATOS ACADÉMICOS Y ASISTENCIA (PostgreSQL) ---
Promedio general: 8.00/10
Asistencia últimos 30 días: 0 ausencias
--- ACCIONES EJECUTADAS (intervenciones DECE efectivamente realizadas = alertas atendidas; no confundir) ---
  - Alerta media atendida el 2026-06-28: Se citó al representante
--- PLAN DE ATENCIÓN ACTIVO (ActionPlan versionado; no inventar acciones ni artículos) ---
  - HAY PLAN ACTIVO EN MARCHA: id=1
  - RESUMEN DE AVANCE DEL PLAN: pendientes=5; reportadas=0; validadas_aprobadas=0
    · Acción del plan [pending = pendiente (no reportada)] p1: Entrevistar al estudiante
--- REPORTES DECE (EVIDENCIA) ---
  - Reporte DECE [seguimiento]
--- ANOTACIONES TUTOR (PostgreSQL) ---
  - Anotación tutor
--- RESUMEN POR DIMENSIÓN (clasificar el caso) ---
Académico: estable
--- NOTA COMPARATIVA TEMPORAL (leer antes de afirmar mejora/empeoramiento/estabilidad) ---
Sin contraste suficiente
--- CRONOLOGÍA UNIFICADA (más reciente primero; usa esto para preguntas de tiempo/tendencia) ---
2026-06-28 | alerta atendida
"""


def test_parse_and_filter_blocks_for_plan_progress():
    blocks = parse_structured_blocks(SAMPLE_STRUCTURED)
    assert ContextBlock.ACTIVE_PLAN in blocks
    assert ContextBlock.ALERT_ACTIONS in blocks
    filtered = assemble_context_for_intent(blocks, RagIntent.PLAN_PROGRESS)
    assert "HAY PLAN ACTIVO" in filtered
    assert "RESUMEN DE AVANCE" in filtered
    assert "ACCIONES EJECUTADAS" not in filtered
    assert "Se citó al representante" not in filtered


def test_score_intent_plan_vs_alerts():
    intent, score = score_intent(
        "del plan de accion que acciones ya fueron reportadas como aprobadas?"
    )
    assert intent == RagIntent.PLAN_PROGRESS
    assert score > 0

    intent2, _ = score_intent("Cuáles son las acciones ejecutadas?")
    assert intent2 == RagIntent.ALERT_ACTIONS


@pytest.mark.asyncio
async def test_sticky_follow_up_uses_plan_progress():
    history = [
        {
            "role": "assistant",
            "content": (
                "El plan de acción incluye: Entrevistar al estudiante (3 días lectivos); "
                "Convocar al representante (5 días lectivos)."
            ),
        }
    ]
    sticky = sticky_intent_from_history(history)
    assert sticky == RagIntent.ACTIVE_PLAN

    intent = await classify_intent(
        "cuáles de esas acciones ya están reportadas o aprobadas?",
        history,
        use_llm=False,
    )
    assert intent == RagIntent.PLAN_PROGRESS


def test_policy_plan_progress_forbids_alert_block():
    policy = policy_for(RagIntent.PLAN_PROGRESS)
    assert ContextBlock.ACTIVE_PLAN in policy.blocks
    assert ContextBlock.ALERT_ACTIONS not in policy.blocks
    assert policy.allows_recommendations is False


def test_who_is_tutor_does_not_score_as_tutor_notes():
    intent, score = score_intent("dime quien es su tutor")
    assert intent != RagIntent.TUTOR_NOTES or score == 0


def test_tutor_annotations_still_score_tutor_notes():
    intent, _ = score_intent("cuales son las anotaciones del tutor?")
    assert intent == RagIntent.TUTOR_NOTES
