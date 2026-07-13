"""Privacy minimization + AI provider gate."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.rag.application.openrouter import AI_PROVIDER_DISABLED, chat_completion
from app.shared.enums import UserRole
from app.shared.privacy.minimization import make_student_ref
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


def test_p1_student_ref_is_hmac_tenant_scoped():
    a = make_student_ref(institution_id=1, student_id=10, conversation_id="fixed")
    b = make_student_ref(institution_id=2, student_id=10, conversation_id="fixed")
    same = make_student_ref(institution_id=1, student_id=10, conversation_id="fixed")
    assert a.startswith("sref_1_")
    assert b.startswith("sref_2_")
    assert a != b
    assert a == same
    assert "10" not in a.split("_", 2)[-1]  # digest must not be raw id


@pytest.mark.asyncio
async def test_p2_ai_provider_disabled_returns_controlled_error(
    client: AsyncClient, world: TenantWorld, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", False)
    resp = await client.post(
        "/api/v1/rag/query",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "student_id": world.student_a_id,
            "question": "¿Cómo está el rendimiento académico del estudiante?",
            "history": [],
        },
    )
    assert resp.status_code == 503
    assert "deshabilitado" in resp.json()["detail"].lower() or resp.json()["detail"]


@pytest.mark.asyncio
async def test_p3_chat_completion_does_not_call_http_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "AI_PROVIDER_ENABLED", False)
    called = {"n": 0}

    class Boom:
        def __init__(self, *args, **kwargs):
            called["n"] += 1

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            raise AssertionError("must not call OpenRouter")

    monkeypatch.setattr("app.modules.rag.application.openrouter.httpx.AsyncClient", Boom)
    content, tokens, error = await chat_completion([{"role": "user", "content": "hola"}])
    assert content is None
    assert tokens is None
    assert error == AI_PROVIDER_DISABLED
    assert called["n"] == 0
