from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.modules.behavioral.application.service import BehavioralService
from app.modules.behavioral.schemas import (
    BehavioralSummary,
    DeceReportCreate,
    DeceReportResponse,
    DeceReportUpdate,
    DisciplinaryReportCreate,
    DisciplinaryReportResponse,
    DisciplinaryReportUpdate,
    TimelineEntry,
    TutorAnnotationCreate,
    TutorAnnotationResponse,
    TutorAnnotationUpdate,
)
from app.shared.auth_context import CurrentUser
from app.shared.enums import DeceReportType, RiskLevel, UserRole
from app.shared.exceptions import DomainError, http_status_for

router = APIRouter()

BehavioralReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
    )
)
TimelineReader = Depends(
    require_roles(
        UserRole.ADMINISTRADOR,
        UserRole.DECE,
        UserRole.TUTOR,
        UserRole.REPRESENTANTE,
    )
)
DeceWriter = Depends(require_roles(UserRole.DECE, UserRole.ADMINISTRADOR))
TutorWriter = Depends(require_roles(UserRole.TUTOR))
DisciplinaryWriter = Depends(require_roles(UserRole.TUTOR))
TutorEditor = Depends(require_roles(UserRole.TUTOR, UserRole.ADMINISTRADOR))


def _handle(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=http_status_for(exc), detail=exc.message)


@router.get("/summary", response_model=BehavioralSummary)
async def behavioral_summary(
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = BehavioralReader,
    session: AsyncSession = Depends(get_db),
):
    return await BehavioralService(session).summary(current_user, term_id=term_id)


