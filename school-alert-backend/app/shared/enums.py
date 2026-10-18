from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    """Member names match PostgreSQL rol_usuario labels; .value is the API/DB semantic string."""

    SUPERADMIN = "superadmin"
    ADMINISTRADOR = "administrador"
    DECE = "dece"
    TUTOR = "tutor"
    DOCENTE = "docente"
    INSPECTOR = "inspector"
    REPRESENTANTE = "representante"


class UserStatus(str, enum.Enum):
    """Member names match PostgreSQL estado_usuario labels."""

    ACTIVO = "activo"
    INACTIVO = "inactivo"


class StudentStatus(str, enum.Enum):
    """Member names match PostgreSQL estado_estudiante labels."""

    ACTIVO = "activo"
    INACTIVO = "inactivo"
    RETIRADO = "retirado"


class RiskLevel(str, enum.Enum):
    """Member names match PostgreSQL nivel_riesgo labels."""

    BAJO = "bajo"
    MEDIO = "medio"
    ALTO = "alto"
    CRITICO = "critico"


class AttendanceStatus(str, enum.Enum):
    PRESENTE = "presente"
    AUSENTE = "ausente"
    TARDANZA = "tardanza"
    JUSTIFICADO = "justificado"


class AlertType(str, enum.Enum):
    ACADEMICA = "academica"
    ASISTENCIA = "asistencia"
    CONDUCTUAL = "conductual"
    EMOCIONAL = "emocional"
    DISCIPLINARIA = "disciplinaria"
    DESERCION = "desercion"
    COMBINADA = "combinada"


class AlertStatus(str, enum.Enum):
    ACTIVA = "activa"
    ATENDIDA = "atendida"
    ARCHIVADA = "archivada"


class DeceReportType(str, enum.Enum):
    OBSERVACION_CONDUCTUAL = "observacion_conductual"
    ENTREVISTA = "entrevista"
    SEGUIMIENTO = "seguimiento"
    ALERTA_EMOCIONAL = "alerta_emocional"
    DERIVACION = "derivacion"
    PLAN_INTERVENCION = "plan_intervencion"


class TutorAnnotationType(str, enum.Enum):
    COMPORTAMIENTO = "comportamiento"
    RENDIMIENTO = "rendimiento"
    EMOCIONAL = "emocional"
    FAMILIAR = "familiar"
    OTRO = "otro"


class FaultType(str, enum.Enum):
    LEVE = "leve"
    GRAVE = "grave"
    MUY_GRAVE = "muy_grave"


class EmailStatus(str, enum.Enum):
    ENVIADO = "enviado"
    ERROR = "error"
    PENDIENTE = "pendiente"
