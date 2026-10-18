"""Smoke test: mitigación semáforo + no duplicar alertas tras atender."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as resp:
        return json.loads(resp.read())


def main() -> None:
    login = req("POST", "/auth/login", {"username": "sadmin", "password": "admin123"})
    token = login["token"]["access_token"]
    if login["user"].get("requires_role_selection"):
        sel = req("POST", "/auth/select-role", {"role": "dece"}, token=token)
        token = sel["token"]["access_token"]

    students = req("GET", "/students", token=token)
    margarita = next(s for s in students if "Margarita" in s["first_name"])
    sid = margarita["id"]
    print(f"Margarita id={sid} riesgo={margarita['current_risk_level']}")

    alerts_before = req("GET", "/alerts", token=token)
    marg_alerts = [a for a in alerts_before if a["student_id"] == sid]
    active = [a for a in marg_alerts if a["status"] == "activa"]
    print(f"Alertas Margarita: total={len(marg_alerts)} activas={len(active)}")

    eval1 = req("POST", "/alerts/evaluate", {}, token=token)
    print(f"Evaluar 1: creadas={eval1['alerts_created']}")

    alerts_mid = req("GET", "/alerts", token=token)
    active2 = [a for a in alerts_mid if a["student_id"] == sid and a["status"] == "activa"]
    print(f"Activas tras eval 1: {len(active2)}")

    if active2:
        aid = active2[0]["id"]
        req(
            "POST",
            f"/alerts/{aid}/attend",
            {"actions_taken": "Se citó al representante y se programó entrevista DECE."},
            token=token,
        )
        print(f"Atendida alerta {aid}")

    student = next(s for s in req("GET", "/students", token=token) if s["id"] == sid)
    print(f"Riesgo tras atender: {student['current_risk_level']}")

    eval2 = req("POST", "/alerts/evaluate", {}, token=token)
    print(f"Evaluar 2: creadas={eval2['alerts_created']}")

    alerts_after = req("GET", "/alerts", token=token)
    active3 = [a for a in alerts_after if a["student_id"] == sid and a["status"] == "activa"]
    print(f"Activas tras eval 2: {len(active3)} (esperado 0)")
    student2 = next(s for s in req("GET", "/students", token=token) if s["id"] == sid)
    print(f"Riesgo final: {student2['current_risk_level']} (esperado alto si era critico)")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        print("HTTP", exc.code, exc.read().decode())