@router.get("/dece-reports", response_model=list[DeceReportResponse])
async def list_dece_reports(
    student_id: Optional[int] = Query(None),
    report_type: Optional[DeceReportType] = Query(None),
    urgency_level: Optional[RiskLevel] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = BehavioralReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).list_dece_reports(
            current_user,
            student_id=student_id,
            report_type=report_type,
            urgency_level=urgency_level,
            date_from=date_from,
            date_to=date_to,
            term_id=term_id,
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/dece-reports", response_model=DeceReportResponse, status_code=201)
async def create_dece_report(
    data: DeceReportCreate,
    current_user: CurrentUser = DeceWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).create_dece_report(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.patch("/dece-reports/{report_id}", response_model=DeceReportResponse)
async def update_dece_report(
    report_id: int,
    data: DeceReportUpdate,
    current_user: CurrentUser = DeceWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).update_dece_report(
            current_user, report_id, data
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.delete("/dece-reports/{report_id}", status_code=204)
async def delete_dece_report(
    report_id: int,
    current_user: CurrentUser = DeceWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        await BehavioralService(session).delete_dece_report(current_user, report_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/tutor-notes", response_model=list[TutorAnnotationResponse])
async def list_tutor_notes(
    student_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = BehavioralReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).list_tutor_annotations(
            current_user, student_id=student_id, term_id=term_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/tutor-notes", response_model=TutorAnnotationResponse, status_code=201)
async def create_tutor_note(
    data: TutorAnnotationCreate,
    current_user: CurrentUser = TutorWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).create_tutor_annotation(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.patch("/tutor-notes/{note_id}", response_model=TutorAnnotationResponse)
async def update_tutor_note(
    note_id: int,
    data: TutorAnnotationUpdate,
    current_user: CurrentUser = TutorEditor,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).update_tutor_annotation(
            current_user, note_id, data
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.delete("/tutor-notes/{note_id}", status_code=204)
async def delete_tutor_note(
    note_id: int,
    current_user: CurrentUser = TutorEditor,
    session: AsyncSession = Depends(get_db),
):
    try:
        await BehavioralService(session).delete_tutor_annotation(current_user, note_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/disciplinary-reports", response_model=list[DisciplinaryReportResponse])
async def list_disciplinary_reports(
    student_id: Optional[int] = Query(None),
    term_id: Optional[int] = Query(None),
    current_user: CurrentUser = BehavioralReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).list_disciplinary_reports(
            current_user, student_id=student_id, term_id=term_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/disciplinary-reports", response_model=DisciplinaryReportResponse, status_code=201)
async def create_disciplinary_report(
    data: DisciplinaryReportCreate,
    current_user: CurrentUser = DisciplinaryWriter,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).create_disciplinary_report(current_user, data)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.patch(
    "/disciplinary-reports/{report_id}", response_model=DisciplinaryReportResponse
)
async def update_disciplinary_report(
    report_id: int,
    data: DisciplinaryReportUpdate,
    current_user: CurrentUser = TutorEditor,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).update_disciplinary_report(
            current_user, report_id, data
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.delete("/disciplinary-reports/{report_id}", status_code=204)
async def delete_disciplinary_report(
    report_id: int,
    current_user: CurrentUser = TutorEditor,
    session: AsyncSession = Depends(get_db),
):
    try:
        await BehavioralService(session).delete_disciplinary_report(
            current_user, report_id
        )
    except DomainError as exc:
        raise _handle(exc) from exc


@router.get("/students/{student_id}/timeline", response_model=list[TimelineEntry])
async def student_timeline(
    student_id: int,
    current_user: CurrentUser = TimelineReader,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await BehavioralService(session).student_timeline(current_user, student_id)
    except DomainError as exc:
        raise _handle(exc) from exc


@router.post("/dictate-transcribe")
async def process_dece_dictation(
    payload: dict,
    current_user: CurrentUser = DeceWriter,
):
    """Voice AI dictation assistant for DECE: converts raw audio dictation text into structured findings & action plan tasks."""
    raw_text = payload.get("raw_text", "").strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Se requiere el texto dictado por voz")

    from app.modules.rag.application.openrouter import ask_openrouter

    prompt = f"""
Eres un Asistente Profesional Psicopedagógico experto en el DECE de Ecuador.
Analiza este dictado verbal realizado por un profesional del DECE durante una sesión de acompañamiento:

DICTADO BRUTO:
"{raw_text}"

INSTRUCCIÓN ESPECIAL: Si el dictado contiene palabras repetidas o tartamudeo generado por la transcripción del micrófono (por ejemplo: "el el estudiante el estudiante Kevin alfo Kevin Alfonso"), LIMPIA y DEDUPLICA el texto primero para entender la intención clínica real.

Genera una respuesta en formato JSON estructurado con estas claves EXACTAS:
- "resumen_hallazgos": Breve resumen profesional y redactado limpiamente de los aspectos emocionales/conductuales.
- "nivel_riesgo_sugerido": Uno entre "bajo", "medio", "alto", "critico".
- "objetivo_plan_accion": Un objetivo general redactado profesionalmente para el Plan de Acción DECE.
- "compromisos_sugeridos": Lista de 3 tareas/compromisos concretos (cada uno con "titulo", "descripcion", "responsable" que puede ser "DECE", "Tutor", "Representante", "Estudiante").

Responde ÚNICAMENTE en JSON válido.
"""
    try:
        response_text = await ask_openrouter(
            prompt=prompt,
            system_prompt="Eres un asistente especializado en psicología escolar y normativas DECE del Ecuador. Responde únicamente en JSON.",
        )
        import json
        clean_json = response_text.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(clean_json)
        return {"status": "success", "dictation": raw_text, "structured_data": parsed}
    except Exception as err:
        # Fallback structured parsing if AI is unreachable
        return {
            "status": "fallback",
            "dictation": raw_text,
            "structured_data": {
                "resumen_hallazgos": raw_text[:200],
                "nivel_riesgo_sugerido": "medio",
                "objetivo_plan_accion": "Brindar acompañamiento emocional y seguimiento académico continuo.",
                "compromisos_sugeridos": [
                    {"titulo": "Sesión individual DECE", "descripcion": "Entrevista semanal de seguimiento emocional.", "responsable": "DECE"},
                    {"titulo": "Control de tareas en casa", "descripcion": "Revisión diaria del cuaderno de tareas.", "responsable": "Representante"},
                    {"titulo": "Reporte semanal del Tutor", "descripcion": "Informar novedades conductuales al DECE.", "responsable": "Tutor"},
                ],
            },
        }

