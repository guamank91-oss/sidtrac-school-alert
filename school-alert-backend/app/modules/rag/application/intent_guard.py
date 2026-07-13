from __future__ import annotations

import re
import unicodedata

# Único atajo determinista: saludos / cortesía puros, sin pregunta.
# Set cerrado y muy frecuente => se resuelve sin gastar una llamada al LLM.
# TODO el resto del control de alcance lo decide el LLM vía header CONTROL.
_GREETING_ONLY = re.compile(
    r"^(?:"
    r"hola+|holaa+|hey+|hi+|hello+|"
    r"buen(?:os|as)\s+(?:d[ií]as|tardes|noches)|"
    r"saludos?|qu[eé]\s+tal|"
    r"gracias|muchas\s+gracias|"
    r"ok(?:ay)?|vale|listo|entendido|"
    r"buenas?"
    r")[\s!.?]*$",
    re.IGNORECASE,
)


def _normalize(text: str) -> str:
    lowered = text.strip().lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", lowered) if unicodedata.category(c) != "Mn"
    )


def classify_question_intent(question: str) -> str:
    """
    Clasificación mínima y barata (solo lo determinista):
      - greeting   -> saludo puro, se responde con plantilla sin LLM.
      - too_vague  -> mensaje vacío.
      - student_query -> TODO lo demás. El alcance real (dentro/fuera) lo
        decide el LLM en el header CONTROL de su respuesta.
    """
    raw = question.strip()
    if not raw:
        return "too_vague"

    if _GREETING_ONLY.match(_normalize(raw)):
        return "greeting"

    return "student_query"


GUARD_RESPONSES: dict[str, str] = {
    "greeting": (
        "Hola. Soy el asistente de análisis del DECE en SIDTRAC.\n\n"
        "Puedo ayudarte con la situación **académica, conductual y emocional** "
        "del estudiante seleccionado. Por ejemplo:\n"
        "- ¿Cuál es su situación actual?\n"
        "- ¿En qué materias tiene más dificultad?\n"
        "- ¿Qué reportes o alertas tiene registrados?\n\n"
        "Usa una pregunta sugerida o escribe tu consulta en español."
    ),
    "off_topic": (
        "Solo puedo responder consultas relacionadas con el **seguimiento del estudiante** "
        "(rendimiento académico, asistencia, conducta, alertas e intervención del DECE).\n\n"
        "Reformula tu pregunta sobre el estudiante seleccionado o elige una de las sugeridas."
    ),
    "too_vague": (
        "Tu mensaje es muy breve o no indica qué aspecto del estudiante quieres analizar.\n\n"
        "Intenta preguntas como:\n"
        "- ¿Cuál es la situación actual de este estudiante?\n"
        "- ¿Qué factores de riesgo presenta?\n"
        "- ¿Qué anotaciones o reportes DECE tiene registrados?"
    ),
}
