"""Chroma collection naming / metadata guards."""
from __future__ import annotations

from app.core.config import settings
from app.modules.rag.application.indexer import _collection_name


def test_default_collection_is_v2():
    assert settings.CHROMA_COLLECTION == "sidtrac_documents_v2"
    assert _collection_name() == "sidtrac_documents_v2"
