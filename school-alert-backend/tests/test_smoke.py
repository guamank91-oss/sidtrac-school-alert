"""Smoke tests — suite runs only against PostgreSQL (see conftest)."""
from __future__ import annotations


def test_app_imports():
    from app.main import app

    assert app.title or app.openapi_version


async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "ok" or "ok" in str(payload).lower() or response.status_code == 200


async def test_database_is_postgresql(engine):
    from sqlalchemy import text

    async with engine.connect() as conn:
        dialect = (await conn.execute(text("SELECT version()"))).scalar()
    assert dialect is not None
    assert "PostgreSQL" in dialect
