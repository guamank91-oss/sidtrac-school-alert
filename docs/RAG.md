# SIDTRAC — Arquitectura RAG (Consulta Inteligente)

Documento técnico del módulo **M6** del ERS: chat conversacional para el DECE con **Retrieval-Augmented Generation**.

**Estado:** ✅ **Implementado y conectado** (backend + frontend + indexación automática).

---

## 1. ¿Qué es y para qué sirve?

El RAG permite que un profesional del DECE (o administrador) haga **preguntas en lenguaje natural** sobre un estudiante y reciba un análisis basado en **datos reales** del sistema:

- Calificaciones y promedios (PostgreSQL)
- Asistencia reciente (PostgreSQL)
- Alertas activas (PostgreSQL)
- Reportes DECE, anotaciones de tutor y reportes disciplinarios (ChromaDB, búsqueda semántica)

La respuesta la genera un **LLM vía OpenRouter** (`meta-llama/llama-3.1-8b-instruct`), enriquecido con ese contexto. Si no hay API key o falla la red, el sistema responde en **modo fallback** (resumen local sin IA).

---

## 2. ¿Está aplicado en el proyecto?

| Capa | Estado | Ubicación |
|------|--------|-----------|
| API REST | ✅ | `POST /api/v1/rag/query`, `GET /rag/history`, `GET /rag/metrics` |
| Orquestador RAG | ✅ | `school-alert-backend/app/modules/rag/application/service.py` |
| Indexación Chroma | ✅ | `school-alert-backend/app/modules/rag/application/indexer.py` |
| Cliente OpenRouter (LLM) | ✅ | `school-alert-backend/app/modules/rag/application/openrouter.py` |
| Disparador al crear conductual | ✅ | `behavioral/application/service.py` → `index_behavioral_document()` |
| UI chat completa | ✅ | `school-alert-frontend/src/modules/rag/pages/RagPage.tsx` |
| Historial y métricas | ✅ | Settings → pestaña RAG; `RagMetricsPanel.tsx` |
| Persistencia consultas | ✅ | Tabla `consultas_rag` + auditoría `consulta_rag` |

**Requisito para IA completa:** variable `OPENROUTER_API_KEY` en `school-alert-backend/.env`.

---

## 3. Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND  /rag                                   │
│  RagPage: selector estudiante → chat → POST /rag/query                  │
│  Envía: student_id, question, history (últimos 6 mensajes)              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RagService.query()  (orquestador)                     │
│                                                                          │
│  ┌──────────────────────────┐    ┌──────────────────────────────────┐  │
│  │ 1. CONTEXTO ESTRUCTURADO │    │ 2. RETRIEVAL (ChromaDB)          │  │
│  │    PostgreSQL (SQL)      │    │    Colección: sidtrac_documents   │  │
│  │    - Promedio general    │    │    query_texts = pregunta         │  │
│  │    - Promedio/materia    │    │    where: { student_id: N }     │  │
│  │    - Asistencia 30 días  │    │    top_k = 5 documentos           │  │
│  │    - Alertas activas     │    │    Fuentes: DECE, tutor, disc.  │  │
│  └────────────┬─────────────┘    └──────────────┬───────────────────┘  │
│               │                                  │                       │
│               └──────────────┬───────────────────┘                       │
│                              ▼                                           │
│               ┌──────────────────────────────┐                           │
│               │ 3. PROMPT ENRIQUECIDO         │                           │
│               │    SYSTEM_PROMPT (español)    │                           │
│               │    + contexto SQL + docs RAG  │                           │
│               │    + historial conversación   │                           │
│               │    + pregunta del DECE        │                           │
│               └──────────────┬───────────────┘                           │
│                              ▼                                           │
│               ┌──────────────────────────────┐                           │
│               │ 4. GENERACIÓN (OpenRouter)  │                           │
│               │    Llama 3.1 8B Instruct      │                           │
│               │    o fallback local           │                           │
│               └──────────────┬───────────────┘                           │
│                              ▼                                           │
│               ┌──────────────────────────────┐                           │
│               │ 5. POST-PROCESO             │                           │
│               │    Parse NIVEL_RIESGO: ...    │                           │
│               │    Guardar consultas_rag      │                           │
│               │    Auditoría consulta_rag     │                           │
│               └──────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Flujo paso a paso (una consulta)

### 4.1 Entrada (frontend)

1. Usuario DECE/admin entra a `/rag`.
2. Selecciona un estudiante de la lista (datos de `GET /students`).
3. Escribe una pregunta o usa una sugerida (RF-36).
4. El frontend envía:

