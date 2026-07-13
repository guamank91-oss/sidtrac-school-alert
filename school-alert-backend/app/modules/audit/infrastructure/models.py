from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLogModel(Base):
    __tablename__ = "logs_auditoria"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        "usuario_id", ForeignKey("usuarios.id"), nullable=True
    )
    institution_id: Mapped[Optional[int]] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=True
    )
    scope_type: Mapped[str] = mapped_column(
        "alcance", String(20), nullable=False, server_default="institution"
    )
    action: Mapped[str] = mapped_column("accion", String(100), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column("detalle", Text, nullable=True)
    entity_type: Mapped[Optional[str]] = mapped_column("tipo_entidad", String(80), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column("entidad_id", Integer, nullable=True)
    categories: Mapped[Optional[str]] = mapped_column("categorias", Text, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column("motivo", Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column("ip_acceso", String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
