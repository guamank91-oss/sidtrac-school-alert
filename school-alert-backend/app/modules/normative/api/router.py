from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.normative.application.service import NormativeService
from app.modules.normative.schemas import NormativeArticleResponse, NormativeDocumentResponse
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

NormativeReader = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("/documents", response_model=list[NormativeDocumentResponse])
async def list_normative_documents(
    _: CurrentUser = NormativeReader,
    session: AsyncSession = Depends(get_db),
):
    return await NormativeService(session).list_documents()


@router.get("/articles", response_model=list[NormativeArticleResponse])
async def list_normative_articles(
    code: Optional[str] = Query(None, description="Document code e.g. RLOEI-DE-675"),
    article: Optional[str] = Query(None),
    current_only: bool = Query(True),
    _: CurrentUser = NormativeReader,
    session: AsyncSession = Depends(get_db),
):
    return await NormativeService(session).list_articles(
        code=code, article=article, current_only=current_only
    )


@router.get("/articles/{article_id}", response_model=NormativeArticleResponse)
async def get_normative_article(
    article_id: int,
    _: CurrentUser = NormativeReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await NormativeService(session).get_article(article_id)
    except DomainError as exc:
        raise _handle(exc) from exc
