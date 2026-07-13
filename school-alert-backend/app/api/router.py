from __future__ import annotations

from fastapi import APIRouter

from app.modules.academic.api.router import router as academic_router
from app.modules.alerts.api.router import router as alerts_router
from app.modules.audit.api.router import router as audit_router
from app.modules.auth.api.router import router as auth_router
from app.modules.behavioral.api.router import router as behavioral_router
from app.modules.institution.api.router import router as institution_router
from app.modules.notifications.api.router import router as notifications_router
from app.modules.normative.api.router import router as normative_router
from app.modules.cases.api.router import router as cases_router
from app.modules.rag.api.router import router as rag_router
from app.modules.reports.api.router import router as reports_router
from app.modules.students.api.router import router as students_router
from app.modules.users.api.router import router as users_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(institution_router, prefix="/institution", tags=["institution"])
api_router.include_router(students_router, prefix="/students", tags=["students"])
api_router.include_router(academic_router, prefix="/academic", tags=["academic"])
api_router.include_router(behavioral_router, prefix="/behavioral", tags=["behavioral"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(rag_router, prefix="/rag", tags=["rag"])
api_router.include_router(normative_router, prefix="/normative", tags=["normative"])
api_router.include_router(cases_router, prefix="/cases", tags=["cases"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
