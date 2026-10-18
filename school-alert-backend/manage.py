"""
Admin commands (Django-style manage.py).

Usage:
  python manage.py checkdb
  python manage.py initdb
  python manage.py createsuperuser
"""
from __future__ import annotations

import argparse
import getpass
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.database import Base, init_database
from app.core.security import get_password_hash
from app.infrastructure import models_registry  # noqa: F401 — register ORM models
from app.modules.institution.infrastructure.models import InstitutionModel
from app.modules.users.domain.username import build_username_base
from app.modules.users.infrastructure.models import UserModel, UserRoleAssignmentModel
from app.shared.enums import UserRole

DB_NAME = "sidtrac"


def _mask_url(url: str) -> str:
    return re.sub(r":([^:@/]+)@", r":****@", url)


def _admin_sync_url():
    return make_url(settings.sync_database_url).set(database="postgres")


def _app_sync_url():
    return make_url(settings.sync_database_url)


def _connect_engine(database_url):
    return create_engine(
        database_url,
        connect_args={"sslmode": "disable"},
        pool_pre_ping=True,
    )


def _validate_env_password() -> None:
    import re

    match = re.search(r"postgres:([^@/]+)@", settings.DATABASE_URL)
    if not match:
        return
    password = match.group(1)
    placeholders = {"TU_PASSWORD", "password", "changeme", "your_password", "tu_password"}
    if password in placeholders:
        print("ERROR: password in .env is not configured.")
        print(f"  Current value in DATABASE_URL: '{password}'")
        print()
        print("Edit .env and replace TU_PASSWORD with your PostgreSQL password.")
        sys.exit(1)


def cmd_checkdb() -> None:
    print(f"DATABASE_URL: {_mask_url(settings.DATABASE_URL)}")
    print("PostgreSQL detected: postgresql-x64-16 service (port 5432)")
    print()
    _validate_env_password()

    try:
        engine = _connect_engine(_admin_sync_url())
        with engine.connect() as conn:
            version = conn.execute(text("SELECT version()")).scalar()
            print("Connection OK to 'postgres' database")
            print(f"  {version.split(',')[0]}")
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :db"),
                {"db": DB_NAME},
            ).scalar()
            print(f"Database '{DB_NAME}' exists: {'yes' if exists else 'no'}")
        engine.dispose()
        print("\nReady for: python manage.py initdb")
    except OperationalError as exc:
        print("ERROR: could not connect to PostgreSQL")
        print(f"  {exc}")
        sys.exit(1)


def _ensure_database() -> None:
    admin_engine = _connect_engine(_admin_sync_url())
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :db"),
            {"db": DB_NAME},
        ).scalar()
        if exists:
            print(f"Database '{DB_NAME}' already exists.")
            return

    with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f'CREATE DATABASE "{DB_NAME}"'))
    print(f"Database '{DB_NAME}' created.")


def cmd_initdb() -> None:
    try:
        _ensure_database()
        engine = _connect_engine(_app_sync_url())
        Base.metadata.create_all(engine)
        engine.dispose()
        print("Tables created successfully.")
    except OperationalError as exc:
        print("ERROR initializing database:")
        print(f"  {exc}")
        print("Run first: python manage.py checkdb")
        sys.exit(1)


def _generate_unique_username_sync(
    session: Session,
    first_name: str,
    last_name: str,
    exclude_user_id: int | None = None,
) -> str:
    base = build_username_base(first_name, last_name)
    suffix = 0
    while True:
        candidate = base if suffix == 0 else f"{base}{suffix}"
        query = select(UserModel.id).where(UserModel.username == candidate)
        if exclude_user_id:
            query = query.where(UserModel.id != exclude_user_id)
        if session.execute(query).scalar_one_or_none() is None:
            return candidate
        suffix += 1


