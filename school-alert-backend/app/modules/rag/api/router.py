from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.modules.rag.application.service import RagService
from app.modules.rag.schemas import (
    RagHistoryEntry,
    RagMetrics,
    RagQueryRequest,
    RagQueryResponse,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

RagUser = Depends(require_roles(UserRole.ADMINISTRADOR, UserRole.DECE))
AdminOnly = Depends(require_roles(UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.post("/query", response_model=RagQueryResponse)
async def rag_query(
    data: RagQueryRequest,
    current_user: CurrentUser = RagUser,
    session: AsyncSession = Depends(get_db),
):
    """RF-35/36/37/38/39: conversational RAG query for DECE staff."""
    try:
        return await RagService(session).query(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/query/stream")
async def rag_query_stream(
    data: RagQueryRequest,
    current_user: CurrentUser = RagUser,
    session: AsyncSession = Depends(get_db),
):
    """Streamed RAG answer (NDJSON): events {type: meta|delta|done|error}."""
    service = RagService(session)

    async def event_stream():
        try:
            async for event in service.query_stream(current_user, data):
                yield json.dumps(event, ensure_ascii=False, default=str) + "\n"
        except DomainError as exc:
            yield json.dumps({"type": "error", "message": exc.message}) + "\n"
        except Exception as exc:  # noqa: BLE001
            yield json.dumps({"type": "error", "message": str(exc)}) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[RagHistoryEntry])
async def rag_history(
    limit: int = Query(100, le=500),
    current_user: CurrentUser = RagUser,
    session: AsyncSession = Depends(get_db),
):
    """RF-40 / RN-07: query log (admin sees all, DECE only their own)."""
    return await RagService(session).history(current_user, limit)


@router.get("/metrics", response_model=RagMetrics)
async def rag_metrics(
    _: CurrentUser = AdminOnly,
    session: AsyncSession = Depends(get_db),
):
    """RF-52: RAG engine usage metrics."""
    return await RagService(session).metrics()
