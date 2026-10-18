from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.audit.application.service import record_audit
from app.modules.reports.application.service import ReportService
from app.modules.reports.schemas import (
    InstitutionalReport,
    PeriodComparison,
    PeriodSummary,
    StudentFullReport,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError

router = APIRouter()

ReportReader = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    status = 404 if exc.code == "not_found" else 400
    return HTTPException(status_code=status, detail=exc.message)


@router.get("/institutional", response_model=InstitutionalReport)
async def institutional_report(
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """RF-48: institutional risk situation report."""
    return await ReportService(session).institutional_report(
        current_user.institution_id, term_id=term_id
    )


@router.get("/period-summary", response_model=PeriodSummary)
async def period_summary(
    term_id: int = Query(...),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """Métricas de un periodo lectivo (filtro por periodo)."""
    try:
        return await ReportService(session).period_summary(
            current_user.institution_id, term_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/period-comparison", response_model=PeriodComparison)
async def period_comparison(
    term_a_id: int = Query(...),
    term_b_id: Optional[int] = Query(None),
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """Comparación estadística entre dos periodos lectivos."""
    try:
        return await ReportService(session).period_comparison(
            current_user.institution_id, term_a_id, term_b_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/students/{student_id}", response_model=StudentFullReport)
async def student_report(
    student_id: int,
    _: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """RF-49: consolidated individual student report."""
    try:
        return await ReportService(session).student_report(student_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/export/{dataset}")
async def export_csv(
    dataset: str,
    current_user: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """RF-50: CSV export (students | alerts | grades | attendance)."""
    try:
        filename, content = await ReportService(session).export_csv(dataset)
    except DomainError as exc:
        raise _handle(exc) from exc
    await record_audit(
        session,
        user_id=current_user.id,
        action="exportacion_csv",
        detail=f"Exportación del dataset {dataset}",
        commit=True,
    )
    return Response(
        content="\ufeff" + content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/action-plans/{plan_id}/pdf-html")
async def get_action_plan_official_pdf_html(
    plan_id: int,
    current_user: CurrentUser = ReportReader,
    session: AsyncSession = Depends(get_db),
):
    """Generate printable HTML/PDF of official DECE Action Plan with institutional header, LOEI articles, and signature blocks."""
    from app.modules.action_plans.infrastructure.models import (
        ActionPlanItemModel,
        ActionPlanModel,
        ActionPlanNormativeRefModel,
    )
    from app.modules.cases.infrastructure.models import DeceCaseModel
    from app.modules.institution.infrastructure.models import CourseModel, InstitutionModel
    from app.modules.normative.infrastructure.models import NormativeArticleModel
    from app.modules.reports.application.pdf_generator import generate_official_action_plan_html
    from app.modules.students.infrastructure.models import StudentModel
    from app.modules.users.infrastructure.models import UserModel
    from sqlalchemy import select

    plan = await session.get(ActionPlanModel, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de acción no encontrado")

    case = await session.get(DeceCaseModel, plan.case_id)
    student = await session.get(StudentModel, case.student_id) if case else None
    institution = await session.get(InstitutionModel, current_user.institution_id) if current_user.institution_id else None
    course = await session.get(CourseModel, student.course_id) if student and student.course_id else None

    items = (
        await session.execute(
            select(ActionPlanItemModel).where(ActionPlanItemModel.plan_id == plan_id)
        )
    ).scalars().all()

    norm_refs = (
        await session.execute(
            select(NormativeArticleModel)
            .join(ActionPlanNormativeRefModel, ActionPlanNormativeRefModel.article_id == NormativeArticleModel.id)
            .where(ActionPlanNormativeRefModel.plan_id == plan_id)
        )
    ).scalars().all()

    user_obj = await session.get(UserModel, current_user.id)
    psychologist_name = f"{user_obj.first_name} {user_obj.last_name}" if user_obj else "Psicólogo DECE"

    html = generate_official_action_plan_html(
        institution_name=institution.name if institution else "UNIDAD EDUCATIVA",
        student_name=f"{student.first_name} {student.last_name}" if student else "Estudiante",
        course_name=course.name if course else "N/A",
        national_id=student.national_id or "" if student else "",
        plan_title=f"Plan de Acción v{plan.version}",
        general_objective=plan.general_objective or "Acompañamiento psicopedagógico integral.",
        tasks=[{"title": item.title, "description": item.description, "responsible_role": item.responsible_role, "status": item.status} for item in items],
        normative_articles=[{"article": art.article, "title": art.title, "body": art.body} for art in norm_refs],
        created_at=plan.created_at,
        psychologist_name=psychologist_name,
    )

    return Response(content=html, media_type="text/html; charset=utf-8")

