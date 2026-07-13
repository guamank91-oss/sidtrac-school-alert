from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.enums import RiskLevel, StudentStatus


class StudentModel(Base):
    __tablename__ = "estudiantes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    course_id: Mapped[int] = mapped_column("curso_id", ForeignKey("cursos.id"), nullable=False)
    first_name: Mapped[str] = mapped_column("nombres", String(100), nullable=False)
    last_name: Mapped[str] = mapped_column("apellidos", String(100), nullable=False)
    national_id: Mapped[Optional[str]] = mapped_column("cedula", String(20))
    birth_date: Mapped[Optional[date]] = mapped_column("fecha_nacimiento", Date)
    gender: Mapped[Optional[str]] = mapped_column("genero", String(20))
    guardian_id: Mapped[Optional[int]] = mapped_column("representante_id", ForeignKey("usuarios.id"))
    status: Mapped[StudentStatus] = mapped_column(
        "estado", Enum(StudentStatus, name="estado_estudiante"), default=StudentStatus.ACTIVO
    )
    current_risk_level: Mapped[RiskLevel] = mapped_column(
        "nivel_riesgo_actual", Enum(RiskLevel, name="nivel_riesgo"), default=RiskLevel.BAJO
    )
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )

    guardian = relationship(
        "UserModel",
        back_populates="represented_students",
        foreign_keys=[guardian_id],
    )
    course = relationship("CourseModel")
