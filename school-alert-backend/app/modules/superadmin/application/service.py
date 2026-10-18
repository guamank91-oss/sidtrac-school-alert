from __future__ import annotations

import logging
from typing import Sequence
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.institution.infrastructure.models import InstitutionModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.superadmin.schemas import (
    InstitutionCreateRequest,
    InstitutionStatusUpdateRequest,
    SaaSGlobalMetrics,
    SaaSInstitutionItem,
)
from app.modules.users.infrastructure.models import UserModel
from app.shared.enums import UserRole
from app.shared.exceptions import ConflictError, NotFoundError

logger = logging.getLogger(__name__)


class SuperAdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_global_metrics(self) -> SaaSGlobalMetrics:
        inst_total = (await self.session.execute(select(func.count(InstitutionModel.id)))).scalar_one() or 0
        inst_active = (
            await self.session.execute(
                select(func.count(InstitutionModel.id)).where(InstitutionModel.status == "activa")
            )
        ).scalar_one() or 0
        inst_suspended = (
            await self.session.execute(
                select(func.count(InstitutionModel.id)).where(InstitutionModel.status == "suspendida")
            )
        ).scalar_one() or 0

        students = (await self.session.execute(select(func.count(StudentModel.id)))).scalar_one() or 0
        users = (await self.session.execute(select(func.count(UserModel.id)))).scalar_one() or 0
        alerts = (await self.session.execute(select(func.count(AlertModel.id)))).scalar_one() or 0
        tokens = (
            await self.session.execute(select(func.coalesce(func.sum(InstitutionModel.ai_token_count), 0)))
        ).scalar_one() or 0

        superadmins = (
            await self.session.execute(
                select(func.count(UserModel.id)).where(UserModel.role == UserRole.SUPERADMIN)
            )
        ).scalar_one() or 0

        return SaaSGlobalMetrics(
            total_institutions=inst_total,
            active_institutions=inst_active,
            suspended_institutions=inst_suspended,
            total_students=students,
            total_users=users,
            total_alerts_generated=alerts,
            total_ai_tokens_consumed=int(tokens),
            active_superadmins=superadmins,
        )

    async def list_institutions(self) -> list[SaaSInstitutionItem]:
        query = select(InstitutionModel).order_by(InstitutionModel.created_at.desc())
        results = (await self.session.execute(query)).scalars().all()

        items: list[SaaSInstitutionItem] = []
        for inst in results:
            student_count = (
                await self.session.execute(
                    select(func.count(StudentModel.id)).where(StudentModel.institution_id == inst.id)
                )
            ).scalar_one() or 0

            items.append(
                SaaSInstitutionItem(
                    id=inst.id,
                    name=inst.name,
                    code=inst.code,
                    address=inst.address,
                    phone=inst.phone,
                    email=inst.email,
                    status=inst.status or "activa",
                    plan_tier=inst.plan_tier or "pro",
                    ai_token_count=inst.ai_token_count or 0,
                    student_count=student_count,
                    created_at=inst.created_at,
                )
            )
        return items

    async def create_institution(self, data: InstitutionCreateRequest) -> SaaSInstitutionItem:
        existing = (
            await self.session.execute(
                select(InstitutionModel).where(InstitutionModel.code == data.code.strip().upper())
            )
        ).scalar_one_or_none()

        if existing:
            raise ConflictError(f"La institución con código '{data.code}' ya existe.")

        inst = InstitutionModel(
            name=data.name.strip(),
            code=data.code.strip().upper(),
            address=data.address,
            phone=data.phone,
            email=data.email,
            status="activa",
            plan_tier=data.plan_tier,
            ai_token_count=0,
        )
        self.session.add(inst)
        await self.session.commit()
        await self.session.refresh(inst)

        return SaaSInstitutionItem(
            id=inst.id,
            name=inst.name,
            code=inst.code,
            address=inst.address,
            phone=inst.phone,
            email=inst.email,
            status=inst.status,
            plan_tier=inst.plan_tier,
            ai_token_count=0,
            student_count=0,
            created_at=inst.created_at,
        )

    async def update_institution_status(
        self, institution_id: int, data: InstitutionStatusUpdateRequest
    ) -> SaaSInstitutionItem:
        inst = (
            await self.session.execute(
                select(InstitutionModel).where(InstitutionModel.id == institution_id)
            )
        ).scalar_one_or_none()

        if not inst:
            raise NotFoundError("Institución no encontrada.")

        inst.status = data.status
        if data.plan_tier:
            inst.plan_tier = data.plan_tier

        await self.session.commit()
        await self.session.refresh(inst)

        student_count = (
            await self.session.execute(
                select(func.count(StudentModel.id)).where(StudentModel.institution_id == inst.id)
            )
        ).scalar_one() or 0

        return SaaSInstitutionItem(
            id=inst.id,
            name=inst.name,
            code=inst.code,
            address=inst.address,
            phone=inst.phone,
            email=inst.email,
            status=inst.status,
            plan_tier=inst.plan_tier,
            ai_token_count=inst.ai_token_count or 0,
            student_count=student_count,
            created_at=inst.created_at,
        )
