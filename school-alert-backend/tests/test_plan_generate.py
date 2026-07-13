"""Fase 4 generation tests."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.normative.application.seed import seed_rgloei
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
async def test_generate_local_fallback_json(client: AsyncClient, world: TenantWorld, monkeypatch):
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
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "triage" in body and "plan" in body and "actions" in body
    assert body["assessment"]["situation_summary"]
    assert all("source_chunk_id" in r for r in body["normative_references"])
    # does not persist: listing plans empty is implicit (no create called)