```json
{
  "student_id": 12,
  "question": "¿Cuál es la situación actual de este estudiante?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Al cambiar de estudiante, el historial del chat se **limpia** (RF-41).

### 4.2 Contexto estructurado (PostgreSQL)

`RagService._structured_context()` consulta en tiempo real:

| Dato | Origen |
|------|--------|
| Nombre, curso, nivel de riesgo actual | `estudiantes`, `cursos` |
| Promedio general | `AVG(calificaciones.nota)` |
| Promedios por materia (ordenados de menor a mayor) | JOIN materias + calificaciones |
| Ausencias, tardanzas, justificados (30 días) | `asistencias` |
| Hasta 5 alertas activas | `alertas` |

Esto cubre la parte **académica/conductual numérica** sin depender de Chroma.

### 4.3 Retrieval semántico (ChromaDB)

`_search_chroma(student_id, question, top_k=5)`:

- Cliente persistente en `school-alert-backend/chroma_data/`
- Colección: `sidtrac_documents`
- Filtra por metadata `student_id` (solo documentos de ese estudiante)
- Devuelve los 5 fragmentos más similares a la pregunta

**Fuentes indexadas** (texto libre conductual/emocional):

| Origen | Cuándo se indexa | ID en Chroma |
|--------|------------------|--------------|
| `reporte_dece` | Al crear reporte DECE | `reporte_dece:{id}` |
| `anotacion_tutor` | Al crear anotación tutor | `anotacion_tutor:{id}` |
| `reporte_disciplinario` | Al crear reporte inspector | `reporte_disciplinario:{id}` |

Cada indexación también guarda una fila en `documentos_indexados` (trazabilidad en PostgreSQL).

### 4.4 Generación (OpenRouter)

Se arma un array de mensajes:

1. **System:** reglas en español, tono profesional, no inventar datos, estructura con "Recomendaciones de Intervención" y línea final `NIVEL_RIESGO: bajo|medio|alto|critico`.
2. **Historial:** últimos 6 turnos del chat (memoria conversacional).
3. **User:** bloque `CONTEXTO DEL ESTUDIANTE` + `DOCUMENTOS RELEVANTES` + pregunta.

Modelo por defecto: `meta-llama/llama-3.1-8b-instruct` (temperatura 0.3, max 1000 tokens).

### 4.5 Salida

La API responde:

```json
{
  "answer": "Análisis...\n\n**Recomendaciones de Intervención**\n- ...",
  "detected_risk_level": "medio",
  "sources": ["Reporte DECE (reporte_dece:3)", "Anotación de tutor (anotacion_tutor:7)"],
  "model": "meta-llama/llama-3.1-8b-instruct",
  "latency_ms": 2340,
  "used_llm": true
}
```

El badge "Modo sin IA" en la UI aparece cuando `used_llm: false`.

---

## 5. Indexación: cuándo y cómo entra data a Chroma

La indexación **no es manual**. Ocurre automáticamente al crear registros conductuales:

```
POST /behavioral/dece-reports     → indexa texto del reporte DECE
POST /behavioral/tutor-notes      → indexa [tipo] + descripción
POST /behavioral/disciplinary-reports → indexa falta + descripción + sanción
```

Función central: `index_behavioral_document()` en `indexer.py`:

1. Genera `document_id = "{source}:{source_id}"`
2. Hace `collection.upsert(ids, documents, metadatas)` en Chroma
3. Inserta fila en `documentos_indexados`

**Importante:** la indexación corre **en la misma petición HTTP** (síncrona). Si Chroma falla, el reporte igual se guarda en PostgreSQL pero `chroma_document_id` puede quedar null.

---

## 6. Almacenamiento

| Almacén | Qué guarda |
|---------|------------|
| **PostgreSQL** `consultas_rag` | Cada pregunta/respuesta, modelo, tokens, latencia, riesgo detectado, contexto usado (truncado) |
| **PostgreSQL** `documentos_indexados` | Copia del texto indexado + referencia al ID de Chroma |
| **ChromaDB** `chroma_data/` | Vectores + texto + metadata (`student_id`, `source`, `source_id`) |
| **log_auditoria** | Acción `consulta_rag` por cada consulta |

---

## 7. Seguridad y roles

| Endpoint | Roles permitidos |
|----------|------------------|
| `POST /rag/query` | `administrador`, `dece` |
| `GET /rag/history` | `administrador`, `dece` (admin ve todo; DECE solo sus consultas — RN-07) |
| `GET /rag/metrics` | Solo `administrador` |

Representante, tutor, docente e inspector **no tienen acceso** a `/rag` (bloqueado en rutas frontend y backend).

---

## 8. Detalle técnico: embeddings

| Componente | Implementación actual | ERS ideal |
|------------|----------------------|-----------|
| **LLM (generación)** | OpenRouter → Llama 3.1 8B | ✅ Alineado |
| **Embeddings (búsqueda)** | Embedding **por defecto de ChromaDB** al hacer `upsert(documents=[...])` y `query(query_texts=[...])` | ERS menciona OpenRouter `text-embedding-3-small` |

En la práctica el pipeline RAG **funciona**: indexa textos conductuales y los recupera por similitud semántica. La diferencia con el ERS estricto es que los vectores los calcula Chroma internamente, no OpenRouter.

---

## 9. Modo fallback (sin OpenRouter)

Si `OPENROUTER_API_KEY` está vacía o la API falla:

1. No se llama al LLM.
2. Se devuelve un resumen markdown con datos estructurados + extractos de documentos Chroma.
3. `model` = `"fallback-local"`, `used_llm` = `false`.
4. Se asigna `NIVEL_RIESGO: medio` por defecto en el fallback.

Útil para desarrollo; en producción/demo se recomienda tener la API key configurada.

---

## 10. Cómo probar que funciona

### Prerrequisitos

```powershell
# Backend corriendo con OPENROUTER_API_KEY en .env
cd school-alert-backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Checklist demo RAG

