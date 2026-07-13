"""T1–T12 style institution isolation tests against PostgreSQL."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.enums import UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_t1_dece_a_cannot_get_student_b(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        f"/api/v1/students/{world.student_b_id}",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t2_query_institution_id_cannot_switch_tenant(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        "/api/v1/students",
        params={"institution_id": world.institution_b_id, "term_id": world.term_a_id},
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t8_admin_a_cannot_get_student_b(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        f"/api/v1/students/{world.student_b_id}",
        headers=world.auth(world.admin_a_id, UserRole.ADMINISTRADOR),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t9_tutor_cannot_view_unassigned_student(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        f"/api/v1/students/{world.student_a_other_id}",
        headers=world.auth(world.tutor_a_id, UserRole.TUTOR),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t10_guardian_cannot_view_other_student(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        f"/api/v1/students/{world.student_a_other_id}",
        headers=world.auth(world.guardian_a_id, UserRole.REPRESENTANTE),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t11_list_students_never_includes_other_tenant(
    client: AsyncClient, world: TenantWorld
):
    resp = await client.get(
        "/api/v1/students",
        params={"term_id": world.term_a_id},
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.json()}
    assert world.student_a_id in ids
    assert world.student_b_id not in ids


@pytest.mark.asyncio
async def test_t12_body_institution_id_cannot_override_on_create(
    client: AsyncClient, world: TenantWorld
):
    resp = await client.post(
        "/api/v1/students",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={
            "institution_id": world.institution_b_id,
            "course_id": world.course_a_id,
            "first_name": "X",
            "last_name": "Y",
            "national_id": "1999999999",
            "guardian_id": world.guardian_a_id,
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_t3_rag_cross_tenant_forbidden(client: AsyncClient, world: TenantWorld):
    resp = await client.post(
        "/api/v1/rag/query",
        headers=world.auth(world.dece_a_id, UserRole.DECE),
        json={"student_id": world.student_b_id, "question": "¿Cuál es el riesgo?", "history": []},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_users_rejects_foreign_institution_query(
    client: AsyncClient, world: TenantWorld
):
    resp = await client.get(
        "/api/v1/users",
        params={"institution_id": world.institution_b_id},
        headers=world.auth(world.admin_a_id, UserRole.ADMINISTRADOR),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_tutor_can_view_assigned_student(client: AsyncClient, world: TenantWorld):
    resp = await client.get(
        f"/api/v1/students/{world.student_a_id}",
        headers=world.auth(world.tutor_a_id, UserRole.TUTOR),
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == world.student_a_id
