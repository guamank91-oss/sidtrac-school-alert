"""Active plan JSON bundle for grounded answers."""
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
from app.modules.rag.application.intent import INTENT_CONFIDENCE_FLOOR, RagIntent
from app.modules.rag.application.plan_context import load_active_plan_bundle
from app.modules.students.infrastructure.models import StudentModel
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_load_active_plan_bundle_includes_report_and_validation(
    db_session: AsyncSession, world: TenantWorld, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(settings, "FEATURE_ACTION_PLANS", True)

    case = DeceCaseModel(
        institution_id=world.institution_a_id,
        student_id=world.student_a_id,
        status="open",
        title="Caso JSON",
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
        general_objective="Continuidad educativa",
        created_by=world.dece_a_id,
        approved_by=world.dece_a_id,
    )
    db_session.add(plan)
    await db_session.flush()
    item = ActionPlanItemModel(
        plan_id=plan.id,
        title="Realizar seguimiento semanal de asistencia",
        objective="Monitorear asistencia",
        responsible_role="tutor",
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
            text="Seguimiento hecho el lunes",
        )
    )
    db_session.add(
        ActionPlanNoteModel(
            plan_id=plan.id,
            item_id=item.id,
            author_id=world.dece_a_id,
            visibility_scope="professional",
            note_kind="validation_approved",
            text="Aprobado con evidencia",
        )
    )
    await db_session.commit()

    student = await db_session.get(StudentModel, world.student_a_id)
    assert student is not None
    bundle = await load_active_plan_bundle(db_session, student)
    assert bundle is not None
    assert bundle["has_active_plan"] is True
    assert bundle["summary"]["validated"] == 1
    action = bundle["actions"][0]
    assert action["title"].startswith("Realizar seguimiento")
    assert action["reported_by"]
    assert action["report_text"] == "Seguimiento hecho el lunes"
    assert action["validated_by"]
    assert action["validation_text"] == "Aprobado con evidencia"


def test_confidence_floor_constant():
    assert 0.0 < INTENT_CONFIDENCE_FLOOR < 1.0
    assert RagIntent.GENERAL.value == "general"
