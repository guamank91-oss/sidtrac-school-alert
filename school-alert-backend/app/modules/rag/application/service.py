from __future__ import annotations

import json
import logging
import re
import time
from datetime import date, datetime, timedelta, timezone
from typing import Literal, cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.infrastructure.models import AttendanceModel, GradeModel
from app.modules.alerts.infrastructure.models import AlertModel
from app.modules.audit.application.service import record_audit
from app.modules.behavioral.infrastructure.models import DeceReportModel, TutorAnnotationModel
from app.modules.institution.infrastructure.models import (
    CourseModel,
    CourseSubjectModel,
    SubjectModel,
)
from app.modules.rag.application.indexer import CHROMA_DIR
from app.modules.rag.application.intent_guard import (
    GUARD_RESPONSES,
    classify_question_intent,
)
from app.modules.rag.application.intent import (
    RagIntent,
    assemble_context_for_intent,
    classify_intent,
    parse_structured_blocks,
    policy_for,
)
from app.modules.rag.application.openrouter import (
    AI_PROVIDER_DISABLED,
    DEFAULT_MODEL,
    chat_completion,
    chat_completion_stream,
)
from app.modules.rag.application.plan_context import load_active_plan_bundle
from app.modules.rag.application.student_profile import (
    format_ficha_block,
    load_student_ficha,
    merge_structured_with_ficha,
)
from app.modules.rag.infrastructure.models import RagQueryModel
from app.modules.rag.schemas import (
    RagHistoryEntry,
    RagMetrics,
    RagQueryRequest,
    RagQueryResponse,
)
from app.modules.students.infrastructure.models import StudentModel
from app.modules.users.infrastructure.models import UserModel
from app.shared.audit_actions import RAG_QUERY_EXECUTED
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertStatus, AttendanceStatus, RiskLevel, UserRole
from app.shared.exceptions import DomainError, ForbiddenError, NotFoundError
from app.shared.privacy.minimization import (
    build_minimized_categories,
    make_student_ref,
    redact_text,
)
from app.shared.tenant import assert_same_institution

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el asistente psicopedagógico de SIDTRAC para el DECE (Departamento de \
Consejería Estudiantil) de un colegio de Bachillerato en Ecuador. Hablas con un profesional del DECE, \
no con el estudiante ni la familia.

FUENTE DE VERDAD:
- Usa EXCLUSIVAMENTE el bloque "BASE DE CONOCIMIENTO" que recibes (PostgreSQL + ChromaDB). No inventes \
ni uses conocimiento externo para afirmar hechos del estudiante. Si un bloque no aparece, ese dato \
no está disponible para esta pregunta.
- Distingue los tipos con PRECISIÓN: "observación conductual", "alerta emocional", "reporte disciplinario" \
y "anotación de tutor" NO son sinónimos. Nunca llames "emocional" a algo conductual ni al revés.
- PLAN DE ATENCIÓN: si el contexto trae "HAY PLAN ACTIVO EN MARCHA", responde con ese objetivo y sus \
acciones operativas. NO digas que no hay plan. Las "acciones ejecutadas" de alertas atendidas NO reemplazan \
ni equivalen a un ActionPlan activo.
- Si el DECE pregunta por acciones del plan (reportadas, aprobadas/validadas, pendientes, vigentes, \
cubiertas, avance del plan), usa EXCLUSIVAMENTE los estados de "PLAN DE ATENCIÓN ACTIVO" \
(pending / in_progress / reported_completed / validated). NO uses ACCIONES EJECUTADAS (alertas atendidas) \
para eso. Si todas están `pending`, di claramente que ninguna fue reportada ni validada aún.

CONTROL DE RESPUESTA (obligatorio):
- La PRIMERA línea de tu respuesta debe ser EXACTAMENTE este header, sin nada más:
  `CONTROL: riesgo=<bajo|medio|alto|critico>`
- Este chat YA está acotado al estudiante seleccionado. NO declaires fuera de alcance, NO uses \
`alcance=`, NO respondas solo con `[FUERA_DE_ALCANCE]`.
- Si la pregunta se desvía (chiste, clima, política, pedir que resuelvas una tarea), responde en 1-2 \
frases reorientando al expediente y ofrece 1 ejemplo concreto (asistencia, notas, alertas). Sin banners \
ni negativas rígidas.
- Ante dudas sobre si la pregunta "cabe": interpreta de la forma más útil hacia el seguimiento del \
estudiante y responde con lo que consta (o di qué dato no está en el expediente).
- `riesgo` debe ser coherente con el semáforo y los reportes.

CÓMO RESPONDER:
1. Después del header CONTROL, deja una línea en blanco y escribe una RESPUESTA DIRECTA de 1 o 2 frases que \
conteste literalmente la pregunta (empieza con Sí / No / lo esencial). Sin rodeos ni preámbulos.
2. Después, SOLO si aporta valor, agrega secciones breves con encabezados "### " (p. ej. "### Evidencia", \
"### Qué hacer ahora"). Pregunta simple = respuesta corta. NO fuerces plantillas de 3 secciones si no hace falta.

USA EL HISTORIAL: preguntas de seguimiento como "¿cuáles son?", "detalla", "enuméralas", "y eso?", \
"cuáles de esas", "del plan", "esas acciones" se refieren a lo ÚLTIMO que dijiste. NO cambies de tema: \
si venías hablando del plan de atención/acción, sigue con estados del plan (no con alertas atendidas). \
Si venías hablando de anotaciones, sigue con anotaciones. Si el usuario pide "cuáles", ENUMERA.

REGLAS DE CALIDAD (obligatorias):
- ATERRIZA EN EL TIEMPO: cuando la pregunta hable de cambio, tendencia o "últimas semanas", usa las fechas \
y expresiones como "hace X días/semanas". Tienes "Fecha de hoy" en el contexto; úsala.
- RESPETA EL ESTADO DEL CASO: no recomiendes algo que ya está hecho o agendado. Si la entrevista ya está \
programada, di "prepara esa entrevista" en vez de "realiza una entrevista".
- RECOMENDACIONES: máximo 3, priorizadas (la #1 es la más urgente) y CADA una atada a un hecho concreto del \
expediente. PROHIBIDO el relleno genérico tipo "monitorear y ajustar según sea necesario", "ofrecer apoyo \
emocional o terapia" o "considerar la posibilidad de..." sin un dato que lo justifique.
- No repitas el nombre completo del estudiante en cada frase; usa "la estudiante" / "el estudiante".
- Si un dato NO existe, simplemente NO lo menciones. No escribas viñetas como "No consta en el registro" \
salvo que el DECE pregunte explícitamente por ese dato puntual.
- Formato Markdown: viñetas con "- " (una por línea), NUNCA uses el caracter "•".
- NO emitas diagnósticos clínicos ni etiquetas médicas; solo observaciones registradas.
- Español, tono profesional, directo y empático. Nunca te niegues a analizar el expediente.

INCERTIDUMBRE Y TRAZABILIDAD (reglas críticas para el DECE):
- Clasifica SIEMPRE lo que dices en tres niveles (puedes usar estas etiquetas mentalmente, no hace falta \
escribirlas siempre):
  1) **Hecho registrado** — consta textualmente en la base de conocimiento.
  2) **Inferencia razonable** — interpretación profesional basada en hechos; preséntala como tal \
("podría indicar", "sugiere", "es consistente con").
  3) **Dato no disponible** — no está en el expediente; dilo explícitamente si la pregunta lo exige.
- NUNCA presentes una inferencia como si fuera un hecho del expediente.
- "No hay evidencia registrada" NO significa "no ocurrió". Usa formulaciones seguras:
  - Correcto: "No consta evidencia posterior que permita confirmar mejora / efecto positivo / empeoramiento."
  - Incorrecto: "No ha mejorado", "No tuvo efecto", "La situación está estable", "No ha empeorado", \
