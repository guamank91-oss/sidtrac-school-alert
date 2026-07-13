from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.shared.enums import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class SelectRoleRequest(BaseModel):
    role: UserRole


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserAuthResponse(BaseModel):
    id: int
    institution_id: int
    username: str
    first_name: str
    last_name: str
    email: Optional[str]
    roles: list[str]
    active_role: Optional[str] = None
    requires_role_selection: bool = False
