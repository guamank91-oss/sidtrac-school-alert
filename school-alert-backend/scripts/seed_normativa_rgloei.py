"""Seed RGLOEI normative corpus into PostgreSQL (+ optional Chroma)."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import AsyncSessionLocal, init_database
from app.modules.normative.application.seed import seed_rgloei


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-chroma", action="store_true")
    args = parser.parse_args()
    init_database()
    assert AsyncSessionLocal is not None
    async with AsyncSessionLocal() as session:
        summary = await seed_rgloei(session, index_chroma=not args.no_chroma)
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())
