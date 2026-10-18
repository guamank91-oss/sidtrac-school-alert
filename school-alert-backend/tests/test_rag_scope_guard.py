from app.modules.rag.application.intent_guard import classify_question_intent
from app.modules.rag.application.service import RagService


def test_attendance_question_reaches_model():
    q = "reporte de asistencia por asignatura de esta estudiante"
    assert classify_question_intent(q) == "student_query"


def test_novel_phrasing_still_student_query():
    # No keyword list: unknown wording must not be pre-rejected.
    q = "cómo viene el compromiso escolar en aula y ausentismo reciente"
    assert classify_question_intent(q) == "student_query"


def test_greeting_still_short_circuits():
    assert classify_question_intent("hola") == "greeting"


def test_parse_control_risk_only_header():
    scope, risk = RagService._parse_control("CONTROL: riesgo=medio")
    assert scope == "dentro"
    assert risk == "medio"


def test_strip_legacy_fuera_marker_leaves_empty_for_fallback():
    cleaned = RagService._strip_control_line(
        "CONTROL: alcance=fuera; riesgo=bajo\n[FUERA_DE_ALCANCE]"
    )
    assert cleaned == ""
