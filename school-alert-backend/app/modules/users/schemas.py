from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.shared.enums import UserRole, UserStatus

STAFF_ROLES = {
    UserRole.DECE,
    UserRole.TUTOR,
    UserRole.DOCENTE,
    UserRole.INSPECTOR,
    UserRole.REPRESENTANTE,
}


class UserCreate(BaseModel):
    institution_id: int
    first_name: str
    last_name: str
    national_id: str = Field(min_length=5)
    roles: list[UserRole] = Field(min_length=1)
    email: Optional[EmailStr] = None

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, roles: list[UserRole]) -> list[UserRole]:
        if UserRole.ADMINISTRADOR in roles:
            raise ValueError("Administrator role cannot be assigned from this form")
        unique = list(dict.fromkeys(roles))
        return unique


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    national_id: Optional[str] = Field(default=None, min_length=5)
    roles: Optional[list[UserRole]] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=5)
    status: Optional[UserStatus] = None

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, roles: Optional[list[UserRole]]) -> Optional[list[UserRole]]:
        if roles is None:
            return roles
        if UserRole.ADMINISTRADOR in roles:
            raise ValueError("Administrator role cannot be assigned from this form")
        return list(dict.fromkeys(roles))


class UserResponse(BaseModel):
    id: int
    institution_id: int
    username: str
    first_name: str
    last_name: str
    national_id: Optional[str]
    email: Optional[str]
    roles: list[str]
    status: UserStatus

    model_config = {"from_attributes": True}
