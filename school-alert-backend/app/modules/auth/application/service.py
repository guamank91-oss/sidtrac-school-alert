from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, get_password_hash, verify_password
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    SelectRoleRequest,
    TokenResponse,
    UserAuthResponse,
)
from app.modules.users.infrastructure.models import UserModel
from app.shared.enums import UserRole, UserStatus
from app.shared.exceptions import UnauthorizedError, ValidationError


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def login(self, data: LoginRequest) -> tuple[TokenResponse, UserAuthResponse]:
        result = await self.session.execute(
            select(UserModel)
            .where(UserModel.username == data.username.strip().lower())
            .options(selectinload(UserModel.role_assignments))
        )
        user = result.scalar_one_or_none()

        if user is None or not verify_password(data.password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")

        if user.status != UserStatus.ACTIVO:
            raise ValidationError("Account is deactivated")

        roles = user.roles
        if not roles:
            raise ValidationError("User has no roles assigned")

        role_values = [role.value for role in roles]
        requires_selection = len(roles) > 1
        active_role = roles[0].value if len(roles) == 1 else None
        token = create_access_token(
            user.id,
            role=active_role,
        )

        return (
            TokenResponse(access_token=token),
            UserAuthResponse(
                id=user.id,
                institution_id=user.institution_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                roles=role_values,
                active_role=active_role,
                requires_role_selection=requires_selection,
            ),
        )

    async def select_role(
        self, user_id: int, data: SelectRoleRequest
    ) -> tuple[TokenResponse, UserAuthResponse]:
        result = await self.session.execute(
            select(UserModel)
            .where(UserModel.id == user_id)
            .options(selectinload(UserModel.role_assignments))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise UnauthorizedError("User not found")

        if data.role not in user.roles:
            raise ValidationError("Role not assigned to this user")

        token = create_access_token(user.id, role=data.role.value)
        return (
            TokenResponse(access_token=token),
            UserAuthResponse(
                id=user.id,
                institution_id=user.institution_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                roles=[role.value for role in user.roles],
                active_role=data.role.value,
                requires_role_selection=False,
            ),
        )

    async def change_password(self, user_id: int, data: ChangePasswordRequest) -> None:
        user = await self.session.get(UserModel, user_id)
        if user is None:
            raise UnauthorizedError("User not found")
        if not verify_password(data.current_password, user.password_hash):
            raise ValidationError("La contraseña actual es incorrecta")
        if verify_password(data.new_password, user.password_hash):
            raise ValidationError("La nueva contraseña debe ser distinta de la actual")
        user.password_hash = get_password_hash(data.new_password)
        await self.session.commit()
