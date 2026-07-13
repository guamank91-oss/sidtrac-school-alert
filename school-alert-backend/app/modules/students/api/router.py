from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.students.application.service import StudentService
from app.modules.students.schemas import StudentCreate, StudentResponse, StudentUpdate
from app.shared.auth_context import CurrentUser
from app.shared.enums import RiskLevel, StudentStatus, UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

StudentReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.INSPECTOR,
        UserRole.REPRESENTANTE,
    )
)
StudentManager = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


def _handle_domain_error(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("", response_model=list[StudentResponse])
async def list_students(
    institution_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    risk_level: Optional[RiskLevel] = Query(None),
    status: Optional[StudentStatus] = Query(None),
    current_user: CurrentUser = StudentReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await StudentService(session).list_students(
            current_user=current_user,
            institution_id=institution_id,
            course_id=course_id,
            term_id=term_id,
            search=search,
            risk_level=risk_level,
            status=status,
        )
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: int,
    current_user: CurrentUser = StudentReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await StudentService(session).get_student(student_id, current_user)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    data: StudentCreate,
    current_user: CurrentUser = StudentManager,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await StudentService(session).create_student(data, current_user)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    current_user: CurrentUser = StudentManager,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await StudentService(session).update_student(student_id, data, current_user)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc
