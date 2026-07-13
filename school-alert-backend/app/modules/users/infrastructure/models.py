from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.enums import UserRole, UserStatus


class UserRoleAssignmentModel(Base):
    __tablename__ = "usuario_roles"
    __table_args__ = (UniqueConstraint("usuario_id", "rol", name="uq_usuario_rol"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column("usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"))
    role: Mapped[UserRole] = mapped_column(
        "rol", Enum(UserRole, name="rol_usuario"), nullable=False
    )

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="role_assignments")


class UserModel(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    institution_id: Mapped[int] = mapped_column(
        "institucion_id", ForeignKey("instituciones.id"), nullable=False
    )
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column("nombres", String(100), nullable=False)
    last_name: Mapped[str] = mapped_column("apellidos", String(100), nullable=False)
    national_id: Mapped[Optional[str]] = mapped_column("cedula", String(20))
    email: Mapped[Optional[str]] = mapped_column("correo", String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        "estado", Enum(UserStatus, name="estado_usuario"), default=UserStatus.ACTIVO
    )
    created_at: Mapped[datetime] = mapped_column(
        "creado_en", DateTime(timezone=True), server_default=func.now()
    )

    role_assignments: Mapped[list[UserRoleAssignmentModel]] = relationship(
        "UserRoleAssignmentModel",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    represented_students = relationship(
        "StudentModel",
        back_populates="guardian",
        foreign_keys="StudentModel.guardian_id",
    )

    @property
    def roles(self) -> list[UserRole]:
        return [assignment.role for assignment in self.role_assignments]
