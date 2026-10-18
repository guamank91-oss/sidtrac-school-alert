"""
PostgreSQL-backed test fixtures for SIDTRAC Fase 0+.

Requires a dedicated test database:
  TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/sidtrac_test

Never use SQLite. Never point this at production or the primary `sidtrac` database.
"""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DEFAULT_TEST_DB = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/sidtrac_test"
os.environ.setdefault("DATABASE_URL", os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DB))
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("AI_PROVIDER_ENABLED", "false")
os.environ.setdefault("OPENROUTER_API_KEY", "")
os.environ.setdefault("FEATURE_DECE_CASES", "false")
os.environ.setdefault("FEATURE_ACTION_PLANS", "false")


def _ensure_test_database(async_url: str) -> None:
    url = make_url(async_url)
    db_name = url.database
    if not db_name or db_name == "sidtrac":
        raise RuntimeError(
            "Refuse to run tests against primary 'sidtrac' DB. "
            "Set TEST_DATABASE_URL to a dedicated database (e.g. sidtrac_test)."
        )
    sync_admin = url.set(drivername="postgresql+psycopg2", database="postgres")
    engine = create_engine(
        sync_admin.render_as_string(hide_password=False),
        isolation_level="AUTOCOMMIT",
        connect_args={"sslmode": "disable"},
    )
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": db_name},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    engine.dispose()


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DB)
    _ensure_test_database(url)
    return url


@pytest_asyncio.fixture
async def engine(test_database_url: str):
    from app.core.database import Base
    from app.infrastructure import models_registry  # noqa: F401

    eng = create_async_engine(
        test_database_url,
        echo=False,
        connect_args={"ssl": False},
        pool_pre_ping=True,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncSession:
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(engine):
    from app.core import database as db_mod
    from app.core.database import get_db
    from app.main import app

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    db_mod.engine = engine
    db_mod.AsyncSessionLocal = session_factory
    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
