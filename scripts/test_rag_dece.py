"""Batería RAG — perspectiva DECE (Margarita Monroy o primer estudiante)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail}") from exc


def main() -> int:
    login = req("POST", "/auth/login", {"username": "sadmin", "password": "admin123"})
    token = login["token"]["access_token"]
    user = login["user"]
    if user.get("requires_role_selection"):
        sel = req("POST", "/auth/select-role", {"role": "dece"}, token=token)
        token = sel["token"]["access_token"]

    students = req("GET", "/students", token=token)
    margarita = next(
        (
            s
            for s in students
            if "Margarita" in s.get("first_name", "") or "Monroy" in s.get("last_name", "")
        ),
        None,
    )
    student = margarita or (students[0] if students else None)
    if not student:
        print("No hay estudiantes en BD")
        return 1

    sid = student["id"]
    name = f"{student['first_name']} {student['last_name']}"
    print(f"Estudiante: {name} (id={sid})")
    print(f"Riesgo BD: {student.get('current_risk_level')}")
    print("=" * 70)

    questions = [
        ("A1/ERS", "¿Cuál es la situación actual de este estudiante?"),
        ("D1/ERS", "¿Ha mostrado algún cambio emocional en las últimas semanas?"),
        ("E1/ERS", "¿Qué factores de riesgo tiene y qué tan urgentes son?"),
        ("C2/ERS", "¿Cuáles son las materias donde tiene más problemas de asistencia?"),
        ("D6/ERS", "¿Qué acciones del DECE se han tomado con él o ella hasta ahora?"),
        ("E5/ERS", "¿Existe riesgo de deserción? ¿Qué recomiendas hacer?"),
        ("F1", "¿Qué recomiendas hacer esta semana con este estudiante?"),
        ("H1", "¿Y en asistencia qué tal?"),
        ("I1", "Hola"),
        ("I4", "¿Este estudiante tiene depresión?"),
    ]

    history: list[dict[str, str]] = []
    for code, question in questions:
        res = req(
            "POST",
            "/rag/query",
            {"student_id": sid, "question": question, "history": history[-6:]},
            token=token,
        )
        lat = res.get("latency_ms", 0)
        sources = res.get("sources") or []
        answer = res.get("answer", "")

        print(f"\n### [{code}] {question}")
        print(
            f"Latencia: {lat}ms | LLM: {res.get('used_llm')} | "
            f"Intent: {res.get('intent')} | Riesgo detectado: {res.get('detected_risk_level')}"
        )
        print(f"Fuentes ({len(sources)}): {sources if sources else 'ninguna'}")
        print("Respuesta:")
        print(answer[:1500] + ("..." if len(answer) > 1500 else ""))
        print("-" * 70)

        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": answer})
        time.sleep(0.5)

    return 0


if __name__ == "__main__":
    sys.exit(main())
