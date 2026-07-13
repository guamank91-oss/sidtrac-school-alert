from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.users.application.service import UserService
from app.modules.users.schemas import UserCreate, UserResponse, UserUpdate
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for
from app.shared.tenant import assert_same_institution, resolve_institution_id

router = APIRouter()

AdminUser = Depends(require_roles(UserRole.ADMINISTRADOR))
StaffReader = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
GuardianCreator = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


def _handle_domain_error(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("", response_model=list[UserResponse])
async def list_users(
    role: Optional[UserRole] = Query(None),
    institution_id: Optional[int] = Query(None),
    current_user: CurrentUser = StaffReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        inst_id = resolve_institution_id(current_user, institution_id)
        return await UserService(session).list_users(institution_id=inst_id, role=role)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: CurrentUser = StaffReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        user = await UserService(session).get_user(user_id)
        assert_same_institution(current_user, user.institution_id)
        return user
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    data: UserCreate,
    current_user: CurrentUser = GuardianCreator,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await UserService(session).create_user(data, current_user=current_user)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    _: CurrentUser = AdminUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await UserService(session).update_user(user_id, data)
    except DomainError as exc:
        raise _handle_domain_error(exc) from exc
