"""Sensitive-read audit coverage (PostgreSQL)."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.infrastructure.models import AuditLogModel
from app.shared.audit_actions import STUDENT_PROFILE_VIEWED, STUDENT_TIMELINE_VIEWED
from app.shared.enums import UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_a1_student_profile_view_writes_institution_audit(
    client: AsyncClient, world: TenantWorld, db_session: AsyncSession
):
    resp = await client.get(
        f"/api/v1/students/{world.student_a_id}",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AuditLogModel).where(AuditLogModel.action == STUDENT_PROFILE_VIEWED)
    )
    logs = list(result.scalars().all())
    assert len(logs) >= 1
    log = logs[-1]
    assert log.institution_id == world.institution_a_id
    assert log.scope_type == "institution"
    assert log.entity_id == world.student_a_id


@pytest.mark.asyncio
async def test_a2_timeline_view_writes_audit(
    client: AsyncClient, world: TenantWorld, db_session: AsyncSession
):
    resp = await client.get(
        f"/api/v1/behavioral/students/{world.student_a_id}/timeline",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 200

    result = await db_session.execute(
        select(AuditLogModel).where(AuditLogModel.action == STUDENT_TIMELINE_VIEWED)
    )
    logs = list(result.scalars().all())
    assert len(logs) >= 1
    assert logs[-1].institution_id == world.institution_a_id


@pytest.mark.asyncio
async def test_a3_audit_list_is_tenant_filtered(client: AsyncClient, world: TenantWorld):
    await client.get(
        f"/api/v1/students/{world.student_a_id}",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    # DECE B viewing their student creates their own trail (separate request).
    await client.get(
        f"/api/v1/students/{world.student_b_id}",
        headers=world.auth(world.dece_b_id, UserRole.DECE),
    )

    resp = await client.get(
        "/api/v1/audit/logs",
        params={"action": STUDENT_PROFILE_VIEWED},
        headers=world.auth(world.admin_a_id, UserRole.ADMINISTRADOR),
    )
    assert resp.status_code == 200
    rows = resp.json()
    assert rows
    assert all(r["institution_id"] == world.institution_a_id for r in rows)
    assert all(r["entity_id"] != world.student_b_id for r in rows)
