from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.shared.enums import AttendanceStatus


class GradeModel(Base):
    __tablename__ = "calificaciones"
    __table_args__ = (
        UniqueConstraint(
            "estudiante_id",
            "curso_materia_id",
            "quimestre",
            "parcial",
            name="uq_calificacion_estudiante_materia_periodo",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    course_subject_id: Mapped[int] = mapped_column(
        "curso_materia_id", ForeignKey("curso_materias.id"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        "docente_id", ForeignKey("usuarios.id"), nullable=False
    )
    quarter: Mapped[int] = mapped_column("quimestre", Integer, nullable=False)
    partial: Mapped[int] = mapped_column("parcial", Integer, nullable=False)
    score: Mapped[Decimal] = mapped_column("nota", Numeric(5, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column("observacion", Text)
    recorded_at: Mapped[datetime] = mapped_column(
        "fecha_registro", DateTime(timezone=True), server_default=func.now()
    )


class AttendanceModel(Base):
    __tablename__ = "asistencias"
    __table_args__ = (
        UniqueConstraint(
            "estudiante_id",
            "curso_materia_id",
            "fecha",
            name="uq_asistencia_estudiante_materia_fecha",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        "estudiante_id", ForeignKey("estudiantes.id"), nullable=False
    )
    course_subject_id: Mapped[int] = mapped_column(
        "curso_materia_id", ForeignKey("curso_materias.id"), nullable=False
    )
    teacher_id: Mapped[int] = mapped_column(
        "docente_id", ForeignKey("usuarios.id"), nullable=False
    )
    attendance_date: Mapped[date] = mapped_column("fecha", Date, nullable=False)
    status: Mapped[AttendanceStatus] = mapped_column(
        "estado", Enum(AttendanceStatus, name="estado_asistencia"), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column("observacion", Text)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )
