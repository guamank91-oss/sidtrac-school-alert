"""Fase 3 action plan lifecycle tests."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.shared.enums import UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.fixture(autouse=True)
def _flags(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", True)
    monkeypatch.setattr(settings, "FEATURE_ACTION_PLANS", True)


async def _open_case(client: AsyncClient, world: TenantWorld) -> int:
    resp = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Caso plan", "alert_ids": []},
    )
    assert resp.status_code == 201
    case_id = resp.json()["id"]
    tri = await client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "routine_plan_allowed": True,
            "protocol_review_required": False,
            "urgency": "normal",
            "outcome": "open",
            "confirm": True,
        },
    )
    assert tri.status_code == 200
    return case_id


@pytest.mark.asyncio
async def test_plan_version_approve_and_validate(client: AsyncClient, world: TenantWorld):
    case_id = await _open_case(client, world)
    create = await client.post(
        "/api/v1/action-plans",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "case_id": case_id,
            "general_objective": "Mejorar asistencia y bienestar",
            "items": [
                {
                    "title": "Entrevista DECE",
                    "objective": "Recoger información",
                    "responsible_role": "dece",
                    "priority": 1,
                }
            ],
            "normative_references": [
                {
                    "document_code": "RLOEI-DE-675",
                    "version": "Decreto Ejecutivo 675",
                    "article": "32",
                    "article_title": "Refuerzo pedagógico",
                    "effective_from": "2023-02-22",
                    "source_chunk_id": "norm:RLOEI-DE-675:32",
                }
            ],
        },
    )
    assert create.status_code == 201, create.text
    plan_id = create.json()["id"]
    item_id = create.json()["items"][0]["id"]

    submit = await client.post(
        f"/api/v1/action-plans/{plan_id}/submit",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "pending_approval"

    approve = await client.post(
        f"/api/v1/action-plans/{plan_id}/approve",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"comment": "OK"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "active"

    # reported_completed != validated
    progress = await client.post(
        f"/api/v1/action-plans/{plan_id}/items/{item_id}/progress",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"note": "Hecho"},
    )
    assert progress.status_code == 200
    assert progress.json()["items"][0]["status"] == "reported_completed"
    assert progress.json()["validated_progress_pct"] == 0

    validated = await client.post(
        f"/api/v1/action-plans/{plan_id}/items/{item_id}/validate",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"approved": True},
    )
    assert validated.status_code == 200
    assert validated.json()["items"][0]["status"] == "validated"
    assert validated.json()["validated_progress_pct"] == 100

    evid = await client.post(
        f"/api/v1/action-plans/{plan_id}/evidence",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "item_id": item_id,
            "filename": "acta.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 1024,
            "checksum_sha256": "a" * 64,
            "object_key": f"inst/{world.institution_a_id}/plans/{plan_id}/acta.pdf",
        },
    )
    assert evid.status_code == 201
