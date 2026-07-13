from __future__ import annotations

"""Central ORM model registry for migrations and metadata."""

from app.modules.institution.infrastructure.models import (
    AcademicTermModel,
    CourseModel,
    CourseSubjectModel,
    InstitutionModel,
    SubjectModel,
)
from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.behavioral.infrastructure.models import (
    DeceReportModel,
    DisciplinaryReportModel,
    TutorAnnotationModel,
)
from app.modules.alerts.infrastructure.models import AlertConfigModel, AlertModel
from app.modules.audit.infrastructure.models import AuditLogModel
from app.modules.notifications.infrastructure.models import (
    EmailNotificationModel,
    InternalNotificationModel,
)
from app.modules.rag.infrastructure.models import IndexedDocumentModel, RagQueryModel
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel, UserRoleAssignmentModel
from app.modules.normative.infrastructure.models import (
    NormativeArticleModel,
    NormativeDocumentModel,
    NormativeVersionModel,
)
from app.modules.cases.infrastructure.models import (
    CaseTriageModel,
    DeceCaseAlertModel,
    DeceCaseModel,
    ExternalReferralModel,
    ProtocolActivationModel,
)

__all__ = [
    "InstitutionModel",
    "AcademicTermModel",
    "CourseModel",
    "SubjectModel",
    "CourseSubjectModel",
    "UserModel",
    "UserRoleAssignmentModel",
    "StudentModel",
    "GradeModel",
    "AttendanceModel",
    "DeceReportModel",
    "TutorAnnotationModel",
    "DisciplinaryReportModel",
    "IndexedDocumentModel",
    "RagQueryModel",
    "AlertModel",
    "AlertConfigModel",
    "EmailNotificationModel",
    "InternalNotificationModel",
    "AuditLogModel",
    "NormativeDocumentModel",
    "NormativeVersionModel",
    "NormativeArticleModel",
    "DeceCaseModel",
    "DeceCaseAlertModel",
    "CaseTriageModel",
    "ProtocolActivationModel",
    "ExternalReferralModel",
]
