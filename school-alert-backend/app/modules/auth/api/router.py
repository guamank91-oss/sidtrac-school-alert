from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.modules.audit.application.service import record_audit
from app.modules.auth.application.service import AuthService
from app.modules.auth.schemas import ChangePasswordRequest, LoginRequest, SelectRoleRequest
from app.shared.exceptions import DomainError

router = APIRouter()


@router.post("/login", response_model=dict)
async def login(data: LoginRequest, request: Request, session: AsyncSession = Depends(get_db)):
    try:
        token, user = await AuthService(session).login(data)
        await record_audit(
            session,
            user_id=user.id,
            action="inicio_sesion",
            detail=f"Inicio de sesión de {user.username}",
            ip_address=request.client.host if request.client else None,
            commit=True,
        )
        return {"token": token, "user": user}
    except DomainError as exc:
        from fastapi import HTTPException

        status_code = 401 if exc.code == "unauthorized" else 400
        raise HTTPException(status_code=status_code, detail=exc.message) from exc


@router.post("/select-role", response_model=dict)
async def select_role(
    data: SelectRoleRequest,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    try:
        token, user = await AuthService(session).select_role(user_id, data)
        return {"token": token, "user": user}
    except DomainError as exc:
        from fastapi import HTTPException

        status_code = 401 if exc.code == "unauthorized" else 400
        raise HTTPException(status_code=status_code, detail=exc.message) from exc


@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    try:
        await AuthService(session).change_password(user_id, data)
        await record_audit(
            session,
            user_id=user_id,
            action="cambio_contrasena",
            detail="El usuario cambió su contraseña",
            ip_address=request.client.host if request.client else None,
            commit=True,
        )
    except DomainError as exc:
        from fastapi import HTTPException

        status_code = 401 if exc.code == "unauthorized" else 400
        raise HTTPException(status_code=status_code, detail=exc.message) from exc
