from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.normative.infrastructure.models import (
    NormativeArticleModel,
    NormativeDocumentModel,
    NormativeVersionModel,
)
from app.modules.normative.schemas import (
    NormativeArticleResponse,
    NormativeCitation,
    NormativeDocumentResponse,
)
from app.shared.exceptions import NotFoundError


class NormativeService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_documents(self) -> list[NormativeDocumentResponse]:
        result = await self.session.execute(
            select(NormativeDocumentModel).order_by(NormativeDocumentModel.code)
        )
        return [NormativeDocumentResponse.model_validate(d) for d in result.scalars().all()]

    async def list_articles(
        self,
        *,
        code: Optional[str] = None,
        article: Optional[str] = None,
        current_only: bool = True,
    ) -> list[NormativeArticleResponse]:
        query = (
            select(NormativeArticleModel, NormativeVersionModel, NormativeDocumentModel)
            .join(NormativeVersionModel, NormativeArticleModel.version_id == NormativeVersionModel.id)
            .join(NormativeDocumentModel, NormativeVersionModel.document_id == NormativeDocumentModel.id)
        )
        if current_only:
            query = query.where(NormativeVersionModel.is_current.is_(True))
        if code:
            query = query.where(NormativeDocumentModel.code == code)
        if article:
            query = query.where(NormativeArticleModel.article == article)
        query = query.order_by(NormativeDocumentModel.code, NormativeArticleModel.article)
        result = await self.session.execute(query)
        rows = []
        for art, ver, doc in result.all():
            rows.append(self._to_response(art, ver, doc))
        return rows

    async def get_article(self, article_id: int) -> NormativeArticleResponse:
        result = await self.session.execute(
            select(NormativeArticleModel, NormativeVersionModel, NormativeDocumentModel)
            .join(NormativeVersionModel, NormativeArticleModel.version_id == NormativeVersionModel.id)
            .join(NormativeDocumentModel, NormativeVersionModel.document_id == NormativeDocumentModel.id)
            .where(NormativeArticleModel.id == article_id)
        )
        row = result.one_or_none()
        if row is None:
            raise NotFoundError("Normative article")
        art, ver, doc = row
        return self._to_response(art, ver, doc)

    async def resolve_citation(
        self, *, document_code: str, article: str
    ) -> NormativeCitation:
        rows = await self.list_articles(code=document_code, article=article, current_only=True)
        if not rows:
            raise NotFoundError("Normative citation")
        r = rows[0]
        return NormativeCitation(
            document_code=r.document_code,
            document_name=r.document_name,
            version=r.version,
            article=r.article,
            article_title=r.article_title,
            effective_from=r.effective_from,
            source_chunk_id=r.source_chunk_id,
            body_excerpt=(r.body_excerpt or "")[:400] or None,
            sidtrac_axis=r.sidtrac_axis,
        )

    def _to_response(
        self,
        art: NormativeArticleModel,
        ver: NormativeVersionModel,
        doc: NormativeDocumentModel,
    ) -> NormativeArticleResponse:
        return NormativeArticleResponse(
            id=art.id,
            version_id=ver.id,
            document_code=doc.code,
            document_name=doc.name,
            version=ver.version_label,
            article=art.article,
            article_title=art.title,
            effective_from=ver.effective_from,
            source_chunk_id=art.source_chunk_id,
            body_excerpt=art.body[:500],
            sidtrac_axis=art.sidtrac_axis,
        )
