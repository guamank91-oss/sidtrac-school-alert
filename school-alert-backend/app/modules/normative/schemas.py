from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class NormativeCitation(BaseModel):
    """Canonical citation object (never a bare 'Art. N' string)."""

    document_code: str
    document_name: str
    version: str
    article: str
    article_title: str
    effective_from: date
    source_chunk_id: str
    body_excerpt: Optional[str] = None
    sidtrac_axis: Optional[str] = None


class NormativeDocumentResponse(BaseModel):
    id: int
    code: str
    name: str
    doc_type: str
    jurisdiction: str

    model_config = {"from_attributes": True}


class NormativeArticleResponse(NormativeCitation):
    id: int
    version_id: int