1. Login como DECE o admin (`sadmin` / `admin123`).
2. Ir a **Seguimiento** → crear un **reporte DECE** o **anotación tutor** sobre un estudiante (esto indexa en Chroma).
3. Ir a **Consulta IA** (`/rag`).
4. Seleccionar el mismo estudiante.
5. Preguntar: *"¿Qué reportes conductuales tiene este estudiante?"*
6. Verificar en la respuesta:
   - Texto en español con análisis y recomendaciones.
   - Badge de riesgo detectado.
   - Fuentes citadas (Reporte DECE, Anotación de tutor, etc.).
   - Latencia en segundos.
7. En **Settings → RAG**: ver historial de consultas y métricas (admin).

### Verificar Chroma en disco

Tras crear reportes, debe existir la carpeta:

```
school-alert-backend/chroma_data/
```

---

## 11. Archivos clave del código

| Archivo | Responsabilidad |
|---------|-----------------|
| `rag/application/service.py` | Orquestador: contexto SQL + Chroma + prompt + LLM + log |
| `rag/application/indexer.py` | Upsert en Chroma + registro en `documentos_indexados` |
| `rag/application/openrouter.py` | Cliente HTTP chat completions |
| `rag/api/router.py` | Endpoints FastAPI |
| `rag/infrastructure/models.py` | Modelos ORM `consultas_rag`, `documentos_indexados` |
| `rag/schemas.py` | DTOs request/response |
| `behavioral/application/service.py` | Llama al indexador al crear reportes |
| `frontend/.../rag/pages/RagPage.tsx` | UI del chat |
| `frontend/.../rag/api.ts` | Cliente Axios |

---

## 12. Diferencia con el proyecto de referencia

El proyecto en `DISEÑO DE INTEGRACIÓN CURRICULAR/proyecto/` usa:

- PostgreSQL + similitud coseno para retrieval
- Orquestador Django con clasificador de intención

SIDTRAC adapta el **mismo patrón conceptual**:

```
Contexto estructurado + Retrieval + Prompt + LLM → Respuesta enriquecida
```

pero cambia el vector store a **ChromaDB** y el contexto SQL incluye alertas y asistencia del dominio escolar.

---

## 13. Pendientes menores del módulo RAG

| Item | Descripción |
|------|-------------|
| Embeddings OpenRouter | Usar `text-embedding-3-small` en lugar del default de Chroma |
| Indexación async | Mover `index_behavioral_document` a tarea en background |
| Métricas por perfil | RF-52: desglose de consultas por rol DECE vs admin |
| Re-indexación masiva | No hay comando para re-indexar documentos históricos si Chroma se borra |

Ninguno de estos impide usar el chat en demo con datos reales.

---

## 14. Mitigación de mensajes fuera de tema

El chat **no debe usarse como asistente general**. Para evitar que un "hola" o un chiste disparen el pipeline RAG completo (Chroma + OpenRouter), SIDTRAC aplica **dos capas**:

### Capa 1 — Filtro rápido (`intent_guard.py`)

Antes de consultar Chroma o el LLM, el backend clasifica la pregunta:

| Intent | Ejemplo | Qué pasa |
|--------|---------|----------|
| `greeting` | "hola", "buenos días", "gracias" | Respuesta guía sin IA |
| `off_topic` | "cuéntame un chiste", "qué hora es" | Rechazo amable + redirección |
| `too_vague` | "ok", "ayuda" (muy corto, sin tema) | Pide reformular con ejemplos |
| `student_query` | "¿Cuál es su situación actual?" | Pipeline RAG normal |

Ventajas: **0 tokens**, respuesta instantánea, queda registrado en `consultas_rag` con `model=intent-guard`.

### Capa 2 — Prompt del LLM

Si el mensaje pasa el filtro pero sigue siendo ambiguo, el `SYSTEM_PROMPT` instruye al modelo a **no inventar análisis** y redirigir consultas ajenas al estudiante.

### Frontend

- Texto de ayuda bajo el título explicando el alcance.
- Placeholder con ejemplo de pregunta válida.
- Badge **"Fuera de alcance"** cuando el guard responde.

---

*Documento SIDTRAC — Módulo M6 RAG — UNEMI, Ingeniería de Software.*
