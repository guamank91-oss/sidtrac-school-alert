from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = None
AsyncSessionLocal = None


class Base(DeclarativeBase):
    pass


def init_database() -> None:
    global engine, AsyncSessionLocal
    if engine is not None:
        return
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        connect_args={"ssl": False},
        pool_pre_ping=True,
    )
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    init_database()
    assert AsyncSessionLocal is not None
    async with AsyncSessionLocal() as session:
        yield session
