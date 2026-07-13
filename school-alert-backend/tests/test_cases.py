"""Fase 2 DeceCase / triage / protocol tests."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.cases.application.triage_rules import suggest_triage
from app.shared.enums import RiskLevel, UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.fixture(autouse=True)
def _enable_cases(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", True)


def test_triage_critical_blocks_routine_only_plan():
    s = suggest_triage(
        student_risk=RiskLevel.CRITICO,
        alert_levels=[RiskLevel.CRITICO],
        alert_types=["emocional"],
    )
    assert s.routine_plan_allowed is False
    assert s.protocol_review_required is True


@pytest.mark.asyncio
async def test_case_flag_off_forbidden(
    client: AsyncClient, world: TenantWorld, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", False)
    resp = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_a_id, "title": "Caso prueba", "alert_ids": []},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_and_triage_case(client: AsyncClient, world: TenantWorld):
    resp = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "student_id": world.student_a_id,
            "title": "Caso atención A",
            "opening_summary": "Resumen profesional",
            "alert_ids": [],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "pending_triage"
    assert body["professional_view"] is True
    case_id = body["id"]

    # Admin without allowlist cannot confirm triage (no professional capability)
    deny = await client.post(
        f"/api/v1/cases/{case_id}/triage",
        headers=world.auth(world.admin_a_id, UserRole.ADMINISTRADOR),
        json={
            "routine_plan_allowed": True,
            "protocol_review_required": False,
            "urgency": "normal",
            "outcome": "open",
            "confirm": True,
        },
    )
    assert deny.status_code == 403

    ok = await client.post(
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
    assert ok.status_code == 200
    assert ok.json()["status"] == "open"

    proto = await client.post(
        f"/api/v1/cases/{case_id}/protocols",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"protocol_type": "psychosocial_risk", "reason": "Revisión preventiva"},
    )
    assert proto.status_code == 201
    assert proto.json()["status"] == "reported"

    ref = await client.post(
        f"/api/v1/cases/{case_id}/referrals",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"destination": "Distrito", "reason": "Apoyo externo"},
    )
    assert ref.status_code == 201


@pytest.mark.asyncio
async def test_cross_tenant_case_forbidden(client: AsyncClient, world: TenantWorld):
    created = await client.post(
        "/api/v1/cases",
        headers=world.auth(world.dece_b_id, UserRole.DECE),
        json={"student_id": world.student_b_id, "title": "Caso B", "alert_ids": []},
    )
    assert created.status_code == 201
    case_id = created.json()["id"]
    resp = await client.get(
        f"/api/v1/cases/{case_id}",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 403
