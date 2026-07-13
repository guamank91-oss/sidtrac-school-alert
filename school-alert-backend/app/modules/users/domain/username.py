from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.infrastructure.models import UserModel


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def build_username_base(first_name: str, last_name: str) -> str:
    """
    Pattern: first letter of first surname + full first name + first letter of second surname.
    Example: Kevin Alfonso, apellidos García López -> gkevinl
    """
    surname_parts = last_name.strip().split()
    first_surname = surname_parts[0] if surname_parts else "x"
    second_surname = surname_parts[1] if len(surname_parts) > 1 else ""

    name_part = _strip_accents(first_name.strip().lower()).replace(" ", "")
    base = f"{_strip_accents(first_surname[0].lower())}{name_part}"
    if second_surname:
        base += _strip_accents(second_surname[0].lower())

    base = re.sub(r"[^a-z0-9]", "", base)
    return base or "user"


async def generate_unique_username(
    session: AsyncSession,
    first_name: str,
    last_name: str,
    exclude_user_id: int | None = None,
) -> str:
    base = build_username_base(first_name, last_name)
    suffix = 0

    while True:
        candidate = base if suffix == 0 else f"{base}{suffix}"
        query = select(UserModel.id).where(UserModel.username == candidate)
        if exclude_user_id:
            query = query.where(UserModel.id != exclude_user_id)
        exists = await session.execute(query)
        if exists.scalar_one_or_none() is None:
            return candidate
        suffix += 1
