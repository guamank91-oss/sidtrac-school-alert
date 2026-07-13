from __future__ import annotations

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
from app.modules.rag.application.openrouter import (
    DEFAULT_MODEL,
    chat_completion,
    chat_completion_stream,
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
from app.shared.auth_context import CurrentUser
from app.shared.enums import AlertStatus, AttendanceStatus, RiskLevel, UserRole
from app.shared.exceptions import ForbiddenError, NotFoundError
from app.shared.tenant import assert_same_institution

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el asistente psicopedagógico de SIDTRAC para el DECE (Departamento de \
Consejería Estudiantil) de un colegio de Bachillerato en Ecuador. Hablas con un profesional del DECE, \
no con el estudiante ni la familia.

FUENTE DE VERDAD:
- Usa EXCLUSIVAMENTE el bloque "BASE DE CONOCIMIENTO" que recibes (PostgreSQL + ChromaDB). No inventes \
ni uses conocimiento externo para afirmar hechos del estudiante.
- Distingue los tipos con PRECISIÓN: "observación conductual", "alerta emocional", "reporte disciplinario" \
y "anotación de tutor" NO son sinónimos. Nunca llames "emocional" a algo conductual ni al revés.

CONTROL DE ALCANCE (regla dura, la decides TÚ):
- La PRIMERA línea de tu respuesta debe ser EXACTAMENTE este header, sin nada más:
  `CONTROL: alcance=<dentro|fuera>; riesgo=<bajo|medio|alto|critico>`
- alcance=dentro: la pregunta trata del SEGUIMIENTO de ESTE estudiante (académico, asistencia, conducta, \
emocional, alertas, intervención DECE) O es un seguimiento del hilo (p. ej. "¿cuáles son?", "detalla", "y eso?").
- alcance=fuera: la pregunta NO trata de este estudiante ni de su seguimiento escolar (matemáticas, clima, \
cultura general, chistes, código, charla trivial, etc.). En ese caso, tras el header escribe ÚNICAMENTE la \
palabra `[FUERA_DE_ALCANCE]` y NADA más. No inventes datos ni intentes responder la pregunta.
- `riesgo` debe ser coherente con el semáforo y los reportes. Si alcance=fuera, pon el riesgo del semáforo.

USA EL HISTORIAL: preguntas de seguimiento como "¿cuáles son?", "detalla", "enuméralas", "y eso?" se \
refieren a lo ÚLTIMO que dijiste. NO cambies de tema: si venías hablando de anotaciones, sigue con \
anotaciones (no respondas con promedios). Si el usuario pide "cuáles", ENUMERA los ítems concretos.

CÓMO RESPONDER (cuando alcance=dentro):
1. Después del header CONTROL, deja una línea en blanco y escribe una RESPUESTA DIRECTA de 1 o 2 frases que \
conteste literalmente la pregunta (empieza con Sí / No / lo esencial). Sin rodeos ni preámbulos.
2. Después, SOLO si aporta valor, agrega secciones breves con encabezados "### " (p. ej. "### Evidencia", \
"### Qué hacer ahora"). Pregunta simple = respuesta corta. NO fuerces plantillas de 3 secciones si no hace falta.

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

        structured, messages, sources, documents = await self._build_messages(student, data)

        answer, tokens, error = await chat_completion(messages, temperature=0.15)
        used_llm = answer is not None

        if answer is None:
            answer = self._fallback_answer(structured, documents, error)

        scope, parsed_risk = self._parse_control(answer)

        if scope == "fuera":
            answer = GUARD_RESPONSES["off_topic"]
            sources = []
            detected_risk = None
            response_intent: Literal[
                "student_query", "greeting", "off_topic", "too_vague"
            ] = "off_topic"
        else:
            answer = self._strip_control_line(answer)
            if not answer:
                answer = self._strip_control_line(
                    self._fallback_answer(structured, documents, error)
                )
                used_llm = False
            detected_risk = parsed_risk or self._resolve_risk_level(answer, student, documents)
            if not self._wants_recommendations(data.question):
                answer = self._strip_reco_sections(answer)
            response_intent = "student_query"

        latency_ms = int((time.perf_counter() - started) * 1000)
        model_used = DEFAULT_MODEL if used_llm else "fallback-local"

        self.session.add(
            RagQueryModel(
                user_id=current_user.id,
                institution_id=student.institution_id,
                student_id=student.id,
                question=data.question,
                answer=answer,
                context_used="[REDACTED]",
                context_categories='["pending_minimization_pipeline"]',
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
            action="rag_query_executed",
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
    ) -> tuple[str, list[dict], list[str], list[dict]]:
        """Assemble the LLM messages, sources and documents for a student query."""
        structured = await self._structured_context(student)
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
        question_focus = self._question_focus(data.question)
        if not self._wants_recommendations(data.question):
            question_focus += (
                "\n\nIMPORTANTE: esta pregunta NO pide acción. Responde SOLO el análisis/dato pedido. "
                "PROHIBIDO incluir sección '### Qué hacer ahora', recomendaciones, sugerencias o "
                "próximos pasos. Si los incluyes, la respuesta se considera incorrecta."
            )

        context = (
            f"=== BASE DE CONOCIMIENTO (PostgreSQL + ChromaDB) ===\n"
            f"Información completa disponible en el sistema para este estudiante.\n"
            f"No afirmes hechos que no aparezcan aquí abajo.\n\n"
            f"{structured}\n\n"
            f"=== INVENTARIO DE DOCUMENTOS RECUPERADOS (ChromaDB) ===\n{doc_inventory}\n\n"
            f"=== FRAGMENTOS TEXTUALES RECUPERADOS ===\n{docs_text}"
        )

        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in data.history[-6:]:
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
        return structured, messages, sources, documents

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

        structured, messages, sources, documents = await self._build_messages(student, data)
        suppress_reco = not self._wants_recommendations(data.question)

        parts: list[str] = []
        head_buffer = ""       # acumula hasta la primera línea (header CONTROL)
        line_buffer = ""       # acumula la línea de contenido en curso
        head_done = False
        meta_sent = False
        stop = False           # corte duro: sección de recomendaciones no pedida
        scope = "dentro"       # lo decide el LLM en el header CONTROL
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
                    scope, risk = self._parse_control(first)
                    line_buffer = rest.lstrip("\n")
                    head_done = True
                    if scope == "fuera":
                        break  # fuera de alcance: descartamos el cuerpo del LLM
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
        except Exception as exc:  # noqa: BLE001
            logger.warning("RAG stream failed: %s", exc)
            used_llm = False
            error = str(exc)

        # El LLM decidió que la pregunta está fuera de alcance.
        if scope == "fuera":
            answer = GUARD_RESPONSES["off_topic"]
            yield {"type": "meta", "sources": [], "intent": "off_topic"}
            yield {"type": "delta", "text": answer}
            await self._persist(
                current_user=current_user,
                student=student,
                question=data.question,
                answer=answer,
                context=messages[-1]["content"][:8000],
                model=DEFAULT_MODEL,
                tokens=None,
                detected_risk=student.current_risk_level.value,
                audit_detail=f"Consulta fuera de alcance (LLM) estudiante {student.id}: {data.question[:120]}",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
            yield {
                "type": "done",
                "detected_risk_level": None,
                "model": DEFAULT_MODEL,
                "used_llm": False,
                "intent": "off_topic",
                "latency_ms": int((time.perf_counter() - started) * 1000),
            }
            return

        if not stop:
            if not head_done and head_buffer:
                scope, risk = self._parse_control(head_buffer)
                if scope == "fuera":
                    answer = GUARD_RESPONSES["off_topic"]
                    yield {"type": "meta", "sources": [], "intent": "off_topic"}
                    yield {"type": "delta", "text": answer}
                    await self._persist(
                        current_user=current_user,
                        student=student,
                        question=data.question,
                        answer=answer,
                        context=messages[-1]["content"][:8000],
                        model=DEFAULT_MODEL,
                        tokens=None,
                        detected_risk=student.current_risk_level.value,
                        audit_detail=f"Consulta fuera de alcance (LLM) estudiante {student.id}: {data.question[:120]}",
                        latency_ms=int((time.perf_counter() - started) * 1000),
                    )
                    yield {
                        "type": "done",
                        "detected_risk_level": None,
                        "model": DEFAULT_MODEL,
                        "used_llm": False,
                        "intent": "off_topic",
                        "latency_ms": int((time.perf_counter() - started) * 1000),
                    }
                    return
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
                question=question,
                answer=answer,
                context_used="[REDACTED]",
                context_categories='["pending_minimization_pipeline"]',
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
            action="rag_query_executed",
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
            action="rag_query_executed",
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
        """Parse the CONTROL header. Returns (scope, risk).

        scope defaults to 'dentro' (safer: prefer answering a student query
        over wrongly refusing) when the LLM omits the header.
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
        q = question.lower()
        if any(k in q for k in ("agresiv", "bullying", "conflicto", "pelea", "violencia", "incumplimiento")):
            return (
                "Pregunta sobre agresividad, conflictos o incumplimiento de normas. "
                "Responde SOLO con lo que conste en el detalle de reportes/disciplinarios. "
                "Conducta problemática en aula NO es agresividad. Diferencia explícitamente. "
                "Sin recomendaciones salvo que pidan qué hacer."
            )
        if any(
            k in q
            for k in (
                "empeor",
                "mejor",
                "estable",
                "escalamiento",
                "efecto positivo",
                "efecto negativo",
                "evolución",
                "evolucion",
                "qué cambió",
                "que cambió",
                "que cambio",
                "qué cambio",
                "cambió respecto",
                "cambio respecto",
                "últimos 30",
                "ultimos 30",
                "últimas semanas",
                "ultimas semanas",
            )
        ):
            return (
                "Pregunta de COMPARACIÓN TEMPORAL o efecto de intervención. "
                "Lee 'NOTA COMPARATIVA TEMPORAL' y la cronología. "
                "Si no hay registros antes Y después, NO afirmes mejora, empeoramiento, estabilidad "
                "ni ausencia de efecto. Usa: 'no consta evidencia posterior suficiente para...'. "
                "NO incluyas 'Qué hacer ahora' salvo que la pregunta lo pida."
            )
        if any(
            k in q
            for k in (
                "mixto",
                "académico o conductual",
                "academico o conductual",
                "conductual o emocional",
                "tipo de caso",
                "factores de riesgo",
                "por qué está en",
                "por que está en",
                "por qué riesgo",
                "por que riesgo",
            )
        ):
            return (
                "Clasifica el caso por dimensión con encabezados o viñetas: "
                "Académico | Asistencia | Conductual | Emocional/social | Alertas activas. "
                "Cita el dato concreto de cada dimensión. Sin recomendaciones si no las piden."
            )
        if any(k in q for k in ("entrevista", "preparar", "convocar", "preguntas para")):
            return (
                "El DECE quiere preparar una entrevista. Responde directo y añade una sección "
                "'### Preguntas sugeridas' con 4-6 preguntas basadas en los reportes y anotaciones "
                "documentados. Si la entrevista ya está agendada, dilo y enfoca las preguntas en eso."
            )
        # Operativo / futuro / decisión — tiene prioridad sobre "acciones ya realizadas".
        operational_markers = (
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
            "qué hacer",
            "que hacer",
            "cómo intervenir",
            "como intervenir",
            "siguiente paso",
            "próximo paso",
            "proximo paso",
            "próximos pasos",
            "proximos pasos",
            "qué medidas",
            "que medidas",
            "recomiend",
            "sugier",
            "cómo procedo",
            "como procedo",
            "decidir hoy",
            "información relevante para decidir",
            "esta semana",
            "próxima semana",
            "proxima semana",
            "priorizar",
            "priorizo",
            "prioriza",
            "priorice",
            "tomar esta",
            "acciones a tomar",
        )
        if any(k in q for k in operational_markers):
            base = (
                "Pregunta OPERATIVA: el DECE necesita decidir/actuar. Estructura la respuesta así:\n"
                "1) Frase directa con la decisión o acción principal.\n"
                "### Evidencia relevante — reportes DECE, anotaciones de tutor, notas, asistencia y riesgo, "
                "con fecha. AQUÍ van las observaciones y reportes (p. ej. 'observación conductual', "
                "'alerta emocional'), que son evidencia, NO acciones ejecutadas.\n"
                "### Acciones ya realizadas — ÚNICAMENTE intervenciones efectivamente ejecutadas por el DECE, "
                "es decir 'ACCIONES EJECUTADAS'/alertas atendidas con su fecha (p. ej. citación al "
                "representante, entrevista realizada). NO incluyas aquí reportes ni observaciones. "
                "Si no hay ninguna acción ejecutada, escribe 'No constan acciones ejecutadas registradas'. "
                "No repitas la misma acción.\n"
                "### Acciones recomendadas — pasos concretos y accionables del ámbito DECE "
                "(confirmar si la entrevista/citación agendada se realizó y su resultado; entrevista "
                "exploratoria con la estudiante; observación conductual en aula; seguimiento con el tutor; "
                "contacto con el representante; derivación si excede el ámbito escolar; registrar acuerdos, "
                "responsable y fecha). NADA de 'evaluación adicional' o 'monitorear' genéricos. "
                "No repitas una acción que ya esté en 'Acciones ya realizadas'.\n"
                "Cierra con el límite: 'No consta evidencia posterior suficiente para afirmar "
                "mejora/empeoramiento/efecto'. NO digas que un plan fue 'implementado' si no consta; "
                "di 'verifica si se ejecutó y registra evidencia'."
            )
            if any(k in q for k in ("priorizar", "priorizo", "prioriza", "priorice", "prioridad")):
                base = (
                    "Pregunta de PRIORIZACIÓN: PRIMERO responde 'Sí' o 'No' con criterio DECE "
                    "(p. ej. 'Sí, priorizar para seguimiento, no como emergencia inmediata porque…'). "
                    "Luego justifica con evidencia y qué verificar hoy. " + base
                )
            return base
        if any(k in q for k in ("accion", "acciones", "tomado", "tomada", "intervencion", "intervención", "efecto")):
            return (
                "Pregunta por acciones YA realizadas o su efecto. "
                "Enumera SOLO desde 'ACCIONES EJECUTADAS' (alertas atendidas), con fecha. Los reportes DECE "
                "son evidencia, no acciones ejecutadas; su 'plan=' es lo propuesto, no lo realizado. "
                "Para efecto: si no hay registro posterior, di 'no consta evidencia que permita "
                "confirmar efecto positivo o negativo'. No afirmes que 'no funcionó'."
            )
        if any(k in q for k in ("cambio", "emocional", "últimas", "ultimas", "recient", "tendencia")):
            return (
                "Pregunta sobre cambio o señales recientes. Usa cronología y NOTA COMPARATIVA. "
                "Compara fechas; si solo hay eventos de hace semanas, dilo. "
                "No afirmes estabilidad sin evidencia posterior."
            )
        if any(k in q for k in ("situación", "situacion", "resumen", "integral", "panorama")):
            return (
                "Panorama integral: 1 frase de síntesis, luego dimensión por dimensión "
                "(académico, asistencia, conductual, emocional) con fechas de los reportes. "
                "Recomendaciones solo si aportan en 1-2 líneas al final."
            )
        if any(k in q for k in ("riesgo", "urgente", "urgencia", "deserción", "desercion")):
            return (
                "Prioriza factores de riesgo por dimensión y urgencia. "
                "Separa académico / conductual / emocional / asistencia."
            )
        if any(k in q for k in ("anotacion", "anotación", "anotaciones")):
            return (
                "Pregunta sobre ANOTACIONES DE TUTOR. Enumera cada anotación con fecha, tipo y texto "
                "tal como consta en 'ANOTACIONES TUTOR (PostgreSQL)'. "
                "NO respondas con promedio, materias ni calificaciones."
            )
        if any(k in q for k in ("reporte", "reportes")):
            return (
                "Pregunta sobre REPORTES DECE. Enumera cada reporte con tipo, fecha, urgencia y "
                "descripción según el bloque 'REPORTES DECE'. "
                "No confundas reportes con acciones ya ejecutadas."
            )
        if any(k in q for k in ("asistencia", "ausencia", "falta", "tardanza")):
            return "Enfócate en asistencia con cifras de 30 días; no infieras causas sin registro."
        if any(k in q for k in ("materia", "nota", "calificacion", "calificación", "promedio")):
            return "Rendimiento académico por materia; 7/10 no es crisis si el promedio general es alto."
        if any(k in q for k in ("aislamiento", "retraimiento", "participación", "participacion")):
            return (
                "Enfócate en señales emocionales/sociales documentadas. "
                "Participación solo si consta en anotaciones o reportes."
            )
        if any(k in q for k in ("señal", "senal", "emocional", "preocupante")):
            return "Señales emocionales: cita reportes DECE y tutor sin diagnosticar."
        return "Responde de forma específica y breve a la pregunta. No agregues recomendaciones si no las piden."

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