def cmd_migrate_users() -> None:
    engine = _connect_engine(_app_sync_url())

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    ALTER TABLE usuarios ADD COLUMN username VARCHAR(80);
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
                """
            )
        )
        conn.execute(text("ALTER TABLE usuarios ALTER COLUMN correo DROP NOT NULL"))

    Base.metadata.create_all(engine, tables=[UserRoleAssignmentModel.__table__])

    with Session(engine) as session:
        has_legacy_role = session.execute(
            text(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'usuarios' AND column_name = 'rol'
                """
            )
        ).scalar_one_or_none()

        if has_legacy_role:
            users = session.execute(
                text(
                    "SELECT id, nombres, apellidos, cedula, correo, rol::text AS rol FROM usuarios"
                )
            ).mappings().all()
        else:
            users = session.execute(
                text(
                    "SELECT id, nombres, apellidos, cedula, correo, NULL AS rol FROM usuarios"
                )
            ).mappings().all()

        migrated = 0
        for row in users:
            user = session.execute(
                select(UserModel)
                .where(UserModel.id == row["id"])
                .options(selectinload(UserModel.role_assignments))
            ).scalar_one_or_none()
            if user is None:
                continue

            if not user.username:
                user.username = _generate_unique_username_sync(
                    session, row["nombres"], row["apellidos"], exclude_user_id=row["id"]
                )

            if has_legacy_role and row["rol"] and not user.role_assignments:
                role = UserRole(row["rol"].lower())
                session.add(UserRoleAssignmentModel(user_id=user.id, role=role))

            migrated += 1

        session.commit()
        print(f"Users migrated/verified: {migrated}")

    with engine.begin() as conn:
        conn.execute(text("UPDATE usuarios SET username = 'user' || id WHERE username IS NULL"))
        conn.execute(text("ALTER TABLE usuarios ALTER COLUMN username SET NOT NULL"))
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    ALTER TABLE usuarios ADD CONSTRAINT uq_usuarios_username UNIQUE (username);
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                    WHEN duplicate_table THEN NULL;
                END $$;
                """
            )
        )
        conn.execute(
            text(
                """
                DO $$ BEGIN
                    ALTER TABLE usuarios DROP COLUMN rol;
                EXCEPTION
                    WHEN undefined_column THEN NULL;
                END $$;
                """
            )
        )

    engine.dispose()
    print("Multi-role migration completed.")


def cmd_createsuperuser_sync(
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    national_id: str | None,
) -> None:
    engine = _connect_engine(_app_sync_url())
    with Session(engine) as session:
        institution = session.execute(select(InstitutionModel).limit(1)).scalar_one_or_none()

        if institution is None:
            institution = InstitutionModel(
                name="SIDTRAC Demo Institution",
                code="SIDTRAC-001",
                email="admin@institution.edu.ec",
            )
            session.add(institution)
            session.flush()
            print(f"Institution created: {institution.name} (id={institution.id})")

        if not first_name:
            first_name = input("First name: ").strip()
        if not last_name:
            last_name = input("Last name: ").strip()
        if not national_id:
            national_id = input("National ID (cedula, used as initial password): ").strip()
        if not email:
            email = input("Email (optional): ").strip() or None
        if not password:
            entered = getpass.getpass("Password (Enter to use cedula): ")
            password = entered or national_id
            if entered:
                confirm = getpass.getpass("Confirm password: ")
                if password != confirm:
                    print("Error: passwords do not match.")
                    sys.exit(1)

        username = _generate_unique_username_sync(session, first_name, last_name)

        admin = UserModel(
            institution_id=institution.id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            national_id=national_id,
            email=email,
            password_hash=get_password_hash(password),
        )
        session.add(admin)
        session.flush()
        session.add(
            UserRoleAssignmentModel(user_id=admin.id, role=UserRole.ADMINISTRADOR)
        )
        session.commit()
        print(f"Administrator created: {admin.username} (id={admin.id})")
    engine.dispose()


def cmd_createsuperuser(
    email: str | None,
    password: str | None,
    first_name: str | None,
    last_name: str | None,
    national_id: str | None,
) -> None:
    try:
        cmd_createsuperuser_sync(email, password, first_name, last_name, national_id)
    except OperationalError as exc:
        print("Connection error:")
        print(f"  {exc}")
        print("Run: python manage.py checkdb")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="SIDTRAC admin commands")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("checkdb", help="Verify PostgreSQL connection")
    sub.add_parser("initdb", help="Create database and tables")
    sub.add_parser("migrateusers", help="Migrate users to multi-role schema")

    super_parser = sub.add_parser("createsuperuser", help="Create administrator user")
    super_parser.add_argument("--email", help="Administrator email (optional)")
    super_parser.add_argument("--password", help="Password (not recommended in terminal)")
    super_parser.add_argument("--first-name", dest="first_name", default="Admin", help="First name")
    super_parser.add_argument("--last-name", dest="last_name", default="System", help="Last name")
    super_parser.add_argument("--national-id", dest="national_id", help="National ID (cedula)")

    args = parser.parse_args()

    if args.command == "checkdb":
        cmd_checkdb()
    elif args.command == "initdb":
        cmd_initdb()
    elif args.command == "migrateusers":
        cmd_migrate_users()
    elif args.command == "createsuperuser":
        cmd_createsuperuser(
            email=args.email,
            password=args.password,
            first_name=args.first_name,
            last_name=args.last_name,
            national_id=args.national_id,
        )


if __name__ == "__main__":
    main()
