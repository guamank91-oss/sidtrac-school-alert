"""Curated RGLOEI (Decreto Ejecutivo 675) article seed for SIDTRAC.

Provenance: titles and SIDTRAC usage axes follow product-approved diagnostic
(2026-07-13). Body text is operational paraphrase for retrieval; checksum covers
this seed payload. Before production go-live, replace/augment with verbatim text
from the official Ministerio PDF and update `SOURCE_URL` + checksum.

Articles 330–331 MUST NOT be treated as disciplinary faults.
LOEI fault articles are intentionally omitted until verified official text exists.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date

DOCUMENT_CODE = "RLOEI-DE-675"
DOCUMENT_NAME = (
    "Reglamento General a la Ley Orgánica de Educación Intercultural"
)
DOCUMENT_TYPE = "reglamento"
VERSION_LABEL = "Decreto Ejecutivo 675"
EFFECTIVE_FROM = date(2023, 2, 22)
SOURCE_URL = (
    "https://www.educacion.gob.ec/ — verificar PDF oficial Decreto Ejecutivo 675"
)

# (article, title, sidtrac_axis, usage_notes, body)
ARTICLES: list[tuple[str, str, str, str, str]] = [
    (
        "32",
        "Refuerzo pedagógico",
        "academic",
        "Usar en planes/dimensión académica; no es falta disciplinaria.",
        "El refuerzo pedagógico comprende acciones de apoyo educativo para "
        "estudiantes con rezago o dificultades de aprendizaje, orientadas a "
        "recuperar aprendizajes y prevenir exclusión escolar. En SIDTRAC se "
        "invoca como base de planes de atención en la dimensión académica.",
    ),
    (
        "171",
        "Inasistencia",
        "attendance",
        "Seguimiento de asistencia; vinculable a alertas de asistencia.",
        "Regula el control y seguimiento de la inasistencia de estudiantes. "
        "Sustenta actuaciones de prevención y seguimiento cuando el ausentismo "
        "compromete la continuidad educativa.",
    ),
    (
        "172",
        "Prohibición de ausencia una vez iniciadas las clases",
        "attendance",
        "Complementa 171; no tipifica sanción automática vía IA.",
        "Prohíbe ausentarse una vez iniciadas las clases, con el objeto de "
        "proteger el tiempo pedagógico. En SIDTRAC orienta seguimiento de "
        "asistencia temprana, sin sustituir el procedimiento disciplinario.",
    ),
    (
        "330",
        "Sensibilización y formación continua",
        "protection_awareness",
        "NO es tipificación de faltas ni Junta Distrital. Sensibilización/formación.",
        "Dispone sensibilización y formación continua en materia de derechos y "
        "protección. No constituye catálogo de faltas ni procedimiento sancionatorio.",
    ),
    (
        "331",
        "Actores responsables de la protección de derechos",
        "protection_actors",
        "NO es tipificación de faltas. Define roles de protección.",
        "Identifica actores responsables de la protección de derechos de niñas, "
        "niños y adolescentes en el sistema educativo. No tipifica faltas.",
    ),
    (
        "332",
        "Atención y seguimiento",
        "psychosocial_attention",
        "Atención/seguimiento DECE; base de planes de atención.",
        "Orienta la atención y el seguimiento a situaciones que afectan derechos "
        "y bienestar estudiantil, incluyendo actuaciones del DECE y derivaciones "
        "cuando corresponda.",
    ),
    (
        "333",
        "Derivaciones",
        "referral",
        "Base de ExternalReferral; sin integración automática en v1.",
        "Regula derivaciones a instancias competentes cuando la atención "
        "institucional no es suficiente. En SIDTRAC sustenta el registro manual "
        "de ExternalReferral.",
    ),
    (
        "364",
        "Procedimiento disciplinario — marco (inicio)",
        "disciplinary_procedure",
        "Procedimiento; no inventar faltas LOEI desde este artículo solo.",
        "Inicia el marco del procedimiento disciplinario aplicable a "
        "estudiantes. Debe citarse junto con 365–369 y, si aplica, LOEI vigente "
        "verificada para tipicidad de faltas.",
    ),
    (
        "365",
        "Procedimiento disciplinario",
        "disciplinary_procedure",
        "Parte de la serie 364–369.",
        "Desarrolla el procedimiento disciplinario estudiantil. SIDTRAC no debe "
        "presentar recomendaciones DECE como sanción disciplinaria automática.",
    ),
    (
        "366",
        "Procedimiento disciplinario",
        "disciplinary_procedure",
        "Parte de la serie 364–369.",
        "Continúa el procedimiento disciplinario. Requiere confirmación "
        "profesional; no automatizar sanciones vía IA.",
    ),
    (
        "367",
        "Procedimiento disciplinario",
        "disciplinary_procedure",
        "Parte de la serie 364–369.",
        "Continúa garantías y secuencia del procedimiento disciplinario.",
    ),
    (
        "368",
        "Procedimiento disciplinario",
        "disciplinary_procedure",
        "Parte de la serie 364–369.",
        "Continúa el procedimiento disciplinario estudiantil.",
    ),
    (
        "369",
        "Procedimiento disciplinario — cierre de serie",
        "disciplinary_procedure",
        "Cierra serie 364–369 en el seed SIDTRAC.",
        "Cierra el bloque reglamentario del procedimiento disciplinario "
        "estudiantil en este seed. Validar texto oficial antes de go-live.",
    ),
]


def chunk_id(article: str) -> str:
    return f"norm:{DOCUMENT_CODE}:{article}"


def seed_payload_checksum() -> str:
    payload = {
        "document_code": DOCUMENT_CODE,
        "version": VERSION_LABEL,
        "effective_from": EFFECTIVE_FROM.isoformat(),
        "articles": [
            {"article": a, "title": t, "axis": ax, "body": b} for a, t, ax, _, b in ARTICLES
        ],
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()
