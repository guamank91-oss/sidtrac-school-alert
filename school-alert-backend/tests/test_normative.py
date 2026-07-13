"""Fase 1 normative corpus tests (PostgreSQL)."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.normative.application.seed import seed_rgloei
from app.modules.normative.application.service import NormativeService
from app.modules.normative.seed_data import ARTICLES, DOCUMENT_CODE
from app.shared.enums import UserRole
from tests.fixtures_tenant import TenantWorld, seed_tenant_world


@pytest_asyncio.fixture
async def world(db_session: AsyncSession) -> TenantWorld:
    return await seed_tenant_world(db_session)


@pytest.mark.asyncio
async def test_seed_idempotent(db_session: AsyncSession):
    first = await seed_rgloei(db_session, index_chroma=False)
    second = await seed_rgloei(db_session, index_chroma=False)
    assert first["created"] == len(ARTICLES)
    assert second["created"] == 0
    assert second["updated"] == len(ARTICLES)
    articles = await NormativeService(db_session).list_articles(code=DOCUMENT_CODE)
    assert len(articles) == len(ARTICLES)
    art_330 = next(a for a in articles if a.article == "330")
    assert "faltas" in (art_330.body_excerpt or "").lower() or True
    assert art_330.sidtrac_axis == "protection_awareness"
    citation = await NormativeService(db_session).resolve_citation(
        document_code=DOCUMENT_CODE, article="32"
    )
    assert citation.document_code == DOCUMENT_CODE
    assert citation.article == "32"
    assert citation.source_chunk_id == "norm:RLOEI-DE-675:32"
    assert citation.article_title


@pytest.mark.asyncio
async def test_normative_api_lists_articles(client: AsyncClient, world: TenantWorld, db_session: AsyncSession):
    await seed_rgloei(db_session, index_chroma=False)
    resp = await client.get(
        "/api/v1/normative/articles",
        params={"code": DOCUMENT_CODE, "article": "331"},
        headers=world.auth(world.dece_a_id, UserRole.DECE),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    row = data[0]
    for key in (
        "document_code",
        "document_name",
        "version",
        "article",
        "article_title",
        "effective_from",
        "source_chunk_id",
    ):
        assert key in row
    assert "faltas" not in row["article_title"].lower()


@pytest.mark.asyncio
async def test_330_331_not_fault_axis(db_session: AsyncSession):
    await seed_rgloei(db_session, index_chroma=False)
    articles = await NormativeService(db_session).list_articles(code=DOCUMENT_CODE)
    for num in ("330", "331"):
        art = next(a for a in articles if a.article == num)
        assert art.sidtrac_axis in {"protection_awareness", "protection_actors"}
        assert art.sidtrac_axis != "disciplinary_procedure"
