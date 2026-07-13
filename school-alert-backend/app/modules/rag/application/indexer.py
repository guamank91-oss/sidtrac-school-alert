from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.rag.infrastructure.models import IndexedDocumentModel
from app.modules.students.infrastructure.models import StudentModel

logger = logging.getLogger(__name__)
CHROMA_DIR = Path(__file__).resolve().parents[4] / "chroma_data"


def _collection_name() -> str:
    return getattr(settings, "CHROMA_COLLECTION", None) or "sidtrac_documents_v2"


def _index_in_chroma(document_id: str, text: str, metadata: dict) -> bool:
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = client.get_or_create_collection(_collection_name())
        collection.upsert(
            ids=[document_id],
            documents=[text],
            metadatas=[metadata],
        )
        return True
    except Exception as exc:
        logger.warning("ChromaDB indexing skipped: %s", exc)
        return False


def _delete_from_chroma(document_id: str) -> None:
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = client.get_or_create_collection(_collection_name())
        collection.delete(ids=[document_id])
    except Exception as exc:
        logger.warning("ChromaDB delete skipped: %s", exc)


async def _student_institution_id(session: AsyncSession, student_id: int) -> int:
    student = await session.get(StudentModel, student_id)
    if student is None:
        raise ValueError(f"Student {student_id} not found for indexing")
    return int(student.institution_id)


async def index_behavioral_document(
    session: AsyncSession,
    *,
    student_id: int,
    source: str,
    source_id: int,
    text: str,
) -> None:
    institution_id = await _student_institution_id(session, student_id)
    document_id = f"{source}:{source_id}"
    indexed = _index_in_chroma(
        document_id,
        text,
        {
            "institution_id": institution_id,
            "student_id": student_id,
            "source": source,
            "source_id": source_id,
        },
    )
    session.add(
        IndexedDocumentModel(
            institution_id=institution_id,
            student_id=student_id,
            source=source,
            source_id=source_id,
            chroma_document_id=document_id if indexed else None,
            indexed_text=text,
        )
    )


async def reindex_behavioral_document(
    session: AsyncSession,
    *,
    student_id: int,
    source: str,
    source_id: int,
    text: str,
) -> None:
    institution_id = await _student_institution_id(session, student_id)
    document_id = f"{source}:{source_id}"
    indexed = _index_in_chroma(
        document_id,
        text,
        {
            "institution_id": institution_id,
            "student_id": student_id,
            "source": source,
            "source_id": source_id,
        },
    )
    result = await session.execute(
        select(IndexedDocumentModel).where(
            IndexedDocumentModel.source == source,
            IndexedDocumentModel.source_id == source_id,
        )
    )
    doc = result.scalars().first()
    if doc is not None:
        doc.institution_id = institution_id
        doc.student_id = student_id
        doc.indexed_text = text
        doc.chroma_document_id = document_id if indexed else None
    else:
        session.add(
            IndexedDocumentModel(
                institution_id=institution_id,
                student_id=student_id,
                source=source,
                source_id=source_id,
                chroma_document_id=document_id if indexed else None,
                indexed_text=text,
            )
        )


async def remove_behavioral_document(
    session: AsyncSession,
    *,
    source: str,
    source_id: int,
) -> None:
    document_id = f"{source}:{source_id}"
    _delete_from_chroma(document_id)
    result = await session.execute(
        select(IndexedDocumentModel).where(
            IndexedDocumentModel.source == source,
            IndexedDocumentModel.source_id == source_id,
        )
    )
    for doc in result.scalars().all():
        await session.delete(doc)
