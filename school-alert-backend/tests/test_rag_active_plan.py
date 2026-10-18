"""Fase 6: active plan appears in RAG structured context."""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.action_plans.infrastructure.models import (
    ActionPlanItemModel,
    ActionPlanModel,
    ActionPlanNoteModel,
)
from app.modules.cases.infrastructure.models import DeceCaseModel
from app.modules.rag.application.service import RagService
from app.modules.students.infrastructure.models import StudentModel
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_structured_context_includes_active_plan(
    db_session: AsyncSession, world: TenantWorld, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "FEATURE_ACTION_PLANS", True)
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", True)

    case = DeceCaseModel(
        institution_id=world.institution_a_id,
        student_id=world.student_a_id,
        status="open",
        title="Caso RAG",
        opened_by=world.dece_a_id,
    )
    db_session.add(case)
    await db_session.flush()
    plan = ActionPlanModel(
        institution_id=world.institution_a_id,
        case_id=case.id,
        plan_type="psychosocial_attention_followup",
        version=1,
        status="active",
        general_objective="Mejorar asistencia con seguimiento DECE",
        created_by=world.dece_a_id,
        approved_by=world.dece_a_id,
    )
    db_session.add(plan)
    await db_session.flush()
    item = ActionPlanItemModel(
        plan_id=plan.id,
        title="Entrevista seguimiento",
        objective="Recoger factores de protección",
        responsible_role="dece",
        status="validated",
        priority=1,
        progress_pct_validated=100,
    )
    db_session.add(item)
    await db_session.flush()
    db_session.add(
        ActionPlanNoteModel(
            plan_id=plan.id,
            item_id=item.id,
            author_id=world.tutor_a_id,
            visibility_scope="professional",
            note_kind="progress_report",
            text="Seguimiento semanal realizado en aula",
        )
    )
    db_session.add(
        ActionPlanNoteModel(
            plan_id=plan.id,
            item_id=item.id,
            author_id=world.dece_a_id,
            visibility_scope="professional",
            note_kind="validation_approved",
            text="Validado con evidencia de tutor",
        )
    )
    await db_session.commit()

    student = await db_session.get(StudentModel, world.student_a_id)
    assert student is not None
    ctx = await RagService(db_session)._structured_context(student)
    assert "PLAN DE ATENCIÓN ACTIVO" in ctx
    assert "HAY PLAN ACTIVO EN MARCHA" in ctx
    assert "RESUMEN DE AVANCE DEL PLAN" in ctx
    assert "Mejorar asistencia" in ctx
    assert "Entrevista seguimiento" in ctx
    assert "validated" in ctx
    assert "reporte_de_avance" in ctx
    assert "validacion_aprobada" in ctx
    assert "Seguimiento semanal realizado" in ctx


@pytest.mark.asyncio
async def test_structured_context_finds_active_plan_even_if_case_not_open(
    db_session: AsyncSession, world: TenantWorld, monkeypatch: pytest.MonkeyPatch
):
    """Regression: RAG used to require case status open/under_assessment."""
    monkeypatch.setattr(settings, "FEATURE_ACTION_PLANS", True)
    monkeypatch.setattr(settings, "FEATURE_DECE_CASES", True)

    case = DeceCaseModel(
        institution_id=world.institution_a_id,
        student_id=world.student_a_id,
        status="pending_triage",
        title="Caso con plan activo",
        opened_by=world.dece_a_id,
    )
    db_session.add(case)
    await db_session.flush()
    db_session.add(
        ActionPlanModel(
            institution_id=world.institution_a_id,
            case_id=case.id,
            plan_type="psychosocial_attention_followup",
            version=1,
            status="active",
            general_objective="Plan activo con caso en pending_triage",
            created_by=world.dece_a_id,
        )
    )
    await db_session.commit()

    student = await db_session.get(StudentModel, world.student_a_id)
    assert student is not None
    ctx = await RagService(db_session)._structured_context(student)
    assert "HAY PLAN ACTIVO EN MARCHA" in ctx
    assert "Plan activo con caso en pending_triage" in ctx
    assert "No hay plan de atención activo" not in ctx
