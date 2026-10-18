"""
Seed del periodo lectivo 2025-2026 (inactivo) para la demo de comparativa.

Narrativa: año pasado con más alertas, notas más bajas y asistencia peor;
el periodo 2026-2027 (actual) muestra mejora tras intervenciones.

Uso:
    cd school-alert-backend
    python scripts/seed_periodo_anterior.py
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.infrastructure import models_registry  # noqa: F401
from app.core.config import settings
from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    CourseSubjectModel,
)
from app.modules.students.infrastructure.models import StudentModel
from app.shared.enums import (
    AlertStatus,
    AlertType,
    AttendanceStatus,
    DeceReportType,
    FaultType,
    RiskLevel,
    StudentStatus,
    TutorAnnotationType,
)

INSTITUTION_ID = 2
TERM_NAME = "2025-2026"
TERM_START = date(2025, 4, 1)
TERM_END = date(2026, 3, 31)

DECE_USER_ID = 6
INSPECTOR_ID = 6
TUTOR_1RO_ID = 4
TUTOR_2DO_ID = 6
TEACHER_KEVIN_ID = 4
TEACHER_RODY_ID = 6

SUBJECT_MATH = 2
SUBJECT_LENGUA = 3
SUBJECT_HIST = 4

GUARDIANS = [7, 10, 11, 6, 7, 10, 11, 6, 7, 10]


def utc(y: int, m: int, d: int, h: int = 10) -> datetime:
    return datetime(y, m, d, h, 0, 0, tzinfo=timezone.utc)


def _delete_term_data(session: Session, term_id: int) -> None:
    """Elimina datos del periodo pasado (cascada por FK de curso/estudiante)."""
    from sqlalchemy import delete

    course_ids = session.execute(
        select(CourseModel.id).where(CourseModel.academic_term_id == term_id)
    ).scalars().all()
    if not course_ids:
        session.execute(delete(AcademicTermModel).where(AcademicTermModel.id == term_id))
        return

    cs_ids = session.execute(
        select(CourseSubjectModel.id).where(CourseSubjectModel.course_id.in_(course_ids))
    ).scalars().all()
    student_ids = session.execute(
        select(StudentModel.id).where(StudentModel.course_id.in_(course_ids))
    ).scalars().all()

    if student_ids:
        session.execute(delete(AlertModel).where(AlertModel.student_id.in_(student_ids)))
        session.execute(delete(DeceReportModel).where(DeceReportModel.student_id.in_(student_ids)))
        session.execute(
            delete(TutorAnnotationModel).where(TutorAnnotationModel.student_id.in_(student_ids))
        )
        session.execute(
            delete(DisciplinaryReportModel).where(
                DisciplinaryReportModel.student_id.in_(student_ids)
            )
        )
        session.execute(delete(GradeModel).where(GradeModel.student_id.in_(student_ids)))
        session.execute(delete(AttendanceModel).where(AttendanceModel.student_id.in_(student_ids)))
        session.execute(delete(StudentModel).where(StudentModel.id.in_(student_ids)))

    if cs_ids:
        session.execute(delete(GradeModel).where(GradeModel.course_subject_id.in_(cs_ids)))
        session.execute(delete(AttendanceModel).where(AttendanceModel.course_subject_id.in_(cs_ids)))
        session.execute(delete(CourseSubjectModel).where(CourseSubjectModel.id.in_(cs_ids)))

    session.execute(delete(CourseModel).where(CourseModel.id.in_(course_ids)))
    session.execute(delete(AcademicTermModel).where(AcademicTermModel.id == term_id))
    session.commit()


def main() -> None:
    reset = "--reset" in sys.argv
    engine = create_engine(settings.sync_database_url, connect_args={"sslmode": "disable"})
    with Session(engine) as session:
        existing = session.execute(
            select(AcademicTermModel).where(
                AcademicTermModel.institution_id == INSTITUTION_ID,
                AcademicTermModel.name == TERM_NAME,
            )
        ).scalar_one_or_none()
        if existing and not reset:
            print(f"El periodo '{TERM_NAME}' ya existe (id={existing.id}). Nada que hacer.")
            print("Usa --reset para borrar y volver a crear.")
            engine.dispose()
            return
        if existing and reset:
            _delete_term_data(session, existing.id)
            session.flush()
            print(f"Periodo '{TERM_NAME}' (id={existing.id}) limpiado para recarga.")

        term = AcademicTermModel(
            institution_id=INSTITUTION_ID,
            name=TERM_NAME,
            start_date=TERM_START,
            end_date=TERM_END,
            is_active=False,
        )
        session.add(term)
        session.flush()

        course_1ro = CourseModel(
            institution_id=INSTITUTION_ID,
            academic_term_id=term.id,
            tutor_id=TUTOR_1RO_ID,
            grade_level="4",
            section="A",
            name="1ro de Bachillerato",
        )
        course_2do = CourseModel(
            institution_id=INSTITUTION_ID,
            academic_term_id=term.id,
            tutor_id=TUTOR_2DO_ID,
            grade_level="5",
            section="A",
            name="2do de Bachillerato",
        )
        session.add_all([course_1ro, course_2do])
        session.flush()

        cs_1ro_math = CourseSubjectModel(
            course_id=course_1ro.id, subject_id=SUBJECT_MATH, teacher_id=TEACHER_KEVIN_ID
        )
        cs_1ro_lengua = CourseSubjectModel(
            course_id=course_1ro.id, subject_id=SUBJECT_LENGUA, teacher_id=TEACHER_KEVIN_ID
        )
        cs_1ro_hist = CourseSubjectModel(
            course_id=course_1ro.id, subject_id=SUBJECT_HIST, teacher_id=TEACHER_RODY_ID
        )
        cs_2do_math = CourseSubjectModel(
            course_id=course_2do.id, subject_id=SUBJECT_MATH, teacher_id=TEACHER_KEVIN_ID
        )
        cs_2do_lengua = CourseSubjectModel(
            course_id=course_2do.id, subject_id=SUBJECT_LENGUA, teacher_id=TEACHER_KEVIN_ID
        )
        cs_2do_hist = CourseSubjectModel(
            course_id=course_2do.id, subject_id=SUBJECT_HIST, teacher_id=TEACHER_RODY_ID
        )
        session.add_all(
            [cs_1ro_math, cs_1ro_lengua, cs_1ro_hist, cs_2do_math, cs_2do_lengua, cs_2do_hist]
        )
        session.flush()

        students_spec = [
            # 1ro — situación más crítica el año pasado
            ("Margarita", "Monroy", "0923456701", course_1ro.id, RiskLevel.CRITICO),
            ("Carlos", "Mendoza", "0923456702", course_1ro.id, RiskLevel.ALTO),
            ("Elena", "Vargas", "0923456703", course_1ro.id, RiskLevel.ALTO),
            ("Diego", "Ramos", "0923456704", course_1ro.id, RiskLevel.MEDIO),
            ("Sofia", "Quintero", "0923456705", course_1ro.id, RiskLevel.MEDIO),
            ("Pablo", "Acosta", "0923456706", course_1ro.id, RiskLevel.BAJO),
            # 2do
            ("Jose", "Martinez", "095555510", course_2do.id, RiskLevel.MEDIO),
            ("Ana", "Beltran", "0923456708", course_2do.id, RiskLevel.ALTO),
            ("Luis", "Herrera", "0923456709", course_2do.id, RiskLevel.MEDIO),
            ("Valeria", "Castro", "0923456710", course_2do.id, RiskLevel.CRITICO),
        ]

        students: list[StudentModel] = []
        for idx, (first, last, cedula, course_id, risk) in enumerate(students_spec):
            student = StudentModel(
                institution_id=INSTITUTION_ID,
                course_id=course_id,
                first_name=first,
                last_name=last,
                national_id=cedula,
                guardian_id=GUARDIANS[idx % len(GUARDIANS)],
                status=StudentStatus.ACTIVO,
                current_risk_level=risk,
            )
            session.add(student)
            students.append(student)
        session.flush()

        by_name = {(s.first_name, s.last_name): s for s in students}
        margarita = by_name[("Margarita", "Monroy")]
        carlos = by_name[("Carlos", "Mendoza")]
        elena = by_name[("Elena", "Vargas")]
        valeria = by_name[("Valeria", "Castro")]
        jose = by_name[("Jose", "Martinez")]
        ana = by_name[("Ana", "Beltran")]

        # Calificaciones — promedio general ~6.0 (peor que el periodo actual)
        grade_matrix: list[tuple[StudentModel, CourseSubjectModel, int, int, float]] = []
        low_performers = {margarita.id, carlos.id, elena.id, valeria.id, ana.id}
        for student in students:
            subjects = (
                [cs_1ro_math, cs_1ro_lengua, cs_1ro_hist]
                if student.course_id == course_1ro.id
                else [cs_2do_math, cs_2do_lengua, cs_2do_hist]
            )
            base = 5.2 if student.id in low_performers else 7.0
            for cs in subjects:
                for quarter, partial, bump in [(1, 1, 0), (1, 2, -0.3), (2, 1, 0.2)]:
                    score = max(4.0, min(9.5, base + bump + (0.4 if cs.subject_id == SUBJECT_HIST else 0)))
                    grade_matrix.append((student, cs, quarter, partial, score))

        for student, cs, quarter, partial, score in grade_matrix:
            session.add(
                GradeModel(
                    student_id=student.id,
                    course_subject_id=cs.id,
                    teacher_id=cs.teacher_id,
                    quarter=quarter,
                    partial=partial,
                    score=Decimal(str(round(score, 2))),
                    recorded_at=utc(2025, 6 + quarter, 15),
                )
            )

        # Asistencia — ~72% presente/tardanza en el periodo pasado
        attendance_dates = [
            date(2025, 5, 12),
            date(2025, 6, 3),
            date(2025, 8, 20),
            date(2025, 9, 10),
            date(2025, 10, 5),
            date(2025, 11, 18),
            date(2026, 1, 14),
            date(2026, 2, 25),
            date(2026, 3, 10),
        ]
        absent_heavy = {margarita.id, carlos.id, valeria.id, elena.id, ana.id}
        for student in students:
            subjects = (
                [cs_1ro_math, cs_1ro_lengua, cs_1ro_hist]
                if student.course_id == course_1ro.id
                else [cs_2do_math, cs_2do_lengua, cs_2do_hist]
            )
            for att_date in attendance_dates:
                for idx, cs in enumerate(subjects):
                    if student.id in absent_heavy and att_date.month in (9, 10, 11):
                        status = AttendanceStatus.AUSENTE if idx != 2 else AttendanceStatus.TARDANZA
                    elif student.id in absent_heavy and att_date.day % 2 == 0:
                        status = AttendanceStatus.AUSENTE
                    elif student.id in absent_heavy and att_date.day % 3 == 1:
                        status = AttendanceStatus.TARDANZA
                    elif att_date.month == 1 and student.id == jose.id:
                        status = AttendanceStatus.JUSTIFICADO
                    elif att_date.month == 3 and student.id not in absent_heavy and idx == 0:
                        status = AttendanceStatus.AUSENTE
                    else:
                        status = AttendanceStatus.PRESENTE
                    session.add(
                        AttendanceModel(
                            student_id=student.id,
                            course_subject_id=cs.id,
                            teacher_id=cs.teacher_id,
                            attendance_date=att_date,
                            status=status,
                        )
                    )

        # Alertas — volumen alto en 2025-2026
        alerts_spec = [
            (margarita, AlertType.COMBINADA, RiskLevel.CRITICO, "Promedio bajo y faltas reiteradas", utc(2025, 9, 8), AlertStatus.ATENDIDA, utc(2025, 9, 20)),
            (margarita, AlertType.CONDUCTUAL, RiskLevel.ALTO, "Conflictos recurrentes en aula", utc(2025, 10, 3), AlertStatus.ATENDIDA, utc(2025, 10, 15)),
            (margarita, AlertType.EMOCIONAL, RiskLevel.CRITICO, "Signos de ansiedad ante evaluaciones", utc(2025, 11, 12), AlertStatus.ATENDIDA, utc(2025, 11, 25)),
            (carlos, AlertType.DISCIPLINARIA, RiskLevel.ALTO, "Tres faltas graves en un mes", utc(2025, 8, 22), AlertStatus.ATENDIDA, utc(2025, 9, 5)),
            (carlos, AlertType.ASISTENCIA, RiskLevel.ALTO, "Supera umbral de inasistencias", utc(2025, 10, 18), AlertStatus.ATENDIDA, utc(2025, 11, 2)),
            (elena, AlertType.ACADEMICA, RiskLevel.MEDIO, "Bajo rendimiento en matemáticas", utc(2025, 6, 14), AlertStatus.ATENDIDA, utc(2025, 6, 28)),
            (elena, AlertType.CONDUCTUAL, RiskLevel.ALTO, "Anotaciones por indisciplina", utc(2025, 9, 30), AlertStatus.ARCHIVADA, None),
            (valeria, AlertType.COMBINADA, RiskLevel.CRITICO, "Riesgo de deserción escolar", utc(2025, 10, 28), AlertStatus.ATENDIDA, utc(2025, 11, 10)),
            (valeria, AlertType.DESERCION, RiskLevel.CRITICO, "Ausencias prolongadas sin justificar", utc(2026, 1, 8), AlertStatus.ACTIVA, None),
            (ana, AlertType.ACADEMICA, RiskLevel.ALTO, "Notas por debajo del mínimo institucional", utc(2025, 7, 9), AlertStatus.ATENDIDA, utc(2025, 7, 22)),
            (ana, AlertType.EMOCIONAL, RiskLevel.MEDIO, "Preocupación por situación familiar", utc(2025, 12, 4), AlertStatus.ATENDIDA, utc(2025, 12, 18)),
            (jose, AlertType.ASISTENCIA, RiskLevel.MEDIO, "Tardanzas frecuentes", utc(2025, 5, 20), AlertStatus.ATENDIDA, utc(2025, 6, 1)),
            (jose, AlertType.ACADEMICA, RiskLevel.MEDIO, "Descenso en promedio del 1er quimestre", utc(2025, 11, 6), AlertStatus.ATENDIDA, utc(2025, 11, 20)),
            (carlos, AlertType.EMOCIONAL, RiskLevel.ALTO, "Derivación por crisis emocional", utc(2026, 2, 10), AlertStatus.ATENDIDA, utc(2026, 2, 24)),
            (margarita, AlertType.ACADEMICA, RiskLevel.ALTO, "Recuperación pendiente en lengua", utc(2026, 3, 5), AlertStatus.ATENDIDA, utc(2026, 3, 18)),
        ]
        for student, alert_type, level, desc, created, status, attended in alerts_spec:
            session.add(
                AlertModel(
                    institution_id=INSTITUTION_ID,
                    student_id=student.id,
                    alert_type=alert_type,
                    level=level,
                    description=desc,
                    status=status,
                    is_manual=False,
                    created_by=DECE_USER_ID,
                    attended_by=DECE_USER_ID if attended else None,
                    attended_at=attended,
                    created_at=created,
                )
            )

        dece_spec = [
            (margarita, DeceReportType.PLAN_INTERVENCION, "Plan de apoyo emocional y académico", RiskLevel.CRITICO, utc(2025, 9, 12)),
            (margarita, DeceReportType.SEGUIMIENTO, "Seguimiento quincenal con tutor y familia", RiskLevel.ALTO, utc(2025, 11, 8)),
            (carlos, DeceReportType.ENTREVISTA, "Entrevista por conducta agresiva en recreo", RiskLevel.ALTO, utc(2025, 8, 25)),
            (carlos, DeceReportType.DERIVACION, "Derivación a psicología externa", RiskLevel.ALTO, utc(2025, 10, 30)),
            (valeria, DeceReportType.ALERTA_EMOCIONAL, "Crisis emocional reportada por tutor", RiskLevel.CRITICO, utc(2025, 10, 15)),
            (valeria, DeceReportType.SEGUIMIENTO, "Control de reincorporación tras ausencias", RiskLevel.CRITICO, utc(2026, 1, 20)),
            (ana, DeceReportType.OBSERVACION_CONDUCTUAL, "Observación en convivencia escolar", RiskLevel.MEDIO, utc(2025, 7, 15)),
            (elena, DeceReportType.ENTREVISTA, "Entrevista con representante por bajo rendimiento", RiskLevel.MEDIO, utc(2025, 6, 20)),
        ]
        for student, rtype, desc, urgency, reported in dece_spec:
            session.add(
                DeceReportModel(
                    student_id=student.id,
                    dece_user_id=DECE_USER_ID,
                    report_type=rtype,
                    description=desc,
                    urgency_level=urgency,
                    requires_follow_up=urgency in (RiskLevel.CRITICO, RiskLevel.ALTO),
                    reported_at=reported,
                )
            )

        tutor_spec = [
            (margarita, TUTOR_1RO_ID, TutorAnnotationType.EMOCIONAL, "Llanto frecuente al inicio de clases", utc(2025, 9, 5)),
            (margarita, TUTOR_1RO_ID, TutorAnnotationType.COMPORTAMIENTO, "Mejora leve tras reunión con DECE", utc(2025, 12, 1)),
            (carlos, TUTOR_1RO_ID, TutorAnnotationType.COMPORTAMIENTO, "Reincidencia en indisciplina grupal", utc(2025, 10, 10)),
            (elena, TUTOR_1RO_ID, TutorAnnotationType.RENDIMIENTO, "No entrega tareas de matemáticas", utc(2025, 6, 18)),
            (valeria, TUTOR_2DO_ID, TutorAnnotationType.FAMILIAR, "Representante reporta problemas en casa", utc(2025, 11, 22)),
            (valeria, TUTOR_2DO_ID, TutorAnnotationType.EMOCIONAL, "Aislamiento en actividades grupales", utc(2026, 1, 12)),
            (ana, TUTOR_2DO_ID, TutorAnnotationType.RENDIMIENTO, "Requiere refuerzo en lectura comprensiva", utc(2025, 7, 25)),
            (jose, TUTOR_2DO_ID, TutorAnnotationType.COMPORTAMIENTO, "Participación positiva tras consejería", utc(2025, 11, 28)),
        ]
        for student, tutor_id, atype, desc, annotated in tutor_spec:
            session.add(
                TutorAnnotationModel(
                    student_id=student.id,
                    tutor_id=tutor_id,
                    annotation_type=atype,
                    description=desc,
                    annotated_at=annotated,
                )
            )

        disciplinary_spec = [
            (carlos, FaultType.GRAVE, "Agresión verbal a compañero en clase", "Amonestación escrita", utc(2025, 8, 19)),
            (carlos, FaultType.MUY_GRAVE, "Pelea en horario de recreo", "Suspensión 2 días", utc(2025, 10, 2)),
            (elena, FaultType.LEVE, "Uso de celular en clase", "Llamado de atención", utc(2025, 9, 14)),
            (valeria, FaultType.GRAVE, "Faltas reiteradas sin justificación", "Citación a representante", utc(2025, 11, 5)),
            (ana, FaultType.LEVE, "Incumplimiento de uniforme", "Anotación en libreta", utc(2025, 7, 8)),
            (margarita, FaultType.GRAVE, "Discusión con docente durante evaluación", "Reflexión escrita", utc(2025, 10, 21)),
        ]
        for student, fault, desc, sanction, reported in disciplinary_spec:
            session.add(
                DisciplinaryReportModel(
                    student_id=student.id,
                    inspector_id=INSPECTOR_ID,
                    fault_type=fault,
                    description=desc,
                    sanction=sanction,
                    reported_at=reported,
                )
            )

        session.commit()

        print(f"Periodo '{TERM_NAME}' creado (id={term.id}).")
        print(f"  Cursos: {course_1ro.id} (1ro), {course_2do.id} (2do)")
        print(f"  Estudiantes: {len(students)}")
        print(f"  Calificaciones: {len(grade_matrix)}")
        print(f"  Asistencias: {len(students) * len(attendance_dates) * 3}")
        print(f"  Alertas: {len(alerts_spec)}")
        print(f"  Reportes DECE: {len(dece_spec)}")
        print(f"  Anotaciones tutor: {len(tutor_spec)}")
        print(f"  Disciplinarios: {len(disciplinary_spec)}")
        print("\nComparar en Reportes > Por periodo: 2025-2026 vs 2026-2027")

    engine.dispose()


if __name__ == "__main__":
    main()
