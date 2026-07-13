from __future__ import annotations

from dataclasses import dataclass

from app.shared.enums import UserRole


@dataclass
class CurrentUser:
    id: int
    institution_id: int
    username: str
    first_name: str
    last_name: str
    email: str | None
    roles: list[UserRole]
    active_role: UserRole
