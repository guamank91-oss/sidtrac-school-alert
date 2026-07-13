"""
Reindex Postgres documentos_indexados into Chroma collection sidtrac_documents_v2.

Cutover (manual ops):
  1. python scripts/migrate_chroma_to_v2.py --reindex
  2. python scripts/migrate_chroma_to_v2.py --validate
  3. Ensure CHROMA_COLLECTION=sidtrac_documents_v2 in env
  4. python scripts/migrate_chroma_to_v2.py --retire-v1   # only after validation

Never mixes documents without institution_id into v2.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, init_database
from app.modules.rag.application.indexer import CHROMA_DIR, _collection_name, _index_in_chroma
from app.modules.rag.infrastructure.models import IndexedDocumentModel

logger = logging.getLogger("migrate_chroma_v2")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

V1_NAME = "sidtrac_documents"
V2_NAME = "sidtrac_documents_v2"


def _client():
    import chromadb

    return chromadb.PersistentClient(path=str(CHROMA_DIR))


async def reindex() -> int:
    assert AsyncSessionLocal is not None
    written = 0
    skipped = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(IndexedDocumentModel))
        docs = list(result.scalars().all())
        for doc in docs:
            if doc.institution_id is None:
                logger.warning("Skip doc id=%s: missing institution_id", doc.id)
                skipped += 1
                continue
            if not doc.indexed_text:
                skipped += 1
                continue
            if doc.student_id is None:
                # Normative / institution docs: student_id optional in schema
                metadata = {
                    "institution_id": int(doc.institution_id),
                    "source": doc.source,
                    "source_id": int(doc.source_id),
                }
            else:
                metadata = {
                    "institution_id": int(doc.institution_id),
                    "student_id": int(doc.student_id),
                    "source": doc.source,
                    "source_id": int(doc.source_id),
                }
            doc_id = doc.chroma_document_id or f"{doc.source}:{doc.source_id}"
            ok = _index_in_chroma(doc_id, doc.indexed_text, metadata)
            if ok:
                written += 1
            else:
                skipped += 1
    logger.info("Reindex complete: written=%s skipped=%s collection=%s", written, skipped, _collection_name())
    return written


def validate() -> bool:
    client = _client()
    v2 = client.get_or_create_collection(V2_NAME)
    count = v2.count()
    sample = v2.peek(min(20, max(count, 1))) if count else {"metadatas": []}
    metas = sample.get("metadatas") or []
    missing = [m for m in metas if not m or "institution_id" not in m]
    logger.info("v2 count=%s sample=%s missing_institution_id_in_sample=%s", count, len(metas), len(missing))
    if missing:
        logger.error("Validation failed: sample documents without institution_id")
        return False
    logger.info("Validation OK")
    return True


def retire_v1(*, force: bool = False) -> None:
    client = _client()
    names = {c.name for c in client.list_collections()}
    if V1_NAME not in names:
        logger.info("v1 collection %s not present; nothing to retire", V1_NAME)
        return
    if not force:
        v2 = client.get_or_create_collection(V2_NAME)
        if v2.count() <= 0:
            raise SystemExit("Refuse to retire v1: v2 is empty. Reindex and validate first.")
    client.delete_collection(V1_NAME)
    logger.info("Retired collection %s", V1_NAME)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Chroma sidtrac_documents → v2 cutover")
    parser.add_argument("--reindex", action="store_true")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--retire-v1", action="store_true")
    parser.add_argument("--force-retire", action="store_true")
    args = parser.parse_args()
    if not any([args.reindex, args.validate, args.retire_v1]):
        parser.print_help()
        raise SystemExit(1)

    if args.reindex:
        init_database()
        await reindex()
    if args.validate:
        ok = validate()
        if not ok:
            raise SystemExit(2)
    if args.retire_v1:
        retire_v1(force=args.force_retire)


if __name__ == "__main__":
    asyncio.run(main())
