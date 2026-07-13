from __future__ import annotations

import logging
from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.infrastructure.models import AuditLogModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.auth_context import CurrentUser

logger = logging.getLogger(__name__)

_INSTITUTION_REQUIRED_ACTIONS = frozenset(
    {
        "student_profile_viewed",
        "student_timeline_viewed",
        "dece_report_viewed",
        "sensitive_context_viewed",
        "rag_query_executed",
        "break_glass_used",
    }
)


async def record_audit(
    session: AsyncSession,
    *,
    user_id: Optional[int],
    action: str,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None,
    institution_id: Optional[int] = None,
    scope_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    categories: Optional[str] = None,
    reason: Optional[str] = None,
    commit: bool = False,
) -> None:
    """RF-12 / RF-51: append-only audit trail. Never raises.

    scope_type: 'global' | 'institution'. institution_id required for institution-scoped
    student/report/RAG events (callers must pass it); may be null only for global events.
    """
    try:
        resolved_scope = scope_type or ("global" if institution_id is None else "institution")
        if resolved_scope == "institution" and institution_id is None:
            logger.warning("Audit skip: institution scope without institution_id action=%s", action)
            return
        if action in _INSTITUTION_REQUIRED_ACTIONS and institution_id is None:
            logger.warning("Audit skip: sensitive action without institution_id action=%s", action)
            return
        if resolved_scope == "global" and institution_id is not None:
            # Global events must not carry a tenant id.
            institution_id = None

        session.add(
            AuditLogModel(
                user_id=user_id,
                institution_id=institution_id,
                scope_type=resolved_scope,
                action=action,
                detail=detail,
                entity_type=entity_type,
                entity_id=entity_id,
                categories=categories,
                reason=reason,
                ip_address=ip_address,
            )
        )
        if commit:
            await session.commit()
    except Exception as exc:
        logger.warning("Audit log skipped: %s", exc)


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_logs(
        self,
        current_user: CurrentUser,
        action: Optional[str] = None,
        user_id: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 200,
    ) -> list[dict]:
        query = (
            select(AuditLogModel, UserModel)
            .outerjoin(UserModel, AuditLogModel.user_id == UserModel.id)
            .where(
                (AuditLogModel.scope_type == "global")
                | (AuditLogModel.institution_id == current_user.institution_id)
            )
            .order_by(AuditLogModel.created_at.desc())
            .limit(limit)
        )
        if action:
            query = query.where(AuditLogModel.action == action)
        if user_id:
            query = query.where(AuditLogModel.user_id == user_id)
        if date_from:
            query = query.where(
                AuditLogModel.created_at
                >= datetime.combine(date_from, time.min, tzinfo=timezone.utc)
            )
        if date_to:
            query = query.where(
                AuditLogModel.created_at
                <= datetime.combine(date_to, time.max, tzinfo=timezone.utc)
            )

        result = await self.session.execute(query)
        rows = []
        for log, user in result.all():
            rows.append(
                {
                    "id": log.id,
                    "user_id": log.user_id,
                    "user_name": f"{user.first_name} {user.last_name}" if user else "Sistema",
                    "institution_id": log.institution_id,
                    "scope_type": log.scope_type,
                    "action": log.action,
                    "detail": log.detail,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "categories": log.categories,
                    "reason": log.reason,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at,
                }
            )
        return rows

    async def list_actions(self, current_user: CurrentUser) -> list[str]:
        result = await self.session.execute(
            select(AuditLogModel.action)
            .where(
                (AuditLogModel.scope_type == "global")
                | (AuditLogModel.institution_id == current_user.institution_id)
            )
            .distinct()
            .order_by(AuditLogModel.action)
        )
        return [row[0] for row in result.all()]

    async def action_counts(self, current_user: CurrentUser) -> dict[str, int]:
        result = await self.session.execute(
            select(AuditLogModel.action, func.count(AuditLogModel.id))
            .where(
                (AuditLogModel.scope_type == "global")
                | (AuditLogModel.institution_id == current_user.institution_id)
            )
            .group_by(AuditLogModel.action)
        )
        return {action: count for action, count in result.all()}