"persiste", "sigue igual", "no hay cambios" \
(salvo que existan registros comparativos antes Y después que lo sustenten).

COMPARACIÓN TEMPORAL (evolución, mejora, empeoramiento, escalamiento, efecto de intervención):
- Antes de afirmar mejora, empeoramiento, estabilidad, escalamiento o efecto (positivo o negativo) de \
una intervención, verifica si hay registros ANTES y DESPUÉS en la cronología o en "ACCIONES EJECUTADAS".
- Si los eventos más recientes datan de hace semanas y NO hay registros posteriores, NO afirmes estabilidad \
ni mejora ni empeoramiento reciente. Di: "Con la información registrada, el último evento es de [fecha]; \
no hay evidencia posterior suficiente para evaluar evolución reciente."
- Revisa el bloque "NOTA COMPARATIVA TEMPORAL" del contexto antes de responder preguntas de tendencia.

CLASIFICACIÓN DE RIESGO (cuando aplique):
- Separa explícitamente por dimensión cuando pregunten por tipo de caso o factores de riesgo:
  **Académico** | **Asistencia** | **Conductual** | **Emocional/social** | **Alertas activas**
- "Conducta problemática" NO equivale a agresividad, bullying ni conflicto grave. Solo afírmalo si consta \
en el texto del reporte. Si preguntan por agresividad/conflictos y solo hay conducta problemática, dilo: \
"Sí hay reporte de conducta problemática; no consta agresividad explícita ni conflicto grave en el detalle."

RESPONDER SOLO LO PREGUNTADO (regla dura):
- Si la pregunta solicita análisis, clasificación, explicación, comparación, causa, evidencia, \
temporalidad, datos faltantes o un dato puntual, responde ÚNICAMENTE eso. NO incluyas secciones de \
"Qué hacer ahora", recomendaciones, sugerencias ni próximos pasos, SALVO que el usuario lo pida \
explícitamente (p. ej. "¿qué debo hacer?", "recomiéndame", "próximo paso").
- Si el usuario dice "no incluyas recomendaciones", "no generalices", "solo analiza" o similar, OBEDECE \
literalmente: cero recomendaciones.
- Ante la duda, NO recomiendes. Es preferible una respuesta analítica pura que una con ruido operativo.

AUSENCIA DE EVIDENCIA (regla dura):
- La ausencia de registros posteriores NUNCA debe interpretarse como estabilidad, mejora, empeoramiento \
ni falta de efecto. Exprésalo SIEMPRE como "no hay evidencia posterior suficiente para concluir evolución \
(mejora/empeoramiento/estabilidad/efecto)". Prohibido decir "podría indicar que no ha cambiado", \
"parece estable" o "sugiere que se mantiene igual".

