from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_password_hash
from app.modules.users.domain.username import generate_unique_username
from app.modules.users.infrastructure.models import UserModel, UserRoleAssignmentModel
from app.modules.users.schemas import UserCreate, UserResponse, UserUpdate
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import NotFoundError, ValidationError


class UserService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_users(
        self,
        institution_id: Optional[int] = None,
        role: Optional[UserRole] = None,
    ) -> list[UserResponse]:
        query = select(UserModel).options(selectinload(UserModel.role_assignments))
        if institution_id:
            query = query.where(UserModel.institution_id == institution_id)
        if role:
            query = query.join(UserRoleAssignmentModel).where(
                UserRoleAssignmentModel.role == role
            )
        result = await self.session.execute(
            query.order_by(UserModel.last_name, UserModel.first_name).distinct()
        )
        return [self._to_response(u) for u in result.scalars().all()]

    async def get_user(self, user_id: int) -> UserResponse:
        user = await self._get_user(user_id)
        return self._to_response(user)

    async def create_user(
        self, data: UserCreate, current_user: CurrentUser | None = None
    ) -> UserResponse:
        if not data.national_id:
            raise ValidationError("National ID is required")

        if current_user and current_user.active_role == UserRole.DECE:
            if data.institution_id != current_user.institution_id:
                raise ValidationError("DECE staff can only create users in their institution")
            allowed_roles = {UserRole.REPRESENTANTE}
            if not data.roles or any(role not in allowed_roles for role in data.roles):
                raise ValidationError("DECE staff can only create guardian accounts")

        if data.email:
            existing_email = await self.session.execute(
                select(UserModel).where(UserModel.email == data.email)
            )
            if existing_email.scalar_one_or_none():
                raise ValidationError("Email already registered")

        username = await generate_unique_username(
            self.session, data.first_name, data.last_name
        )

        user = UserModel(
            institution_id=data.institution_id,
            username=username,
            first_name=data.first_name,
            last_name=data.last_name,
            national_id=data.national_id,
            email=data.email,
            password_hash=get_password_hash(data.national_id),
        )
        self.session.add(user)
        await self.session.flush()

        for role in data.roles:
            self.session.add(UserRoleAssignmentModel(user_id=user.id, role=role))

        await self.session.commit()
        return await self.get_user(user.id)

    async def update_user(self, user_id: int, data: UserUpdate) -> UserResponse:
        user = await self._get_user(user_id)
        payload = data.model_dump(exclude_unset=True)

        if "email" in payload and payload["email"] != user.email:
            existing_email = await self.session.execute(
                select(UserModel).where(UserModel.email == payload["email"])
            )
            if existing_email.scalar_one_or_none():
                raise ValidationError("Email already registered")

        roles = payload.pop("roles", None)
        if "password" in payload:
            user.password_hash = get_password_hash(payload.pop("password"))
        elif "national_id" in payload and payload["national_id"]:
            user.password_hash = get_password_hash(payload["national_id"])

        name_changed = "first_name" in payload or "last_name" in payload
        for key, value in payload.items():
            setattr(user, key, value)

        if name_changed:
            user.username = await generate_unique_username(
                self.session,
                user.first_name,
                user.last_name,
                exclude_user_id=user.id,
            )

        if roles is not None:
            user.role_assignments.clear()
            await self.session.flush()
            for role in roles:
                user.role_assignments.append(UserRoleAssignmentModel(role=role))

        await self.session.commit()
        return await self.get_user(user_id)

    async def user_has_role(self, user_id: int, role: UserRole) -> bool:
        user = await self._get_user(user_id)
        return role in user.roles

    async def _get_user(self, user_id: int) -> UserModel:
        result = await self.session.execute(
            select(UserModel)
            .where(UserModel.id == user_id)
            .options(selectinload(UserModel.role_assignments))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User")
        return user

    def _to_response(self, user: UserModel) -> UserResponse:
        return UserResponse(
            id=user.id,
            institution_id=user.institution_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            national_id=user.national_id,
            email=user.email,
            roles=[role.value for role in user.roles],
            status=user.status,
        )
