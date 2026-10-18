"""Fase 4 generation tests."""
from __future__ import annotations

import json

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.normative.application.seed import seed_rgloei
from app.modules.normative.seed_data import chunk_id
from app.modules.rag.application.openrouter import AI_PROVIDER_DISABLED
from app.shared.enums import UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    await seed_rgloei(db_session, index_chroma=False)
    return await seed_tenant_world(db_session)


@pytest.fixture(autouse=True)
def _flags(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", True)
    monkeypatch.setattr(settings, "FEATURE_ACTION_PLANS", True)


@pytest.mark.asyncio
async def test_generate_disabled_ai(client: AsyncClient, world: TenantWorld, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", False)
    case = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Gen", "alert_ids": []},
    )
    case_id = case.json()["id"]
    resp = await client.post(
        "/api/v1/action-plans/generate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"case_id": case_id},
    )
    assert resp.status_code == 503
    assert "deshabilitado" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_requires_ai_no_local_fallback(client: AsyncClient, world: TenantWorld, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", True)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "fake")

    async def _fake_chat(*args, **kwargs):
        return None, None, "network down"

    monkeypatch.setattr(
        "app.modules.action_plans.application.generate.chat_completion", _fake_chat
    )
    case = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Gen2", "alert_ids": []},
    )
    case_id = case.json()["id"]
    resp = await client.post(
        "/api/v1/action-plans/generate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"case_id": case_id},
    )
    assert resp.status_code == 503, resp.text
    assert "ia" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_generate_accepts_markdown_fenced_ai_json(client: AsyncClient, world: TenantWorld, monkeypatch):
    """Reproduces the real OpenRouter behavior: gpt-4o-mini wraps its JSON reply in a
    ```json fenced block even when told to answer with JSON only. That must not surface
    as a 503 to the DECE user when the fenced payload otherwise matches the schema."""
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", True)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "fake")

    fenced = """```json
{
  "triage": {"urgency": "high"},
  "assessment": {"situation_summary": "Resumen de prueba"},
  "plan": {"general_objective": "Objetivo de prueba"},
  "actions": [{"title": "Accion 1", "objective": "Objetivo 1"}],
  "normative_references": []
}
```"""

    async def _fake_chat(*args, **kwargs):
        return fenced, 123, None

    monkeypatch.setattr(
        "app.modules.action_plans.application.generate.chat_completion", _fake_chat
    )
    case = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Gen3", "alert_ids": []},
    )
    case_id = case.json()["id"]
    resp = await client.post(
        "/api/v1/action-plans/generate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"case_id": case_id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["triage"]["urgency"] == "high"
    assert body["plan"]["general_objective"] == "Objetivo de prueba"
    assert body["draft_origin"] == "ai"


@pytest.mark.asyncio
async def test_generate_backfills_lazy_or_empty_ai_sections(
    client: AsyncClient, world: TenantWorld, monkeypatch
):
    """The model reliably leaves risk_factors/protective_factors/missing_information/
    limitations as [] and the triage risk sub-fields as the literal string "none" unless
    backstopped. None of those may reach the DECE user empty or as "none"."""
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", True)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "fake")

    sparse = {
        "triage": {
            "urgency": "critical",
            "immediate_integrity_risk": "none",
            "violence_presumption": "none",
            "self_harm_risk": "none",
            "rights_violation": "none",
            "repeated_absences": "none",
            "urgent_protocol_needed": "none",
        },
        "assessment": {
            "situation_summary": "Resumen de prueba",
            "risk_factors": [],
            "protective_factors": [],
            "missing_information": [],
        },
        "plan": {"general_objective": "Objetivo de prueba", "limitations": []},
        "actions": [{"title": "Accion 1", "objective": "Objetivo 1"}],
        "normative_references": [],
    }

    async def _fake_chat(*args, **kwargs):
        return json.dumps(sparse), 123, None

    monkeypatch.setattr(
        "app.modules.action_plans.application.generate.chat_completion", _fake_chat
    )
    case = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Gen4", "alert_ids": []},
    )
    case_id = case.json()["id"]
    resp = await client.post(
        "/api/v1/action-plans/generate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"case_id": case_id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    for field in (
        "immediate_integrity_risk",
        "violence_presumption",
        "self_harm_risk",
        "rights_violation",
        "repeated_absences",
        "urgent_protocol_needed",
    ):
        assert body["triage"][field].strip().lower() != "none"
        assert body["triage"][field] != ""
    assert body["assessment"]["risk_factors"]
    assert body["assessment"]["protective_factors"]
    assert body["assessment"]["missing_information"]
    assert body["plan"]["limitations"]


@pytest.mark.asyncio
async def test_generate_reconciles_normative_reference_with_authoritative_data(
    client: AsyncClient, world: TenantWorld, monkeypatch
):
    """The model may cite a real source_chunk_id but paraphrase (or hallucinate) the
    surrounding document_name/article_title/version/date. Those must be replaced with
    the authoritative seeded record, never trust the model's own copy."""
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", True)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "fake")

    real_chunk_id = chunk_id("32")
    payload = {
        "triage": {"urgency": "high"},
        "assessment": {"situation_summary": "Resumen de prueba"},
        "plan": {"general_objective": "Objetivo de prueba"},
        "actions": [{"title": "Accion 1", "objective": "Objetivo 1"}],
        "normative_references": [
            {
                "document_code": "MADE-UP",
                "document_name": "Documento inventado por el modelo",
                "version": "v0",
                "article": "32",
                "article_title": "Titulo incorrecto inventado",
                "effective_from": "2000-01-01",
                "source_chunk_id": real_chunk_id,
            },
            {
                "document_code": "MADE-UP",
                "document_name": "Documento inventado",
                "version": "v0",
                "article": "999",
                "article_title": "Articulo que no existe",
                "effective_from": "2000-01-01",
                "source_chunk_id": "not-a-real-chunk-id",
            },
        ],
    }

    async def _fake_chat(*args, **kwargs):
        return json.dumps(payload), 123, None

    monkeypatch.setattr(
        "app.modules.action_plans.application.generate.chat_completion", _fake_chat
    )
    case = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Gen5", "alert_ids": []},
    )
    case_id = case.json()["id"]
    resp = await client.post(
        "/api/v1/action-plans/generate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"case_id": case_id},
    )
    assert resp.status_code == 200, resp.text
    refs = resp.json()["normative_references"]
    assert len(refs) == 1, refs
    assert refs[0]["source_chunk_id"] == real_chunk_id
    assert refs[0]["article_title"] == "Refuerzo pedagógico"
    assert refs[0]["document_name"] != "Documento inventado por el modelo"
