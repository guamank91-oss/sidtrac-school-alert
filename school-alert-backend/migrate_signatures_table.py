import asyncio
from sqlalchemy import text
from app.core import database


async def main():
    database.init_database()
    assert database.engine is not None
    async with database.engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS firmas_plan_accion (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL REFERENCES planes_accion(id) ON DELETE CASCADE,
                signer_role VARCHAR(40) NOT NULL,
                signer_name VARCHAR(200) NOT NULL,
                signer_national_id VARCHAR(20),
                signature_data TEXT NOT NULL,
                signature_type VARCHAR(40) DEFAULT 'digital_draw',
                ip_address VARCHAR(45),
                signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            """)
        )
        print("Migracion exitosa: Tabla firmas_plan_accion creada!")


if __name__ == "__main__":
    asyncio.run(main())
