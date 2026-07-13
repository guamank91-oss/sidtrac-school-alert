"""Idempotent seed of RGLOEI articles + Chroma institutional index."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.normative.infrastructure.models import (
    NormativeArticleModel,
    NormativeDocumentModel,
    NormativeVersionModel,
)
from app.modules.normative.seed_data import (
    ARTICLES,
    DOCUMENT_CODE,
    DOCUMENT_NAME,
    DOCUMENT_TYPE,
    EFFECTIVE_FROM,
    SOURCE_URL,
    VERSION_LABEL,
    chunk_id,
    seed_payload_checksum,
)
from app.modules.rag.application.indexer import _index_in_chroma

logger = logging.getLogger(__name__)


def index_normative_article_in_chroma(
    *,
    source_chunk_id: str,
    document_code: str,
    article: str,
    title: str,
    body: str,
) -> bool:
    text = (
        f"Documento {document_code}. Artículo {article}: {title}.\n{body}\n"
        f"NOTA: Artículos 330 y 331 NO tipifican faltas disciplinarias."
        if article in {"330", "331"}
        else f"Documento {document_code}. Artículo {article}: {title}.\n{body}"
    )
    return _index_in_chroma(
        source_chunk_id,
        text,
        {
            "scope": "global",
            "source": "normativa",
            "document_code": document_code,
            "article": article,
            "source_chunk_id": source_chunk_id,
        },
    )


async def seed_rgloei(session: AsyncSession, *, index_chroma: bool = True) -> dict:
    """Upsert document/version/articles. Safe to re-run."""
    checksum = seed_payload_checksum()
    result = await session.execute(
        select(NormativeDocumentModel).where(NormativeDocumentModel.code == DOCUMENT_CODE)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        doc = NormativeDocumentModel(
            code=DOCUMENT_CODE,
            name=DOCUMENT_NAME,
            doc_type=DOCUMENT_TYPE,
            jurisdiction="EC",
        )
        session.add(doc)
        await session.flush()

    ver_result = await session.execute(
        select(NormativeVersionModel).where(
            NormativeVersionModel.document_id == doc.id,
            NormativeVersionModel.version_label == VERSION_LABEL,
        )
    )
    version = ver_result.scalar_one_or_none()
    if version is None:
        version = NormativeVersionModel(
            document_id=doc.id,
            version_label=VERSION_LABEL,
            effective_from=EFFECTIVE_FROM,
            source_url=SOURCE_URL,
            checksum_sha256=checksum,
            is_current=True,
            notes="Seed SIDTRAC Fase 1 — validar texto oficial antes de producción.",
        )
        session.add(version)
        await session.flush()
    else:
        version.checksum_sha256 = checksum
        version.source_url = SOURCE_URL
        version.is_current = True

    created = 0
    updated = 0
    for article, title, axis, notes, body in ARTICLES:
        sid = chunk_id(article)
        art_result = await session.execute(
            select(NormativeArticleModel).where(
                NormativeArticleModel.version_id == version.id,
                NormativeArticleModel.article == article,
            )
        )
        existing = art_result.scalar_one_or_none()
        if existing is None:
            session.add(
                NormativeArticleModel(
                    version_id=version.id,
                    article=article,
                    title=title,
                    body=body,
                    sidtrac_axis=axis,
                    source_chunk_id=sid,
                    usage_notes=notes,
                )
            )
            created += 1
        else:
            existing.title = title
            existing.body = body
            existing.sidtrac_axis = axis
            existing.source_chunk_id = sid
            existing.usage_notes = notes
            updated += 1
        if index_chroma:
            index_normative_article_in_chroma(
                source_chunk_id=sid,
                document_code=DOCUMENT_CODE,
                article=article,
                title=title,
                body=body,
            )

    await session.commit()
    summary = {
        "document_code": DOCUMENT_CODE,
        "created": created,
        "updated": updated,
        "checksum": checksum,
        "articles": len(ARTICLES),
    }
    logger.info("Normative seed: %s", summary)
    return summary
