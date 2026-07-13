from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.institution.infrastructure.models import AcademicTermModel, CourseModel
from app.shared.exceptions import NotFoundError


async def resolve_term(
    session: AsyncSession,
    institution_id: int,
    term_id: Optional[int] = None,
) -> AcademicTermModel:
    if term_id is not None:
        term = await session.get(AcademicTermModel, term_id)
        if term is None or term.institution_id != institution_id:
            raise NotFoundError("Academic term")
        return term

    result = await session.execute(
        select(AcademicTermModel).where(
            AcademicTermModel.institution_id == institution_id,
            AcademicTermModel.is_active.is_(True),
        )
    )
    term = result.scalar_one_or_none()
    if term is None:
        raise NotFoundError("Active academic term")
    return term


async def course_ids_for_term(
    session: AsyncSession,
    institution_id: int,
    term_id: Optional[int] = None,
) -> list[int]:
    term = await resolve_term(session, institution_id, term_id)
    result = await session.execute(
        select(CourseModel.id).where(
            CourseModel.institution_id == institution_id,
            CourseModel.academic_term_id == term.id,
        )
    )
    return [row[0] for row in result.all()]
