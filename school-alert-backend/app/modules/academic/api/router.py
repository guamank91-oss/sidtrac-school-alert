from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.academic.application.service import AcademicService
from app.modules.academic.schemas import (
    AssignmentResponse,
    AttendanceBulkRequest,
    AttendanceRosterRow,
    GradeBulkRequest,
    GradeRosterRow,
    StudentAcademicProfile,
    StudentAcademicSummary,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

AcademicReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.DOCENTE,
    )
)
AcademicWriter = Depends(require_roles(UserRole.DOCENTE))
OverviewReader = Depends(
    require_roles(UserRole.ADMINISTRADOR, UserRole.DECE, UserRole.TUTOR)
)
ProfileReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.REPRESENTANTE,
    )
)


def _handle_domain_error(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("/assignments", response_model=list[AssignmentResponse])
async def list_assignments(
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = AcademicReader,
    session: AsyncSession = Depends(get_db),
):
    return await AcademicService(session).list_assignments(current_user, term_id=term_id)


@router.get("/grades/roster", response_model=list[GradeRosterRow])
async def grade_roster(
    course_subject_id: int = Query(...),
    quarter: int = Query(..., ge=1, le=2),
    partial: int = Query(..., ge=1, le=3),
    current_user: CurrentUser = AcademicReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).grade_roster(
            current_user, course_subject_id, quarter, partial
        )
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/grades/bulk", response_model=list[GradeRosterRow])
async def save_grades(
    data: GradeBulkRequest,
    current_user: CurrentUser = AcademicWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).save_grades(current_user, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/attendance/roster", response_model=list[AttendanceRosterRow])
async def attendance_roster(
    course_subject_id: int = Query(...),
    attendance_date: date = Query(...),
    current_user: CurrentUser = AcademicReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).attendance_roster(
            current_user, course_subject_id, attendance_date
        )
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/attendance/bulk", response_model=list[AttendanceRosterRow])
async def save_attendance(
    data: AttendanceBulkRequest,
    current_user: CurrentUser = AcademicWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).save_attendance(current_user, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/overview", response_model=list[StudentAcademicSummary])
async def academic_overview(
    course_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = OverviewReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).student_summaries(
            current_user, course_id, term_id=term_id
        )
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/students/{student_id}/profile", response_model=StudentAcademicProfile)
async def student_academic_profile(
    student_id: int,
    current_user: CurrentUser = ProfileReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await AcademicService(session).student_academic_profile(
            current_user, student_id
        )
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc
