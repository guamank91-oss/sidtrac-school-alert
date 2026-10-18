"""Intent classification + typed context blocks for RAG.

Design:
- Context is produced once as named blocks.
- Each intent declares which blocks may enter the LLM prompt.
- Classification prefers a tiny LLM JSON call; falls back to history stickiness
  and a small scored registry (data, not open-coded if-chains in the service).
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ContextBlock(str, Enum):
    META = "meta"
    ACADEMIC = "academic"
    ALERT_ACTIONS = "alert_actions"
    ACTIVE_PLAN = "active_plan"
    DECE_REPORTS = "dece_reports"
    TUTOR_NOTES = "tutor_notes"
    DIMENSIONS = "dimensions"
    TEMPORAL = "temporal"
    TIMELINE = "timeline"


class RagIntent(str, Enum):
    ACTIVE_PLAN = "active_plan"
    PLAN_PROGRESS = "plan_progress"
    ALERT_ACTIONS = "alert_actions"
    ACADEMIC = "academic"
    ATTENDANCE = "attendance"
    TUTOR_NOTES = "tutor_notes"
    DECE_REPORTS = "dece_reports"
    DISCIPLINARY = "disciplinary"
    RISK_OVERVIEW = "risk_overview"
    OPERATIONAL = "operational"
    TEMPORAL = "temporal"
    GENERAL = "general"


ALL_BLOCKS: tuple[ContextBlock, ...] = tuple(ContextBlock)


@dataclass(frozen=True)
class IntentPolicy:
    blocks: tuple[ContextBlock, ...]
    instruction: str
    allows_recommendations: bool = False


INTENT_POLICIES: dict[RagIntent, IntentPolicy] = {
    RagIntent.ACTIVE_PLAN: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.ACTIVE_PLAN, ContextBlock.DIMENSIONS),
        instruction=(
            "Pregunta por el PLAN DE ATENCIÓN / PLAN DE ACCIÓN. "
            "Usa SOLO el JSON DATOS_ESTRUCTURADOS_JSON si está presente (fuente de verdad). "
            "Informa completo: objetivo, creador/activador, acciones con estado, plazos, "
            "reported_by/reported_at/report_text y validated_by/validated_at/validation_text. "
            "Si un campo es null, di que no consta. "
            "PROHIBIDO usar alertas atendidas como si fueran el plan."
        ),
    ),
    RagIntent.PLAN_PROGRESS: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.ACTIVE_PLAN),
        instruction=(
            "Pregunta de avance/trazabilidad del plan (reportadas, validadas, quién, cuándo). "
            "Usa SOLO el JSON DATOS_ESTRUCTURADOS_JSON. "
            "Para 'quién reportó X': busca en actions[] el title coincidente y usa "
            "reported_by / reported_at / report_text (o reports[]). "
            "Para validación: validated_by / validated_at / validation_text. "
            "Si null, di explícitamente que no consta en bitácora. No inventes personas ni fechas."
        ),
    ),
    RagIntent.ALERT_ACTIONS: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.ALERT_ACTIONS, ContextBlock.TIMELINE),
        instruction=(
            "Pregunta por intervenciones ya realizadas (alertas atendidas / ACCIONES EJECUTADAS). "
            "Enumera solo ese bloque, con fecha. No lo llames plan de atención."
        ),
    ),
    RagIntent.ACADEMIC: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.ACADEMIC, ContextBlock.DIMENSIONS),
        instruction="Responde con datos académicos (promedios, materias) del bloque ACADEMIC.",
    ),
    RagIntent.ATTENDANCE: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.ACADEMIC, ContextBlock.DIMENSIONS, ContextBlock.TEMPORAL),
        instruction="Responde con asistencia (30 días / por asignatura). No inventes causas.",
    ),
    RagIntent.TUTOR_NOTES: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.TUTOR_NOTES, ContextBlock.TIMELINE),
        instruction=(
            "Pregunta sobre ANOTACIONES escritas por el tutor (bitácora), NO sobre quién es "
            "el tutor del curso. La identidad del tutor de curso está en DATOS_FICHA_JSON. "
            "Enumera fecha, tipo y texto de anotaciones. "
            "No respondas con promedios ni calificaciones."
        ),
    ),
    RagIntent.DECE_REPORTS: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.DECE_REPORTS, ContextBlock.TIMELINE),
        instruction=(
            "Pregunta sobre reportes DECE. Son evidencia; el 'plan=' del reporte es propuesto, "
            "no necesariamente ejecutado, y no equivale al ActionPlan activo."
        ),
    ),
    RagIntent.DISCIPLINARY: IntentPolicy(
        blocks=(ContextBlock.META, ContextBlock.DECE_REPORTS, ContextBlock.TUTOR_NOTES, ContextBlock.TIMELINE),
        instruction=(
            "Pregunta sobre conflictos, agresividad o incumplimiento. "
            "Usa solo lo documentado en reportes/disciplinarios/anotaciones."
        ),
    ),
    RagIntent.RISK_OVERVIEW: IntentPolicy(
        blocks=(
            ContextBlock.META,
            ContextBlock.ACADEMIC,
            ContextBlock.ACTIVE_PLAN,
            ContextBlock.ALERT_ACTIONS,
            ContextBlock.DIMENSIONS,
            ContextBlock.TEMPORAL,
        ),
        instruction=(
            "Panorama de riesgo/caso. Sintetiza por dimensión con fechas. "
            "Si hay plan activo, menciónalo aparte de alertas atendidas."
        ),
    ),
    RagIntent.OPERATIONAL: IntentPolicy(
        blocks=ALL_BLOCKS,
        instruction=(
            "Pregunta operativa (qué hacer / priorizar). Usa evidencia y, si existe, el plan activo "
            "antes de inventar pasos. No recomiendes lo que ya consta hecho o agendado."
        ),
        allows_recommendations=True,
    ),
    RagIntent.TEMPORAL: IntentPolicy(
        blocks=(
            ContextBlock.META,
            ContextBlock.TEMPORAL,
            ContextBlock.TIMELINE,
            ContextBlock.ALERT_ACTIONS,
            ContextBlock.ACTIVE_PLAN,
        ),
        instruction=(
            "Pregunta temporal/tendencia. Usa NOTA COMPARATIVA y CRONOLOGÍA. "
            "Sin evidencia antes/después, no afirmes mejora ni empeoramiento."
        ),
    ),
    RagIntent.GENERAL: IntentPolicy(
        blocks=ALL_BLOCKS,
        instruction=(
            "Pregunta general sobre el expediente. Usa los bloques disponibles sin inventar. "
            "Distingue plan activo vs alertas atendidas vs reportes."
        ),
    ),
}


# Header prefixes as emitted by RagService._structured_context
_BLOCK_HEADER_MAP: list[tuple[str, ContextBlock]] = [
    ("--- DATOS ACADÉMICOS Y ASISTENCIA", ContextBlock.ACADEMIC),
    ("--- ACCIONES EJECUTADAS", ContextBlock.ALERT_ACTIONS),
    ("--- PLAN DE ATENCIÓN ACTIVO", ContextBlock.ACTIVE_PLAN),
    ("--- REPORTES DECE", ContextBlock.DECE_REPORTS),
    ("--- ANOTACIONES TUTOR", ContextBlock.TUTOR_NOTES),
    ("--- RESUMEN POR DIMENSIÓN", ContextBlock.DIMENSIONS),
    ("--- NOTA COMPARATIVA TEMPORAL", ContextBlock.TEMPORAL),
    ("--- CRONOLOGÍA UNIFICADA", ContextBlock.TIMELINE),
]


def parse_structured_blocks(structured_text: str) -> dict[ContextBlock, str]:
    """Split the monolith structured context into typed blocks by section headers."""
    blocks: dict[ContextBlock, list[str]] = {b: [] for b in ContextBlock}
    current = ContextBlock.META
    for raw in structured_text.splitlines():
        line = raw.rstrip()
        matched = False
        for prefix, block in _BLOCK_HEADER_MAP:
            if line.startswith(prefix):
                current = block
                blocks[current].append(line)
                matched = True
                break
        if not matched:
            blocks[current].append(line)
    return {k: "\n".join(v).strip() for k, v in blocks.items() if any(x.strip() for x in v)}


def assemble_context_for_intent(
    blocks: dict[ContextBlock, str],
    intent: RagIntent,
) -> str:
    policy = INTENT_POLICIES[intent]
    parts: list[str] = []
    for block in policy.blocks:
        text = blocks.get(block)
        if text:
            parts.append(text)
    if not parts:
        # Safety: never send an empty knowledge base
        return "\n\n".join(t for t in blocks.values() if t)
    return "\n\n".join(parts)


def policy_for(intent: RagIntent) -> IntentPolicy:
    return INTENT_POLICIES.get(intent, INTENT_POLICIES[RagIntent.GENERAL])


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

_FOLLOW_UP_CUES = (
    r"\besas\b",
    r"\besos\b",
    r"\bde esas\b",
    r"\bcu[aá]les\b",
    r"\bcu[aá]l\b",
    r"\by eso\b",
    r"\bdetalla\b",
    r"\benumera",
    r"\bdel plan\b",
    r"\bya (fueron|est[aá]n|son)\b",
    r"\breportad",
    r"\baprobad",
    r"\bvalidad",
    r"\bpendiente",
    r"\bvigente",
    r"\bcubiert",
)

_STICKY_PLAN_MARKERS = (
    "plan de accion",
    "plan de atencion",
    "dias lectivos",
    "acciones operativas",
    "proxima revision",
    "hay plan activo",
    "entrevistar al estudiante",
    "convocar al representante",
)

# Sparse scored cues — extensible registry, not business logic in the service.
_SCORE_CUES: dict[RagIntent, tuple[str, ...]] = {
    RagIntent.PLAN_PROGRESS: (
        "reportad",
        "aprobad",
        "validad",
        "pendiente",
        "en progreso",
        "vigente",
        "vigencia",
        "cubiert",
        "cumplid",
        "avance del plan",
        "estado de las acciones",
        "ya fueron",
        "acciones del plan",
        "quien report",
        "quien valid",
        "quien la report",
        "quien lo report",
        "bitacora",
    ),
    RagIntent.ACTIVE_PLAN: (
        "plan de accion",
        "plan de atencion",
        "action plan",
        "cual es el plan",
        "que plan tiene",
    ),
    RagIntent.ALERT_ACTIONS: (
        "acciones ejecutadas",
        "alerta atendida",
        "alertas atendidas",
        "se cito al representante",
        "intervenciones realizadas",
        "ya se hizo",
        "ya realizaron",
    ),
    RagIntent.ACADEMIC: (
        "promedio",
        "calificaci",
        "materia",
        "nota ",
        "notas",
        "rendimiento",
    ),
    RagIntent.ATTENDANCE: (
        "asistencia",
        "ausencia",
        "faltas",
        "tardanza",
        "inasistencia",
    ),
    RagIntent.TUTOR_NOTES: (
        "anotacion",
        "anotaciones",
        "anotaciones del tutor",
        "anotacion del tutor",
        "nota del tutor",
        "notas del tutor",
        "seguimiento tutor",
    ),
    RagIntent.DECE_REPORTS: (
        "reporte dece",
        "reportes dece",
        "reportes del dece",
    ),
    RagIntent.DISCIPLINARY: (
        "agresiv",
        "bullying",
        "conflicto",
        "pelea",
        "violencia",
        "disciplinar",
    ),
    RagIntent.RISK_OVERVIEW: (
        "riesgo",
        "semaforo",
        "panorama",
        "situacion integral",
        "resumen del caso",
        "alertas activas",
        "alerta activa",
        "tipo de caso",
        "por dimension",
        "mixto",
    ),
    RagIntent.OPERATIONAL: (
        "que hago",
        "que hacer",
        "recomiend",
        "sugier",
        "siguiente paso",
        "proximo paso",
        "prioriz",
        "como intervengo",
    ),
    RagIntent.TEMPORAL: (
        "ultimas semanas",
        "hace 3",
        "hace 4",
        "tendencia",
        "ha cambiado",
        "evolucion",
        "hace dias",
        "empeor",
        "mejor",
        "comparado con",
        "contraste",
    ),
}


def _normalize(text: str) -> str:
    t = (text or "").strip().lower()
    t = (
        t.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ü", "u")
        .replace("ñ", "n")
    )
    return re.sub(r"\s+", " ", t)


def _looks_like_follow_up(question: str) -> bool:
    q = _normalize(question)
    return any(re.search(pat, q) for pat in _FOLLOW_UP_CUES)


def sticky_intent_from_history(history: list[dict] | None) -> RagIntent | None:
    """If recent assistant turn was about the plan, keep plan-related intents sticky."""
    if not history:
        return None
    for msg in reversed(history[-6:]):
        role = (msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", "")) or ""
        content = (msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")) or ""
        if role != "assistant":
            continue
        c = _normalize(content)
        if any(m in c for m in _STICKY_PLAN_MARKERS):
            return RagIntent.ACTIVE_PLAN
        break
    return None


def score_intent(question: str) -> tuple[RagIntent, int]:
    q = _normalize(question)
    best = RagIntent.GENERAL
    best_score = 0
    for intent, cues in _SCORE_CUES.items():
        score = sum(1 for cue in cues if cue in q)
        # Prefer more specific plan progress over generic active plan
        if intent == RagIntent.PLAN_PROGRESS and score:
            score += 1
        if score > best_score:
            best, best_score = intent, score
    return best, best_score


_INTENT_CATALOG = "\n".join(
    f"- {intent.value}: {INTENT_POLICIES[intent].instruction.split('.')[0]}."
    for intent in RagIntent
)


async def classify_intent_llm(
    question: str, history: list[dict] | None
) -> tuple[RagIntent, float] | None:
    """Tiny JSON classifier. Returns (intent, confidence) or None if unavailable."""
    from app.modules.rag.application.openrouter import chat_completion

    hist_bits: list[str] = []
    for msg in (history or [])[-4:]:
        role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", "")
        content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")
        if not content:
            continue
        hist_bits.append(f"{role}: {str(content)[:280]}")
    hist_txt = "\n".join(hist_bits) if hist_bits else "(sin historial)"

    messages = [
        {
            "role": "system",
            "content": (
                "Clasifica la intención del profesional DECE sobre un estudiante. "
                "Responde SOLO JSON válido: "
                '{"intent":"<id>","confidence":<0.0-1.0>}. '
                "confidence alta (>=0.7) solo si estás seguro; si hay duda usa confidence baja. "
                "Ids permitidos:\n"
                f"{_INTENT_CATALOG}\n"
                "Si es seguimiento ('esas acciones', reportadas/aprobadas, quién reportó) "
                "tras hablar del plan, usa plan_progress. No inventes otros ids."
            ),
        },
        {
            "role": "user",
            "content": f"HISTORIAL:\n{hist_txt}\n\nPREGUNTA:\n{question}",
        },
    ]
    content, _tokens, err = await chat_completion(
        messages, temperature=0.0, max_tokens=60, timeout=12.0
    )
    if err or not content:
        logger.info("Intent LLM unavailable: %s", err)
        return None
    raw = content.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.I | re.M).strip()
    try:
        data = json.loads(raw)
        value = str(data.get("intent", "")).strip()
        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
        return RagIntent(value), confidence
    except Exception:
        cleaned = raw.strip().strip('"').lower()
        try:
            return RagIntent(cleaned), 0.4
        except ValueError:
            logger.warning("Intent LLM returned unusable payload: %s", content[:120])
            return None


# Below this confidence, prefer GENERAL (broader context) over a narrow wrong cut.
INTENT_CONFIDENCE_FLOOR = 0.55


async def classify_intent(
    question: str,
    history: list[dict] | None = None,
    *,
    use_llm: bool = True,
) -> RagIntent:
    """Resolve intent: sticky follow-up → LLM(+confidence) → scored registry → general."""
    sticky = sticky_intent_from_history(history)
    if sticky is not None and _looks_like_follow_up(question):
        q = _normalize(question)
        if any(c in q for c in _SCORE_CUES[RagIntent.PLAN_PROGRESS]):
            return RagIntent.PLAN_PROGRESS
        if sticky == RagIntent.ACTIVE_PLAN:
            return RagIntent.PLAN_PROGRESS if any(
                c in q
                for c in (
                    "accion",
                    "acciones",
                    "esas",
                    "cual",
                    "reportad",
                    "aprobad",
                    "validad",
                    "vigente",
                    "cubiert",
                    "quien",
                )
            ) else sticky

    if use_llm:
        llm_result = await classify_intent_llm(question, history)
        if llm_result is not None:
            intent, confidence = llm_result
            if confidence < INTENT_CONFIDENCE_FLOOR:
                logger.info(
                    "Intent %s confidence %.2f < %.2f → GENERAL",
                    intent.value,
                    confidence,
                    INTENT_CONFIDENCE_FLOOR,
                )
                return RagIntent.GENERAL
            return intent

    scored, score = score_intent(question)
    if score > 0:
        return scored
    if sticky is not None:
        return sticky
    return RagIntent.GENERAL