PREGUNTAS OPERATIVAS (cuando SÍ piden acción: "qué hacer", "qué acciones tomar", "esta semana", \
"debo priorizar", "próximo paso"):
- Responde con una DECISIÓN o ACCIÓN concreta, no con generalidades. Si preguntan "¿debo priorizar?", \
empieza con "Sí" o "No" y el criterio (p. ej. "Sí, para seguimiento, no como emergencia inmediata porque…").
- Separa SIEMPRE lo pendiente de lo ya hecho. NO respondas una pregunta de acciones futuras con un listado \
de acciones ya tomadas. Las acciones ya realizadas van en su propia sección y NO se repiten.
- Acciones concretas del ámbito DECE (usa este vocabulario, no genéricos): confirmar si la entrevista o \
citación agendada se realizó y su resultado; entrevista exploratoria con la estudiante (sin asumir causas); \
observación conductual en aula; seguimiento con el tutor/docentes; contacto con el representante; derivación \
si las señales exceden el ámbito escolar; registrar acuerdos, responsable y fecha de seguimiento.
- PROHIBIDO presuponer lo no registrado: nunca digas que un plan fue "implementado" o "ejecutado" si no \
consta. Di "verifica si las acciones planificadas se ejecutaron y registra evidencia de cumplimiento".
- Evita recomendaciones vagas ("realizar una evaluación adicional", "monitorear"): concreta el tipo de \
acción DECE y a quién involucra.
- No repitas la misma acción dos veces dentro de la respuesta."""


def _search_chroma(student_id: int, institution_id: int, question: str, top_k: int = 5) -> list[dict]:
    try:
        import chromadb

        from app.modules.rag.application.indexer import CHROMA_DIR, _collection_name

        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = client.get_or_create_collection(_collection_name())
        results = collection.query(
            query_texts=[question],
            n_results=top_k,
            where={
                "$and": [
                    {"student_id": student_id},
                    {"institution_id": institution_id},
                ]
            },
        )
        documents = []
        ids = results.get("ids", [[]])[0]
        docs = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        for doc_id, text, meta in zip(ids, docs, metadatas):
            documents.append({"id": doc_id, "text": text, "source": (meta or {}).get("source")})
        return documents
    except Exception as exc:
        logger.warning("ChromaDB search failed: %s", exc)
        return []


SOURCE_LABELS = {
    "reporte_dece": "Reporte DECE",
    "anotacion_tutor": "Anotación de tutor",
    "reporte_disciplinario": "Reporte disciplinario",
}


class RagService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def query(self, current_user: CurrentUser, data: RagQueryRequest) -> RagQueryResponse:
        started = time.perf_counter()

        student = await self.session.get(StudentModel, data.student_id)
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        intent = classify_question_intent(data.question)
        if intent != "student_query":
            return await self._guard_response(
                current_user=current_user,
                student=student,
                question=data.question,
                intent=intent,
                started=started,
            )

        structured, messages, sources, documents, domain_intent = await self._build_messages(
            student, data
        )

        answer, tokens, error = await chat_completion(messages, temperature=0.15)
        if error == AI_PROVIDER_DISABLED:
            raise DomainError(
                "El proveedor de IA está deshabilitado",
                code=AI_PROVIDER_DISABLED,
            )
        used_llm = answer is not None

        if answer is None:
            answer = self._fallback_answer(structured, documents, error)

        # Chat con estudiante seleccionado: nunca cortamos con "fuera de alcance".
        # El header CONTROL solo aporta riesgo; un posible legado alcance=fuera se ignora.
        _, parsed_risk = self._parse_control(answer)
        answer = self._strip_control_line(answer)
        if not answer:
            answer = self._strip_control_line(
                self._fallback_answer(structured, documents, error)
            )
            used_llm = False
        detected_risk = parsed_risk or self._resolve_risk_level(answer, student, documents)
        wants_reco = (
            policy_for(domain_intent).allows_recommendations
            or self._wants_recommendations(data.question)
        )
        if not wants_reco:
            answer = self._strip_reco_sections(answer)
        response_intent: Literal[
            "student_query", "greeting", "off_topic", "too_vague"
        ] = "student_query"

        latency_ms = int((time.perf_counter() - started) * 1000)
        model_used = DEFAULT_MODEL if used_llm else "fallback-local"
        student_ref = make_student_ref(
            institution_id=student.institution_id, student_id=student.id
        )
        categories = build_minimized_categories(
            [
                "risk_level",
                "grade_averages",
                "attendance_counts",
                "alert_types_levels",
                "report_types_dates",
                "dimension_summary",
                "temporal_note",
            ]
        )

        self.session.add(
            RagQueryModel(
                user_id=current_user.id,
                institution_id=student.institution_id,
                student_id=student.id,
                student_ref=student_ref,
                question=data.question,
                answer=answer,
                context_used=redact_text(structured),
                context_categories=str(categories).replace("'", '"'),
                ai_provider_used=used_llm,
                model=model_used,
                tokens_used=tokens,
                latency_ms=latency_ms,
                detected_risk=detected_risk or student.current_risk_level.value,
            )
        )
        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=student.institution_id,
            scope_type="institution",
            action=RAG_QUERY_EXECUTED,
            entity_type="student",
            entity_id=student.id,
            detail=f"Consulta sobre estudiante {student.id}",
            categories='["rag"]',
        )
        await self.session.commit()

        return RagQueryResponse(
            answer=answer,
            detected_risk_level=detected_risk,
            sources=sources,
            model=model_used,
            latency_ms=latency_ms,
            used_llm=used_llm,
            intent=response_intent,
        )

    async def _build_messages(
        self, student: StudentModel, data: RagQueryRequest
    ) -> tuple[str, list[dict], list[str], list[dict], RagIntent]:
        """Assemble the LLM messages, sources and documents for a student query."""
        structured_full = await self._structured_context(student)
        history_dicts = [
            {"role": m.role, "content": m.content}
            for m in (data.history or [])
        ]
        domain_intent = await classify_intent(data.question, history_dicts, use_llm=True)
        policy = policy_for(domain_intent)
        blocks = parse_structured_blocks(structured_full)
        structured = assemble_context_for_intent(blocks, domain_intent)

        # Grounded JSON package for plan intents (preferred source of truth).
        if domain_intent in {RagIntent.ACTIVE_PLAN, RagIntent.PLAN_PROGRESS}:
            plan_bundle = await load_active_plan_bundle(self.session, student)
            if plan_bundle is not None:
                structured = (
                    f"Fecha de hoy: {date.today().isoformat()}\n\n"
                    "=== DATOS_ESTRUCTURADOS_JSON (fuente de verdad para esta pregunta) ===\n"
                    f"{json.dumps(plan_bundle, ensure_ascii=False, indent=2)}\n"
                )

        # Identity ficha: always present, for any intent (age, course tutor, guardian,
        # subject teachers). Plan JSON above coexists with it, never replaces it.
        ficha = await load_student_ficha(self.session, student)
        structured = merge_structured_with_ficha(structured, format_ficha_block(ficha))

        documents = _search_chroma(student.id, student.institution_id, data.question)

        docs_text = ""
        sources: list[str] = []
        for doc in documents:
            label = SOURCE_LABELS.get(doc["source"], doc["source"] or "Documento")
            sources.append(f"{label} ({doc['id']})")
            docs_text += f"\n[{label}] {doc['text'][:600]}\n"
        sources = self._dedupe_sources(sources)
        if not docs_text:
            docs_text = "(No se encontraron documentos textuales para este estudiante.)"

        doc_inventory = self._document_inventory(documents)
        question_focus = (
            f"INTENT={domain_intent.value}\n{policy.instruction}"
            "\n\nIDENTIDAD: para edad, tutor DEL CURSO, representante o docente de una materia "
            "usa SOLO DATOS_FICHA_JSON. No confundas tutor de curso con ANOTACIONES TUTOR. "
            "Si tutor es null, di que no hay tutor de curso asignado; si guardian es null, "
            "di que no hay representante registrado."
        )
        wants_reco = policy.allows_recommendations or self._wants_recommendations(data.question)
        if not wants_reco:
            question_focus += (
                "\n\nIMPORTANTE: esta pregunta NO pide acción. Responde SOLO el análisis/dato pedido. "
                "PROHIBIDO incluir sección '### Qué hacer ahora', recomendaciones, sugerencias o "
                "próximos pasos. Si los incluyes, la respuesta se considera incorrecta."
            )

        context = (
            f"=== BASE DE CONOCIMIENTO (intent={domain_intent.value}) ===\n"
            f"Responde de forma fundamentada con los datos de abajo. No inventes campos faltantes.\n\n"
            f"{structured}\n\n"
            f"=== INVENTARIO DE DOCUMENTOS RECUPERADOS (ChromaDB) ===\n{doc_inventory}\n\n"
            f"=== FRAGMENTOS TEXTUALES RECUPERADOS ===\n{docs_text}"
        )

        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in (data.history or [])[-6:]:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append(
            {
                "role": "user",
                "content": (
                    f"{context}\n\n"
                    f"=== ENFOQUE DE ESTA PREGUNTA ===\n{question_focus}\n\n"
                    f"=== PREGUNTA DEL PROFESIONAL DECE ===\n{data.question}"
                ),
            }
        )
        return structured_full, messages, sources, documents, domain_intent
    async def query_stream(self, current_user: CurrentUser, data: RagQueryRequest):
        """Async generator of NDJSON-ready events for a streamed RAG answer."""
        started = time.perf_counter()

        student = await self.session.get(StudentModel, data.student_id)
        if student is None:
            raise NotFoundError("Student")
        assert_same_institution(current_user, student.institution_id)

        intent = classify_question_intent(data.question)
        if intent != "student_query":
            answer = GUARD_RESPONSES[intent]
            yield {"type": "meta", "sources": [], "intent": intent}
            yield {"type": "delta", "text": answer}
            await self._persist(
                current_user=current_user,
                student=student,
                question=data.question,
                answer=answer,
                context=f"[intent-guard:{intent}]",
                model="intent-guard",
                tokens=0,
                detected_risk=student.current_risk_level.value,
                audit_detail=f"Consulta rápida ({intent}) estudiante {student.id}: {data.question[:120]}",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
            yield {
                "type": "done",
                "detected_risk_level": None,
                "model": "intent-guard",
                "used_llm": False,
                "intent": intent,
                "latency_ms": int((time.perf_counter() - started) * 1000),
            }
            return

        structured, messages, sources, documents, domain_intent = await self._build_messages(
            student, data
        )
        suppress_reco = not (
            policy_for(domain_intent).allows_recommendations
            or self._wants_recommendations(data.question)
        )

        parts: list[str] = []
        head_buffer = ""       # acumula hasta la primera línea (header CONTROL)
        line_buffer = ""       # acumula la línea de contenido en curso
        head_done = False
        meta_sent = False
        stop = False           # corte duro: sección de recomendaciones no pedida
        risk: str | None = None
        used_llm = True
        error: str | None = None

        try:
            async for delta in chat_completion_stream(messages, temperature=0.15):
                if stop:
                    continue
                if not head_done:
                    head_buffer += delta
                    if "\n" not in head_buffer:
                        continue
                    first, rest = head_buffer.split("\n", 1)
                    _, risk = self._parse_control(first)
                    line_buffer = rest.lstrip("\n")
                    head_done = True
                    yield {"type": "meta", "sources": sources, "intent": "student_query"}
                    meta_sent = True
                else:
                    line_buffer += delta

                while "\n" in line_buffer:
                    line, line_buffer = line_buffer.split("\n", 1)
                    if suppress_reco and self._is_reco_heading(line):
                        stop = True
                        break
                    chunk = line + "\n"
                    parts.append(chunk)
                    yield {"type": "delta", "text": chunk}
                if stop:
                    break
        except DomainError as exc:
            if exc.code == AI_PROVIDER_DISABLED:
                raise
            logger.warning("RAG stream domain error: %s", exc)
            used_llm = False
            error = exc.message
        except Exception as exc:  # noqa: BLE001
            logger.warning("RAG stream failed: %s", exc)
            used_llm = False
            error = str(exc)

        if not stop:
            if not head_done and head_buffer:
                _, risk = self._parse_control(head_buffer)
                leftover = self._strip_control_line(head_buffer)
                if leftover:
                    if not meta_sent:
                        yield {"type": "meta", "sources": sources, "intent": "student_query"}
                        meta_sent = True
                    parts.append(leftover)
                    yield {"type": "delta", "text": leftover}
            elif line_buffer and not (suppress_reco and self._is_reco_heading(line_buffer)):
                parts.append(line_buffer)
                yield {"type": "delta", "text": line_buffer}

        if not meta_sent:
            yield {"type": "meta", "sources": sources, "intent": "student_query"}
            meta_sent = True

        answer = self._strip_control_line("".join(parts)).strip()

        if not answer:
            answer = self._strip_control_line(
                self._fallback_answer(structured, documents, error)
            ).strip()
            used_llm = False
            yield {"type": "delta", "text": answer}

        detected_risk = (
            risk
            or self._infer_risk_from_documents(documents)
            or student.current_risk_level.value
        )
        model_used = DEFAULT_MODEL if used_llm else "fallback-local"
        latency_ms = int((time.perf_counter() - started) * 1000)

        await self._persist(
            current_user=current_user,
            student=student,
            question=data.question,
            answer=answer,
            context=messages[-1]["content"][:8000],
            model=model_used,
            tokens=None,
            detected_risk=detected_risk,
            audit_detail=f"Consulta (stream) sobre estudiante {student.id}: {data.question[:120]}",
            latency_ms=latency_ms,
        )

        yield {
            "type": "done",
            "detected_risk_level": detected_risk,
            "model": model_used,
            "used_llm": used_llm,
            "intent": "student_query",
            "latency_ms": latency_ms,
        }

    async def _persist(
        self,
        *,
        current_user: CurrentUser,
        student: StudentModel,
        question: str,
        answer: str,
        context: str,
        model: str,
        tokens: int | None,
        detected_risk: str,
        audit_detail: str,
        latency_ms: int = 0,
    ) -> None:
        self.session.add(
            RagQueryModel(
                user_id=current_user.id,
                institution_id=student.institution_id,
                student_id=student.id,
                student_ref=make_student_ref(
                    institution_id=student.institution_id, student_id=student.id
                ),
                question=question,
                answer=answer,
                context_used=redact_text(context),
                context_categories='["risk_level","dimension_summary"]',
                ai_provider_used=bool(model and model not in ("intent-guard", "fallback-local")),
                model=model,
                tokens_used=tokens,
                latency_ms=latency_ms,
                detected_risk=detected_risk,
            )
        )
        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=student.institution_id,
            scope_type="institution",
            action=RAG_QUERY_EXECUTED,
            entity_type="student",
            entity_id=student.id,
            detail=audit_detail[:500] if audit_detail else None,
            categories='["rag"]',
        )
        await self.session.commit()

    async def _guard_response(
        self,
        *,
        current_user: CurrentUser,
        student: StudentModel,
        question: str,
        intent: str,
        started: float,
    ) -> RagQueryResponse:
        """Short-circuit off-topic/greeting messages without Chroma or LLM."""
        answer = GUARD_RESPONSES[intent]
        latency_ms = int((time.perf_counter() - started) * 1000)

        self.session.add(
            RagQueryModel(
                user_id=current_user.id,
                institution_id=student.institution_id,
                student_id=student.id,
                student_ref=make_student_ref(
                    institution_id=student.institution_id, student_id=student.id
                ),
                question=question,
                answer=answer,
                context_used=f"[intent-guard:{intent}]",
                context_categories='["intent_guard"]',
                ai_provider_used=False,
                model="intent-guard",
                tokens_used=0,
                latency_ms=latency_ms,
                detected_risk=student.current_risk_level.value,
            )
        )
        await record_audit(
            self.session,
            user_id=current_user.id,
            institution_id=student.institution_id,
            scope_type="institution",
            action=RAG_QUERY_EXECUTED,
            entity_type="student",
            entity_id=student.id,
            detail=f"Consulta fuera de alcance ({intent}) estudiante {student.id}",
            categories='["rag","intent_guard"]',
        )
        await self.session.commit()

        return RagQueryResponse(
            answer=answer,
            detected_risk_level=None,
            sources=[],
            model="intent-guard",
            latency_ms=latency_ms,
            used_llm=False,
            intent=cast(
                Literal["student_query", "greeting", "off_topic", "too_vague"], intent
            ),
        )

    @staticmethod
    def _dedupe_sources(sources: list[str]) -> list[str]:
        seen: set[str] = set()
        deduped: list[str] = []
        for source in sources:
            label = re.sub(r"\s*\([^)]+\)\s*$", "", source).strip()
            if label in seen:
                continue
            seen.add(label)
            deduped.append(source)
        return deduped

    # Header de control que el LLM emite en su PRIMERA línea:
    #   CONTROL: alcance=<dentro|fuera>; riesgo=<bajo|medio|alto|critico>
    _SCOPE_RE = re.compile(r"alcance\s*=\s*(dentro|fuera)", re.IGNORECASE)
    _RISK_RE = re.compile(r"riesgo\s*=\s*(bajo|medio|alto|critico)", re.IGNORECASE)
    _LEGACY_RISK_RE = re.compile(r"NIVEL_RIESGO:\s*(bajo|medio|alto|critico)", re.IGNORECASE)
    _CONTROL_LINE_RE = re.compile(
        r"^\s*\**\s*(?:CONTROL:.*|NIVEL_RIESGO:.*)\**\s*$",
        re.IGNORECASE | re.MULTILINE,
    )
    _OUT_OF_SCOPE_MARKER = re.compile(r"\[?\s*fuera[ _]de[ _]alcance\s*\]?", re.IGNORECASE)

    @classmethod
    def _parse_control(cls, first_line: str) -> tuple[str, str | None]:
        """Parse the CONTROL header. Returns (legacy_scope, risk).

        Scope is ignored for refusal (student-scoped chat always answers).
        Risk is used when present. Missing header → scope 'dentro', risk None.
        """
        scope_match = cls._SCOPE_RE.search(first_line)
        scope = scope_match.group(1).lower() if scope_match else "dentro"
        risk_match = cls._RISK_RE.search(first_line) or cls._LEGACY_RISK_RE.search(first_line)
        risk = risk_match.group(1).lower() if risk_match else None
        return scope, risk

    @classmethod
    def _strip_control_line(cls, answer: str) -> str:
        """Remove the CONTROL/NIVEL_RIESGO header and any out-of-scope marker."""
        cleaned = cls._CONTROL_LINE_RE.sub("", answer)
        cleaned = cls._OUT_OF_SCOPE_MARKER.sub("", cleaned)
        return cleaned.strip()

    async def _structured_context(self, student: StudentModel) -> str:
        course = await self.session.get(CourseModel, student.course_id)
        thirty_days_ago = date.today() - timedelta(days=30)

        avg_result = await self.session.execute(
            select(func.avg(GradeModel.score)).where(GradeModel.student_id == student.id)
        )
        average = avg_result.scalar()

        subject_rows = await self.session.execute(
            select(SubjectModel.name, func.avg(GradeModel.score))
            .join(CourseSubjectModel, CourseSubjectModel.subject_id == SubjectModel.id)
            .join(GradeModel, GradeModel.course_subject_id == CourseSubjectModel.id)
            .where(GradeModel.student_id == student.id)
            .group_by(SubjectModel.name)
            .order_by(func.avg(GradeModel.score))
        )
        subjects = subject_rows.all()

        absence_result = await self.session.execute(
            select(AttendanceModel.status, func.count(AttendanceModel.id))
            .where(
                AttendanceModel.student_id == student.id,
                AttendanceModel.attendance_date >= thirty_days_ago,
            )
            .group_by(AttendanceModel.status)
        )
        attendance = {status: count for status, count in absence_result.all()}

        attendance_by_subject_result = await self.session.execute(
            select(
                SubjectModel.name,
                AttendanceModel.status,
                func.count(AttendanceModel.id),
            )
            .join(CourseSubjectModel, CourseSubjectModel.id == AttendanceModel.course_subject_id)
            .join(SubjectModel, SubjectModel.id == CourseSubjectModel.subject_id)
            .where(
                AttendanceModel.student_id == student.id,
                AttendanceModel.attendance_date >= thirty_days_ago,
            )
            .group_by(SubjectModel.name, AttendanceModel.status)
            .order_by(SubjectModel.name)
        )
        attendance_by_subject: dict[str, dict] = {}
        for subject_name, status, count in attendance_by_subject_result.all():
            bucket = attendance_by_subject.setdefault(subject_name, {})
            bucket[status] = count

        alerts_result = await self.session.execute(
            select(AlertModel)
            .where(
                AlertModel.student_id == student.id,
                AlertModel.status == AlertStatus.ACTIVA,
            )
            .order_by(AlertModel.created_at.desc())
            .limit(5)
        )
        alerts = list(alerts_result.scalars().all())

        today = date.today()
        timeline: list[tuple[date, str]] = []

        lines = [
            f"Fecha de hoy: {today.isoformat()}",
            "--- DATOS ACADÉMICOS Y ASISTENCIA (PostgreSQL) ---",
            f"Nombre: {student.first_name} {student.last_name}",
            f"Curso: {course.name if course else '—'}",
            f"Nivel de riesgo actual (semáforo): {student.current_risk_level.value}",
            f"Promedio general: {float(average):.2f}/10" if average is not None else "Promedio general: sin calificaciones registradas",
        ]
        if subjects:
            lines.append("Promedios por materia (de menor a mayor):")
            for name, avg in subjects:
                lines.append(f"  - {name}: {float(avg):.2f}")
        lines.append(
            "Asistencia últimos 30 días: "
            f"{attendance.get(AttendanceStatus.AUSENTE, 0)} ausencias, "
            f"{attendance.get(AttendanceStatus.TARDANZA, 0)} tardanzas, "
            f"{attendance.get(AttendanceStatus.JUSTIFICADO, 0)} justificadas"
        )
        if attendance_by_subject:
            lines.append("Asistencia por asignatura (últimos 30 días):")
            for subject_name, counts in attendance_by_subject.items():
                lines.append(
                    f"  - {subject_name}: "
                    f"{counts.get(AttendanceStatus.AUSENTE, 0)} ausencias, "
                    f"{counts.get(AttendanceStatus.TARDANZA, 0)} tardanzas, "
                    f"{counts.get(AttendanceStatus.JUSTIFICADO, 0)} justificadas, "
                    f"{counts.get(AttendanceStatus.PRESENTE, 0)} presentes"
                )
        else:
            lines.append("Asistencia por asignatura (últimos 30 días): sin registros")
        if alerts:
            lines.append("Alertas activas:")
            for alert in alerts:
                lines.append(
                    f"  - [{alert.level.value.upper()}] {alert.alert_type.value}: "
                    f"{alert.description[:200]}"
                )
        else:
            lines.append("Alertas activas: ninguna")

        lines.append(
            "--- ACCIONES EJECUTADAS (intervenciones DECE efectivamente realizadas = alertas atendidas; "
            "SOLO esto cuenta como 'acción ya realizada') ---"
        )

        attended_result = await self.session.execute(
            select(AlertModel)
            .where(
                AlertModel.student_id == student.id,
                AlertModel.status == AlertStatus.ATENDIDA,
            )
            .order_by(AlertModel.attended_at.desc())
            .limit(5)
        )
        attended = list(attended_result.scalars().all())
        if attended:
            for alert in attended:
                actions = (alert.actions_taken or "sin detalle").strip()
                attended_at = (
                    alert.attended_at.strftime("%Y-%m-%d") if alert.attended_at else "fecha no registrada"
                )
                lines.append(
                    f"  - Alerta {alert.level.value} atendida el {attended_at}: {actions}"
                )
                if alert.attended_at:
                    timeline.append(
                        (
                            alert.attended_at.date(),
                            f"Alerta {alert.level.value} ATENDIDA — acciones: {actions[:160]}",
                        )
                    )
        else:
            lines.append("  - No constan acciones ejecutadas (alertas atendidas): ninguna registrada")

        lines.append(
            "--- PLAN DE ATENCIÓN ACTIVO (ActionPlan versionado; no inventar acciones ni artículos) ---"
        )
        try:
            from app.modules.action_plans.infrastructure.models import (
                ActionPlanItemModel,
                ActionPlanModel,
                ActionPlanNormativeRefModel,
                ActionPlanNoteModel,
            )
            from app.modules.cases.infrastructure.models import DeceCaseModel
            from app.shared.feature_flags import action_plans_enabled

            if action_plans_enabled():
                # Misma lógica que ActionPlanService.get_active_for_student:
                # buscar plan activo por estudiante (cualquier caso no eliminado).
                plan_row = await self.session.execute(
                    select(ActionPlanModel)
                    .join(DeceCaseModel, DeceCaseModel.id == ActionPlanModel.case_id)
                    .where(
                        DeceCaseModel.student_id == student.id,
                        DeceCaseModel.institution_id == student.institution_id,
                        DeceCaseModel.deleted_at.is_(None),
                        ActionPlanModel.status == "active",
                    )
                    .order_by(ActionPlanModel.version.desc(), ActionPlanModel.id.desc())
                    .limit(1)
                )
                active_plan = plan_row.scalar_one_or_none()
                if active_plan is None:
                    draft_row = await self.session.execute(
                        select(ActionPlanModel)
                        .join(DeceCaseModel, DeceCaseModel.id == ActionPlanModel.case_id)
                        .where(
                            DeceCaseModel.student_id == student.id,
                            DeceCaseModel.institution_id == student.institution_id,
                            DeceCaseModel.deleted_at.is_(None),
                            ActionPlanModel.status.in_(("draft", "pending_approval")),
                        )
                        .order_by(ActionPlanModel.id.desc())
                        .limit(1)
                    )
                    draft_plan = draft_row.scalar_one_or_none()
                    if draft_plan is not None:
                        lines.append(
                            f"  - No hay plan ACTIVO. Existe borrador id={draft_plan.id} "
                            f"estado={draft_plan.status} (aún no aprobado/activado)."
                        )
                    else:
                        lines.append("  - No hay plan de atención activo para este estudiante")
                else:
                    lines.append(
                        f"  - HAY PLAN ACTIVO EN MARCHA: id={active_plan.id} "
                        f"caso_id={active_plan.case_id} v{active_plan.version} "
                        f"tipo={active_plan.plan_type} "
                        f"objetivo=\"{(active_plan.general_objective or '')[:240]}\""
                    )
                    if active_plan.review_at_hint:
                        lines.append(
                            f"  - Próxima revisión sugerida: {active_plan.review_at_hint}"
                        )
                    # Activación / creación del plan (nivel plan, no acción)
                    creator = await self.session.get(UserModel, active_plan.created_by)
                    creator_name = (
                        f"{creator.first_name} {creator.last_name}".strip()
                        if creator
                        else f"usuario_id={active_plan.created_by}"
                    )
                    created_at = (
                        active_plan.created_at.strftime("%Y-%m-%d %H:%M")
                        if active_plan.created_at
                        else "—"
                    )
                    lines.append(
                        f"  - Plan creado por: {creator_name} el {created_at}"
                    )
                    if active_plan.approved_by or active_plan.approved_at:
                        approver = (
                            await self.session.get(UserModel, active_plan.approved_by)
                            if active_plan.approved_by
                            else None
                        )
                        approver_name = (
                            f"{approver.first_name} {approver.last_name}".strip()
                            if approver
                            else (
                                f"usuario_id={active_plan.approved_by}"
                                if active_plan.approved_by
                                else "—"
                            )
                        )
                        approved_at = (
                            active_plan.approved_at.strftime("%Y-%m-%d %H:%M")
                            if active_plan.approved_at
                            else "—"
                        )
                        lines.append(
                            f"  - Plan activado/aprobado por: {approver_name} el {approved_at}"
                        )
                        if active_plan.approval_comment:
                            lines.append(
                                f"  - Comentario de activación: {active_plan.approval_comment[:240]}"
                            )

                    items = await self.session.execute(
                        select(ActionPlanItemModel)
                        .where(ActionPlanItemModel.plan_id == active_plan.id)
                        .order_by(ActionPlanItemModel.priority)
                    )
                    item_rows = list(items.scalars().all())
                    status_es = {
                        "pending": "pendiente (no reportada)",
                        "in_progress": "en progreso",
                        "reported_completed": "reportada (pendiente validación DECE)",
                        "validated": "validada/aprobada por DECE",
                    }
                    note_kind_es = {
                        "progress_report": "reporte_de_avance",
                        "validation_approved": "validacion_aprobada",
                        "validation_rejected": "validacion_rechazada",
                        "manual": "nota_manual",
                    }
                    counts = {
                        "pending": 0,
                        "in_progress": 0,
                        "reported_completed": 0,
                        "validated": 0,
                    }
                    for item in item_rows:
                        counts[item.status] = counts.get(item.status, 0) + 1
                    lines.append(
                        "  - RESUMEN DE AVANCE DEL PLAN (usar esto si preguntan reportadas/aprobadas/"
                        "pendientes/vigentes): "
                        f"pendientes={counts.get('pending', 0)}; "
                        f"en_progreso={counts.get('in_progress', 0)}; "
                        f"reportadas_sin_validar={counts.get('reported_completed', 0)}; "
                        f"validadas_aprobadas={counts.get('validated', 0)}. "
                        "NO confundir con ACCIONES EJECUTADAS de alertas."
                    )

                    notes_result = await self.session.execute(
                        select(ActionPlanNoteModel)
                        .where(ActionPlanNoteModel.plan_id == active_plan.id)
                        .order_by(
                            ActionPlanNoteModel.created_at.asc(),
                            ActionPlanNoteModel.id.asc(),
                        )
                    )
                    notes = list(notes_result.scalars().all())
                    author_ids = {n.author_id for n in notes}
                    authors: dict[int, str] = {}
                    for uid in author_ids:
                        user = await self.session.get(UserModel, uid)
                        if user:
                            authors[uid] = f"{user.first_name} {user.last_name}".strip()
                        else:
                            authors[uid] = f"usuario_id={uid}"

                    notes_by_item: dict[int | None, list] = {}
                    for note in notes:
                        notes_by_item.setdefault(note.item_id, []).append(note)

                    lines.append(
                        "  - DETALLE DE ACCIONES (incluye autor/fecha de reporte y validación si existen notas):"
                    )
                    for item in item_rows:
                        due_bit = item.due_hint or "—"
                        if item.due_at:
                            due_bit = (
                                f"{due_bit}; fecha_limite={item.due_at.date().isoformat()}"
                            )
                        label = status_es.get(item.status, item.status)
                        lines.append(
                            f"    · item_id={item.id} [{item.status} = {label}] p{item.priority}: "
                            f"\"{item.title}\" (responsable_rol={item.responsible_role}; "
                            f"plazo={due_bit}; progreso_validado={item.progress_pct_validated}%)"
                        )
                        if item.objective:
                            lines.append(f"      objetivo: {item.objective[:220]}")
                        item_notes = notes_by_item.get(item.id) or []
                        if not item_notes:
                            lines.append(
                                "      bitácora: sin notas de reporte ni validación registradas"
                            )
                            continue
                        for note in item_notes:
                            kind = note_kind_es.get(note.note_kind or "", note.note_kind or "nota")
                            when = (
                                note.created_at.strftime("%Y-%m-%d %H:%M")
                                if note.created_at
                                else "—"
                            )
                            author = authors.get(note.author_id, f"usuario_id={note.author_id}")
                            excerpt = (note.text or "").strip().replace("\n", " ")[:280]
                            lines.append(
                                f"      bitácora [{kind}] por {author} el {when}: \"{excerpt}\""
                            )

                    plan_level_notes = notes_by_item.get(None) or []
                    if plan_level_notes:
                        lines.append("  - Notas generales del plan (sin acción asociada):")
                        for note in plan_level_notes:
                            kind = note_kind_es.get(note.note_kind or "", note.note_kind or "nota")
                            when = (
                                note.created_at.strftime("%Y-%m-%d %H:%M")
                                if note.created_at
                                else "—"
                            )
                            author = authors.get(note.author_id, f"usuario_id={note.author_id}")
                            excerpt = (note.text or "").strip().replace("\n", " ")[:280]
                            lines.append(
                                f"    · [{kind}] por {author} el {when}: \"{excerpt}\""
                            )

                    refs = await self.session.execute(
                        select(ActionPlanNormativeRefModel).where(
                            ActionPlanNormativeRefModel.plan_id == active_plan.id
                        )
                    )
                    for ref in refs.scalars().all():
                        lines.append(
                            "    · Cita normativa: "
                            f"{{document_code:{ref.document_code}, version:{ref.version}, "
                            f"article:{ref.article}, title:{ref.article_title}, "
                            f"effective_from:{ref.effective_from}, "
                            f"source_chunk_id:{ref.source_chunk_id}}}"
                        )
            else:
                lines.append("  - Módulo de planes deshabilitado (FEATURE_ACTION_PLANS=false)")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Active plan context skipped: %s", exc)
            lines.append("  - Plan activo no disponible en este momento")

        dece_result = await self.session.execute(
            select(DeceReportModel)
            .where(DeceReportModel.student_id == student.id)
            .order_by(DeceReportModel.reported_at.desc())
            .limit(10)
        )
        dece_rows = list(dece_result.scalars().all())
        lines.append(
            "--- REPORTES DECE (EVIDENCIA, no son acciones ejecutadas; 'plan=' es lo propuesto en el "
            "reporte, NO necesariamente realizado) ---"
        )
        if dece_rows:
            for row in dece_rows:
                actions = (
                    row.actions_taken.strip()
                    if row.actions_taken
                    else "(sin plan de acción registrado en este reporte)"
                )
                desc = (row.description or "").strip()
                type_label = row.report_type.value.replace("_", " ")
                reported = row.reported_at.strftime("%Y-%m-%d") if row.reported_at else "—"
                lines.append(
                    f"  - Reporte DECE [{type_label}] ({reported}, urgencia {row.urgency_level.value}): "
                    f"{desc[:200]} | plan=\"{actions[:200]}\""
                )
                if row.reported_at:
                    timeline.append(
                        (
                            row.reported_at.date(),
                            f"DECE [{type_label}] (urgencia {row.urgency_level.value}): {desc[:150]}",
                        )
                    )
        else:
            lines.append("  - Reportes DECE: ninguno registrado")

        tutor_result = await self.session.execute(
            select(TutorAnnotationModel)
            .where(TutorAnnotationModel.student_id == student.id)
            .order_by(TutorAnnotationModel.annotated_at.desc())
            .limit(10)
        )
        tutor_rows = list(tutor_result.scalars().all())
        lines.append("--- ANOTACIONES TUTOR (PostgreSQL) ---")
        if tutor_rows:
            for row in tutor_rows:
                annotated = row.annotated_at.strftime("%Y-%m-%d") if row.annotated_at else "—"
                lines.append(
                    f"  - [{row.annotation_type.value}] ({annotated}): {row.description[:300]}"
                )
                if row.annotated_at:
                    timeline.append(
                        (
                            row.annotated_at.date(),
                            f"Tutor [{row.annotation_type.value}]: {row.description[:150]}",
                        )
                    )
        else:
            lines.append("  - Ninguna anotación de tutor registrada")

        lines.append("--- RESUMEN POR DIMENSIÓN (clasificar el caso) ---")
        for dim_line in self._dimension_summary(
            average, subjects, attendance, alerts, dece_rows, tutor_rows
        ):
            lines.append(dim_line)

        lines.append("--- NOTA COMPARATIVA TEMPORAL (leer antes de afirmar mejora/empeoramiento/estabilidad) ---")
        lines.append(self._comparison_temporal_note(timeline, today, attended))

        lines.append("--- CRONOLOGÍA UNIFICADA (más reciente primero; usa esto para preguntas de tiempo/tendencia) ---")
        if timeline:
            timeline.sort(key=lambda item: item[0], reverse=True)
            for event_date, text in timeline:
                lines.append(f"  - {event_date.isoformat()} ({self._relative_age(event_date, today)}): {text}")
        else:
            lines.append("  - Sin eventos conductuales, emocionales ni de intervención registrados.")

        return "\n".join(lines)

    @staticmethod
    def _relative_age(event_date: date, today: date) -> str:
        days = (today - event_date).days
        if days <= 0:
            return "hoy"
        if days == 1:
            return "hace 1 día"
        if days < 14:
            return f"hace {days} días"
        weeks = days // 7
        return f"hace {weeks} semana{'s' if weeks != 1 else ''}"

    @staticmethod
    def _dimension_summary(
        average,
        subjects,
        attendance,
        alerts,
        dece_rows,
        tutor_rows,
    ) -> list[str]:
        """Structured risk dimensions for DECE classification questions."""
        lines: list[str] = []

        if average is not None:
            lowest = subjects[0] if subjects else None
            if lowest:
                lines.append(
                    f"Académico: promedio general {float(average):.2f}/10; "
                    f"materia más baja: {lowest[0]} ({float(lowest[1]):.2f})"
                )
            else:
                lines.append(f"Académico: promedio general {float(average):.2f}/10")
        else:
            lines.append("Académico: sin calificaciones registradas")

        absences = attendance.get(AttendanceStatus.AUSENTE, 0)
        tardies = attendance.get(AttendanceStatus.TARDANZA, 0)
        lines.append(
            f"Asistencia (30 días): {absences} ausencias, {tardies} tardanzas"
        )

        conductual_bits: list[str] = []
        emocional_bits: list[str] = []
        for row in dece_rows:
            desc = (row.description or "")[:120]
            reported = row.reported_at.strftime("%Y-%m-%d") if row.reported_at else "—"
            label = row.report_type.value.replace("_", " ")
            snippet = f"[{label}] {reported}: {desc}"
            if row.report_type.value in ("alerta_emocional", "derivacion"):
                emocional_bits.append(snippet)
            elif row.report_type.value in (
                "observacion_conductual",
                "entrevista",
                "seguimiento",
                "plan_intervencion",
            ):
                conductual_bits.append(snippet)
        for row in tutor_rows:
            desc = (row.description or "")[:120]
            annotated = row.annotated_at.strftime("%Y-%m-%d") if row.annotated_at else "—"
            snippet = f"[tutor {row.annotation_type.value}] {annotated}: {desc}"
            if row.annotation_type.value in ("emocional", "familiar"):
                emocional_bits.append(snippet)
            else:
                conductual_bits.append(snippet)

        if conductual_bits:
            lines.append(f"Conductual: {' | '.join(conductual_bits[:2])}")
        else:
            lines.append("Conductual: sin reportes conductuales registrados")

        if emocional_bits:
            lines.append(f"Emocional/social: {' | '.join(emocional_bits[:2])}")
        else:
            lines.append("Emocional/social: sin reportes emocionales registrados")

        if alerts:
            lines.append(
                f"Alertas activas: {len(alerts)} "
                f"({', '.join(a.alert_type.value for a in alerts[:3])})"
            )
        else:
            lines.append("Alertas activas: ninguna")

        return lines

    @staticmethod
    def _comparison_temporal_note(
        timeline: list[tuple[date, str]],
        today: date,
        attended: list,
    ) -> str:
        """Tell the LLM whether comparative before/after claims are supported."""
        if not timeline and not attended:
            return (
                "No hay eventos en cronología ni alertas atendidas. "
                "NO afirmes evolución, mejora, empeoramiento ni efecto de intervención."
            )

        behavioral_dates = [d for d, text in timeline if "ATENDIDA" not in text]
        intervention_dates = [d for d, text in timeline if "ATENDIDA" in text]
        if attended:
            for alert in attended:
                if alert.attended_at:
                    intervention_dates.append(alert.attended_at.date())

        all_dates = behavioral_dates + intervention_dates
        if not all_dates:
            return "Sin fechas comparables. Reconoce límite del expediente."

        parts: list[str] = []

        if behavioral_dates:
            most_recent_beh = max(behavioral_dates)
            days_since_beh = (today - most_recent_beh).days
            parts.append(
                f"Último registro conductual/emocional (DECE/tutor): "
                f"{most_recent_beh.isoformat()} ({RagService._relative_age(most_recent_beh, today)})."
            )
            if days_since_beh > 21:
                parts.append(
                    "No hay reportes conductuales/emocionales nuevos en las últimas 3 semanas; "
                    "NO afirmes que la conducta empeoró, mejoró o 'persiste' sin evidencia posterior."
                )
        else:
            parts.append("Sin registros conductuales/emocionales en cronología.")

        if intervention_dates:
            most_recent_int = max(intervention_dates)
            parts.append(
                f"Última intervención/atención documentada: "
                f"{most_recent_int.isoformat()} ({RagService._relative_age(most_recent_int, today)})."
            )
            if behavioral_dates and most_recent_int > max(behavioral_dates):
                parts.append(
                    "Hubo intervención DESPUÉS del último reporte conductual/emocional; "
                    "para evaluar efecto de acciones, NO hay registros conductuales posteriores a esa intervención."
                )

        if len(set(behavioral_dates)) <= 1 and behavioral_dates:
            parts.append(
                "Los reportes conductuales/emocionales concentran una sola fecha; "
                "NO hay base comparativa para afirmar cambio respecto a registros anteriores."
            )

        return " ".join(parts)

    @staticmethod
    def _document_inventory(documents: list[dict]) -> str:
        if not documents:
            return "Ningún documento textual recuperado para esta consulta."
        counts: dict[str, int] = {}
        for doc in documents:
            label = SOURCE_LABELS.get(doc.get("source", ""), doc.get("source") or "Documento")
            counts[label] = counts.get(label, 0) + 1
        parts = [f"- {count} {label}(s)" for label, count in counts.items()]
        return (
            "Documentos disponibles en esta consulta (NO negar su existencia):\n"
            + "\n".join(parts)
        )

    # Marcadores que indican que el DECE SÍ pide acción/recomendaciones.
    _ACTION_MARKERS = (
        "deber",
        "debería",
        "deberia",
        "deben",
        "debo ",
        "se debe",
        "hay que",
        "tengo que",
        "qué hago",
        "que hago",
        "qué debo",
        "que debo",
        "recomiend",
        "recomién",
        "recomien",
        "sugiér",
        "sugier",
        "sugerenc",
        "siguiente paso",
        "próximo paso",
        "proximo paso",
        "próximos pasos",
        "proximos pasos",
        "qué hacer",
        "que hacer",
        "qué hago ahora",
        "cómo intervenir",
        "como intervenir",
        "plan de acción",
        "plan de accion",
        "plan de intervención",
        "plan de intervencion",
        "decidir hoy",
        "acción inmediata",
        "accion inmediata",
        "cómo procedo",
        "como procedo",
        "qué medidas",
        "que medidas",
        "esta semana",
        "próxima semana",
        "proxima semana",
        "priorizar",
        "priorizo",
        "prioriza",
        "priorice",
        "prioridad hoy",
        "tomar esta",
        "acciones a tomar",
    )

    # Frases que anulan explícitamente cualquier recomendación.
    _NO_RECO_MARKERS = (
        "no incluyas recomendaciones",
        "no incluyas próximos",
        "no incluyas proximos",
        "no des recomendaciones",
        "no recomiendes",
        "sin recomendaciones",
        "no generalices",
        "solo analiza",
        "sólo analiza",
        "únicamente analiza",
        "unicamente analiza",
        "no propongas",
        "no sugieras",
        "sin próximos pasos",
        "sin proximos pasos",
    )

    @classmethod
    def _wants_recommendations(cls, question: str) -> bool:
        """Default: NO. Solo True si el DECE pide acción y no lo prohíbe explícitamente."""
        q = question.lower()
        if any(marker in q for marker in cls._NO_RECO_MARKERS):
            return False
        return any(marker in q for marker in cls._ACTION_MARKERS)

    @staticmethod
    def _is_reco_heading(line: str) -> bool:
        """Detecta encabezados de recomendaciones/próximos pasos para el corte duro."""
        normalized = re.sub(r"[#*_>\-\s]+", " ", line.strip().lower()).strip()
        if not normalized:
            return False
        reco_starts = (
            "que hacer",
            "qué hacer",
            "que hacer ahora",
            "recomendaci",
            "recomiend",
            "proximos pasos",
            "próximos pasos",
            "proximo paso",
            "plan de accion",
            "plan de acción",
            "acciones sugeridas",
            "acciones recomendadas",
            "sugerencias",
        )
        return any(normalized.startswith(start) for start in reco_starts)

    @classmethod
    def _strip_reco_sections(cls, text: str) -> str:
        """Corta el texto en el primer encabezado de recomendaciones (ruta no-stream)."""
        lines = text.split("\n")
        kept: list[str] = []
        for line in lines:
            if cls._is_reco_heading(line):
                break
            kept.append(line)
        return "\n".join(kept).strip()

    @staticmethod
    def _question_focus(question: str) -> str:
        """Compat shim: prefer IntentPolicy via classify_intent/_build_messages."""
        from app.modules.rag.application.intent import RagIntent, policy_for, score_intent

        intent, score = score_intent(question)
        if score <= 0:
            intent = RagIntent.GENERAL
        return f"INTENT={intent.value}\n{policy_for(intent).instruction}"

    @classmethod
    def _extract_risk(cls, answer: str) -> str | None:
        match = cls._RISK_RE.search(answer) or cls._LEGACY_RISK_RE.search(answer)
        if match:
            return match.group(1).lower()
        return None

    @staticmethod
    def _infer_risk_from_documents(documents: list[dict]) -> str | None:
        if not documents:
            return None
        combined = " ".join(doc.get("text", "") for doc in documents).lower()
        if any(w in combined for w in ("critico", "crítico", "urgencia: critico", "urgencia: alto")):
            return "alto"
        dece_or_emotional = sum(
            1 for doc in documents if doc.get("source") in ("reporte_dece", "anotacion_tutor")
        )
        if dece_or_emotional >= 2 or any(
            w in combined
            for w in ("emocional", "conductual", "aislamiento", "conflicto", "agresiv")
        ):
            return "medio"
        if dece_or_emotional >= 1:
            return "medio"
        return None

    def _resolve_risk_level(
        self, answer: str, student: StudentModel, documents: list[dict]
    ) -> str:
        parsed = self._extract_risk(answer)
        if parsed:
            return parsed
        inferred = self._infer_risk_from_documents(documents)
        if inferred:
            return inferred
        return student.current_risk_level.value

    @staticmethod
    def _fallback_answer(structured: str, documents: list[dict], error: str | None) -> str:
        docs_summary = ""
        for doc in documents[:3]:
            label = SOURCE_LABELS.get(doc["source"], "Documento")
            docs_summary += f"- [{label}] {doc['text'][:200]}...\n"
        if not docs_summary:
            docs_summary = "- No se encontraron documentos textuales registrados.\n"
        return (
            "**Resumen generado sin IA** (el modelo de lenguaje no está disponible: "
            f"{error or 'sin conexión'}).\n\n"
            "**Datos estructurados del estudiante:**\n"
            f"{structured}\n\n"
            "**Documentos más relevantes:**\n"
            f"{docs_summary}\n"
            "**Recomendaciones de Intervención**\n"
            "- Revisar manualmente el historial completo del estudiante en su perfil 360°.\n"
            "- Configurar la clave de OpenRouter para habilitar el análisis con IA.\n"
            "NIVEL_RIESGO: medio"
        )

    async def history(
        self, current_user: CurrentUser, limit: int = 100
    ) -> list[RagHistoryEntry]:
        """RN-07: admin sees everything; DECE only their own queries."""
        query = (
            select(RagQueryModel, UserModel, StudentModel)
            .join(UserModel, RagQueryModel.user_id == UserModel.id)
            .join(StudentModel, RagQueryModel.student_id == StudentModel.id)
            .order_by(RagQueryModel.created_at.desc())
            .limit(limit)
        )
        if current_user.active_role != UserRole.ADMINISTRADOR:
            query = query.where(RagQueryModel.user_id == current_user.id)

        result = await self.session.execute(query)
        entries = []
        for log, user, student in result.all():
            entries.append(
                RagHistoryEntry(
                    id=log.id,
                    user_name=f"{user.first_name} {user.last_name}",
                    student_name=f"{student.first_name} {student.last_name}",
                    question=log.question,
                    answer=log.answer,
                    model=log.model,
                    tokens_used=log.tokens_used,
                    latency_ms=log.latency_ms,
                    detected_risk=log.detected_risk,
                    created_at=log.created_at,
                )
            )
        return entries

    async def metrics(self) -> RagMetrics:
        """RF-52: RAG usage metrics."""
        total_result = await self.session.execute(select(func.count(RagQueryModel.id)))
        total = total_result.scalar() or 0

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
        today_result = await self.session.execute(
            select(func.count(RagQueryModel.id)).where(
                RagQueryModel.created_at >= today_start
            )
        )
        today = today_result.scalar() or 0

        latency_result = await self.session.execute(
            select(func.avg(RagQueryModel.latency_ms))
        )
        avg_latency = float(latency_result.scalar() or 0)

        per_day_result = await self.session.execute(
            select(
                func.date(RagQueryModel.created_at).label("day"),
                func.count(RagQueryModel.id),
            )
            .where(RagQueryModel.created_at >= datetime.now(timezone.utc) - timedelta(days=14))
            .group_by(func.date(RagQueryModel.created_at))
            .order_by(func.date(RagQueryModel.created_at))
        )
        per_day = [
            {"day": str(day), "count": count} for day, count in per_day_result.all()
        ]

        models_result = await self.session.execute(
            select(RagQueryModel.model, func.count(RagQueryModel.id)).group_by(
                RagQueryModel.model
            )
        )
        models = [{"model": model, "count": count} for model, count in models_result.all()]

        return RagMetrics(
            total_queries=total,
            queries_today=today,
            avg_latency_ms=round(avg_latency, 1),
            queries_per_day=per_day,
            models_used=models,
        )
