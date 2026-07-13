from __future__ import annotations

from dataclasses import dataclass

from app.shared.enums import UserRole


@dataclass
class AuthenticatedUser:
    id: int
    first_name: str
    last_name: str
    email: str
    role: UserRole
    institution_id: int
