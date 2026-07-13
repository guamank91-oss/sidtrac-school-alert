from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.institution.application.service import InstitutionService
from app.modules.institution.schemas import (
    AcademicTermCreate,
    AcademicTermResponse,
    AcademicTermUpdate,
    CourseCreate,
    CourseResponse,
    CourseSubjectCreate,
    CourseSubjectResponse,
    CourseSubjectUpdate,
    CourseUpdate,
    InstitutionCreate,
    InstitutionResponse,
    InstitutionUpdate,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for
from app.shared.tenant import resolve_institution_id

router = APIRouter()


def _handle_domain_error(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


def _svc(session: AsyncSession = Depends(get_db)) -> InstitutionService:
    return InstitutionService(session)


AdminUser = Depends(require_roles(UserRole.ADMINISTRADOR))
StaffReader = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


@router.get("/health")
async def institution_health():
    return {"module": "institution", "status": "ready"}


@router.get("/institutions", response_model=list[InstitutionResponse])
async def list_institutions(
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    return await svc.list_institutions()


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: int,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.get_institution(institution_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/institutions", response_model=InstitutionResponse, status_code=201)
async def create_institution(
    data: InstitutionCreate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.create_institution(data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: int,
    data: InstitutionUpdate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.update_institution(institution_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/terms", response_model=list[AcademicTermResponse])
async def list_terms(
    institution_id: Optional[int] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    svc: InstitutionService = Depends(_svc),
):
    try:
        inst_id = resolve_institution_id(current_user, institution_id)
        return await svc.list_terms(inst_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/terms", response_model=AcademicTermResponse, status_code=201)
async def create_term(
    data: AcademicTermCreate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.create_term(data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/terms/{term_id}", response_model=AcademicTermResponse)
async def update_term(
    term_id: int,
    data: AcademicTermUpdate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.update_term(term_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/terms/{term_id}/activate", response_model=AcademicTermResponse)
async def activate_term(
    term_id: int,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.activate_term(term_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(
    institution_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = StaffReader,
    svc: InstitutionService = Depends(_svc),
):
    try:
        inst_id = resolve_institution_id(current_user, institution_id)
        return await svc.list_courses(inst_id, term_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/courses", response_model=CourseResponse, status_code=201)
async def create_course(
    data: CourseCreate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.create_course(data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    data: CourseUpdate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.update_course(course_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(
    course_id: int,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        await svc.delete_course(course_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/subjects", response_model=list[SubjectResponse])
async def list_subjects(
    institution_id: Optional[int] = Query(None),
    current_user: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        inst_id = resolve_institution_id(current_user, institution_id)
        return await svc.list_subjects(inst_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/subjects", response_model=SubjectResponse, status_code=201)
async def create_subject(
    data: SubjectCreate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.create_subject(data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.update_subject(subject_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: int,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        await svc.delete_subject(subject_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/course-subjects", response_model=list[CourseSubjectResponse])
async def list_course_subjects(
    course_id: Optional[int] = Query(None),
    institution_id: Optional[int] = Query(None),
    current_user: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        inst_id = resolve_institution_id(current_user, institution_id)
        return await svc.list_course_subjects(course_id, inst_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("/course-subjects", response_model=CourseSubjectResponse, status_code=201)
async def create_course_subject(
    data: CourseSubjectCreate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.create_course_subject(data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/course-subjects/{assignment_id}", response_model=CourseSubjectResponse)
async def update_course_subject(
    assignment_id: int,
    data: CourseSubjectUpdate,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        return await svc.update_course_subject(assignment_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.delete("/course-subjects/{assignment_id}", status_code=204)
async def delete_course_subject(
    assignment_id: int,
    _: CurrentUser = AdminUser,
    svc: InstitutionService = Depends(_svc),
):
    try:
        await svc.delete_course_subject(assignment_id)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc
