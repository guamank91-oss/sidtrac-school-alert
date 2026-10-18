import asyncio
from sqlalchemy import text
from app.core import database


async def main():
    database.init_database()
    assert database.engine is not None
    async with database.engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS estado_suscripcion VARCHAR(30) DEFAULT 'activa';"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(30) DEFAULT 'pro';"
            )
        )
        await conn.execute(
            text(
                "ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS conteo_tokens_ia INTEGER DEFAULT 0;"
            )
        )
        await conn.execute(
            text("ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS logo_url TEXT;")
        )
        print("Migracion exitosa: Columnas SaaS (estado_suscripcion, plan_tier, conteo_tokens_ia, logo_url) agregadas a PostgreSQL!")


if __name__ == "__main__":
    asyncio.run(main())
