"""Structured active-plan payload for grounded RAG answers."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.action_plans.infrastructure.models import (
    ActionPlanItemModel,
    ActionPlanModel,
    ActionPlanNoteModel,
)
from app.modules.cases.infrastructure.models import DeceCaseModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.feature_flags import action_plans_enabled


def _fmt_dt(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M")


def _user_name(user: UserModel | None, user_id: int | None) -> Optional[str]:
    if user is not None:
        return f"{user.first_name} {user.last_name}".strip()
    if user_id is not None:
        return f"usuario_id={user_id}"
    return None


NOTE_KIND_LABEL = {
    "progress_report": "reporte_de_avance",
    "validation_approved": "validacion_aprobada",
    "validation_rejected": "validacion_rechazada",
    "manual": "nota_manual",
}

STATUS_LABEL = {
    "pending": "pendiente",
    "in_progress": "en_progreso",
    "reported_completed": "reportada_pendiente_validacion",
    "validated": "validada_aprobada",
}


async def load_active_plan_bundle(
    session: AsyncSession,
    student: StudentModel,
) -> dict[str, Any] | None:
    """Return a JSON-serializable active plan with actions + bitácora, or None."""
    if not action_plans_enabled():
        return {
            "has_active_plan": False,
            "reason": "FEATURE_ACTION_PLANS=false",
        }

    plan_row = await session.execute(
        select(ActionPlanModel)
        .join(DeceCaseModel, DeceCaseModel.id == ActionPlanModel.case_id)
        .where(
            DeceCaseModel.student_id == student.id,
            DeceCaseModel.institution_id == student.institution_id,
            DeceCaseModel.deleted_at.is_(None),
            ActionPlanModel.status == "active",
        )
        .order_by(ActionPlanModel.version.desc(), ActionPlanModel.id.desc())
        .limit(1)
    )
    plan = plan_row.scalar_one_or_none()
    if plan is None:
        draft_row = await session.execute(
            select(ActionPlanModel)
            .join(DeceCaseModel, DeceCaseModel.id == ActionPlanModel.case_id)
            .where(
                DeceCaseModel.student_id == student.id,
                DeceCaseModel.institution_id == student.institution_id,
                DeceCaseModel.deleted_at.is_(None),
                ActionPlanModel.status.in_(("draft", "pending_approval")),
            )
            .order_by(ActionPlanModel.id.desc())
            .limit(1)
        )
        draft = draft_row.scalar_one_or_none()
        if draft is None:
            return {"has_active_plan": False, "reason": "no_active_or_draft_plan"}
        return {
            "has_active_plan": False,
            "draft": {
                "id": draft.id,
                "status": draft.status,
                "version": draft.version,
                "objective": draft.general_objective,
            },
        }

    creator = await session.get(UserModel, plan.created_by)
    approver = (
        await session.get(UserModel, plan.approved_by) if plan.approved_by else None
    )

    items = list(
        (
            await session.execute(
                select(ActionPlanItemModel)
                .where(ActionPlanItemModel.plan_id == plan.id)
                .order_by(ActionPlanItemModel.priority)
            )
        )
        .scalars()
        .all()
    )
    notes = list(
        (
            await session.execute(
                select(ActionPlanNoteModel)
                .where(ActionPlanNoteModel.plan_id == plan.id)
                .order_by(ActionPlanNoteModel.created_at.asc(), ActionPlanNoteModel.id.asc())
            )
        )
        .scalars()
        .all()
    )

    author_ids = {n.author_id for n in notes}
    authors: dict[int, str] = {}
    for uid in author_ids:
        user = await session.get(UserModel, uid)
        authors[uid] = _user_name(user, uid) or f"usuario_id={uid}"

    notes_by_item: dict[int | None, list[ActionPlanNoteModel]] = {}
    for note in notes:
        notes_by_item.setdefault(note.item_id, []).append(note)

    counts = {"pending": 0, "in_progress": 0, "reported_completed": 0, "validated": 0}
    actions: list[dict[str, Any]] = []
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1
        item_notes = notes_by_item.get(item.id) or []
        reports = []
        validations = []
        other_notes = []
        for note in item_notes:
            entry = {
                "kind": NOTE_KIND_LABEL.get(note.note_kind or "", note.note_kind or "nota"),
                "author": authors.get(note.author_id, f"usuario_id={note.author_id}"),
                "at": _fmt_dt(note.created_at),
                "text": (note.text or "").strip(),
            }
            if note.note_kind == "progress_report":
                reports.append(entry)
            elif note.note_kind in {"validation_approved", "validation_rejected"}:
                validations.append(entry)
            else:
                other_notes.append(entry)

        latest_report = reports[-1] if reports else None
        latest_validation = validations[-1] if validations else None
        actions.append(
            {
                "item_id": item.id,
                "title": item.title,
                "objective": item.objective,
                "status": item.status,
                "status_label": STATUS_LABEL.get(item.status, item.status),
                "priority": item.priority,
                "responsible_role": item.responsible_role,
                "due_hint": item.due_hint,
                "due_at": item.due_at.date().isoformat() if item.due_at else None,
                "progress_pct_validated": item.progress_pct_validated,
                "reported_by": latest_report["author"] if latest_report else None,
                "reported_at": latest_report["at"] if latest_report else None,
                "report_text": latest_report["text"] if latest_report else None,
                "validated_by": latest_validation["author"] if latest_validation else None,
                "validated_at": latest_validation["at"] if latest_validation else None,
                "validation_text": latest_validation["text"] if latest_validation else None,
                "validation_kind": latest_validation["kind"] if latest_validation else None,
                "reports": reports,
                "validations": validations,
                "other_notes": other_notes,
            }
        )

    general_notes = []
    for note in notes_by_item.get(None) or []:
        general_notes.append(
            {
                "kind": NOTE_KIND_LABEL.get(note.note_kind or "", note.note_kind or "nota"),
                "author": authors.get(note.author_id, f"usuario_id={note.author_id}"),
                "at": _fmt_dt(note.created_at),
                "text": (note.text or "").strip(),
            }
        )

    return {
        "has_active_plan": True,
        "plan": {
            "id": plan.id,
            "case_id": plan.case_id,
            "version": plan.version,
            "type": plan.plan_type,
            "status": plan.status,
            "objective": plan.general_objective,
            "review_at_hint": plan.review_at_hint,
            "created_by": _user_name(creator, plan.created_by),
            "created_at": _fmt_dt(plan.created_at),
            "approved_by": _user_name(approver, plan.approved_by),
            "approved_at": _fmt_dt(plan.approved_at),
            "approval_comment": plan.approval_comment,
        },
        "summary": {
            "pending": counts.get("pending", 0),
            "in_progress": counts.get("in_progress", 0),
            "reported_awaiting_validation": counts.get("reported_completed", 0),
            "validated": counts.get("validated", 0),
            "total_actions": len(actions),
        },
        "actions": actions,
        "general_notes": general_notes,
    }
