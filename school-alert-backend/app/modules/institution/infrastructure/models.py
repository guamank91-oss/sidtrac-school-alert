from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InstitutionModel(Base):
    __tablename__ = "instituciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column("nombre", String(150), nullable=False)
    code: Mapped[str] = mapped_column("codigo", String(50), unique=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column("direccion", Text)
    phone: Mapped[Optional[str]] = mapped_column("telefono", String(20))
    email: Mapped[Optional[str]] = mapped_column("correo", String(120))
    status: Mapped[str] = mapped_column("estado_suscripcion", String(30), server_default="activa")
    plan_tier: Mapped[str] = mapped_column("plan_tier", String(30), server_default="pro")
    ai_token_count: Mapped[int] = mapped_column("conteo_tokens_ia", Integer, server_default="0")
    logo_url: Mapped[Optional[str]] = mapped_column("logo_url", Text)
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )


class AcademicTermModel(Base):
    __tablename__ = "periodos_lectivos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    name: Mapped[str] = mapped_column("nombre", String(100), nullable=False)
    start_date: Mapped[date] = mapped_column("fecha_inicio", Date, nullable=False)
    end_date: Mapped[date] = mapped_column("fecha_fin", Date, nullable=False)
    is_active: Mapped[bool] = mapped_column("activo", Boolean, default=False)


class CourseModel(Base):
    __tablename__ = "cursos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    academic_term_id: Mapped[int] = mapped_column(
        "periodo_lectivo_id", ForeignKey("periodos_lectivos.id"), nullable=False
    )
    tutor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"))
    grade_level: Mapped[str] = mapped_column("nivel", String(50), nullable=False)
    section: Mapped[str] = mapped_column("paralelo", String(10), nullable=False)
    name: Mapped[str] = mapped_column("nombre", String(100), nullable=False)


class SubjectModel(Base):
    __tablename__ = "materias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    name: Mapped[str] = mapped_column("nombre", String(100), nullable=False)
    code: Mapped[Optional[str]] = mapped_column("codigo", String(30))
    weekly_hours: Mapped[Optional[int]] = mapped_column("horas_semanales")


class CourseSubjectModel(Base):
    __tablename__ = "curso_materias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column("curso_id", ForeignKey("cursos.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column("materia_id", ForeignKey("materias.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column("docente_id", ForeignKey("usuarios.id"), nullable=False)
