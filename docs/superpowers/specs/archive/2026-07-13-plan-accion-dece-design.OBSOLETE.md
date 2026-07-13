# Plan de acción DECE — Diseño

> **ARCHIVADO · OBSOLETO · NO IMPLEMENTAR.**  
> Ubicación de archivo: `docs/superpowers/specs/archive/`  
> Base vigente: [`../2026-07-13-plan-atencion-dece-diagnostico.md`](../2026-07-13-plan-atencion-dece-diagnostico.md)  
> Motivos: referencias normativas incorrectas (Arts. 330/331 como faltas), plan sin entidad Caso,  
> sin triage/protocolos separados, citas `"Art. N"`, sin versionado, y admin=acceso completo (rechazado).

**Fecha:** 2026-07-13  
**Estado:** superseded  
**Alcance:** plan de intervención por estudiante, anclado a LOEI, con seguimiento y alimentación al chat RAG.

---

## 1. Objetivo

Dar al DECE un **plan de acción profesional y trazable** por estudiante en situación de alerta / “requiere atención”:

1. Generarlo con IA a partir del expediente + artículos LOEI (base vectorial).
2. Revisarlo y ajustarlo antes de guardarlo.
3. Hacer seguimiento intuitivo (estados, notas, evidencia) — **no solo un formulario de edición**.
4. Que tutor/docente/inspector **solo visualicen**.
5. Que el chat RAG **conozca el plan activo** y no invente acciones contradictorias.

Principio: **la IA propone; el DECE decide y ejecuta el seguimiento.**

---

## 2. Roles y permisos

| Acción | Admin | DECE | Tutor | Docente | Inspector | Representante |
|--------|:-----:|:----:|:-----:|:-------:|:---------:|:-------------:|
| Ver plan (si tiene acceso al estudiante) | ✓ | ✓ | ✓ | ✓* | ✓ | ✗ (salvo decisión futura) |
| Generar plan con IA | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Editar estructura / guardar / cerrar | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cambiar estado de acciones + anotar avances | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Chat RAG alimentado por plan | ✓ | ✓ | — | — | — | — |

\*Docente: puede ver el plan desde el contexto académico del estudiante (perfil o vista asociada a su curso/materia), en **solo lectura**.

Gates frontend: `canManageActionPlan()` = admin|dece; `canViewActionPlan()` = admin|dece|tutor|docente|inspector.

---

## 3. Ubicación en la UI

Tercera pestaña en **Perfil 360** (`StudentProfileDialog`):

- Resumen  
- Intervenciones (histórico de lo ya ejecutado: alertas atendidas + acciones en reportes DECE)  
- **Plan de acción** ← nuevo

Separación deliberada:

- **Intervenciones** = evidencia de lo *ya hecho*.  
- **Plan de acción** = lo *acordado / en curso* + historial de planes cerrados.

Entrada rápida (DECE): desde dashboard / alerta → Perfil 360 con `tab=action-plan`.

---

## 4. Formato profesional del plan (voz DECE)

No es una tabla cruda. El documento generado tiene estructura narrativa de caso:

### Cabecera
- Estudiante, curso, fecha de elaboración, elaborador (DECE).
- Nivel de riesgo al momento de generar.
- Síntesis en 2–4 líneas: *por qué se abre este plan ahora*.

### Lectura del caso por dimensión
Para cada dimensión aplicable (académica / asistencia-deserción / conductual / emocional si hay evidencia):

- **Hallazgos** con dato y fecha (del expediente).
- **Marco normativo** (Art. LOEI citando número y idea central, no copy-paste largo).
- **Implicación profesional**: qué obliga / orienta la norma en *este* caso.

### Acciones priorizadas (núcleo operable)
Cada acción es una tarjeta con:

| Campo | Descripción |
|-------|-------------|
| `title` | Acción concreta (vocabulario DECE) |
| `dimension` | academico \| asistencia \| conductual \| emocional \| familiar \| institucional |
| `loei_refs` | p.ej. `["Art. 32"]` |
| `rationale` | 1–2 frases atadas a un hallazgo del expediente |
| `responsible_role` | dece \| tutor \| docente \| representante \| junta_distrital |
| `due_hint` | p.ej. “48 horas”, “2 semanas”, “esta semana” |
| `priority` | 1 (más urgente) … n |
| `status` | pendiente \| en_curso \| hecha \| no_aplica |
| `progress_notes` | lista de anotaciones de seguimiento |

Máximo **5–7 acciones**. Priorizadas. Sin genéricos (“monitorear”, “apoyar emocionalmente”) sin ancla.

### Cierre del documento generado
- **Límites**: qué *no* afirma el plan (p.ej. no hay evidencia posterior para evolución; Art. 331 si falta muy grave → Junta Distrital, no solo “entrevista interna”).
- **Criterio de revisión**: cuándo reevaluar el plan.

### Tono
Español profesional, directo, empático; sin diagnósticos clínicos; distingue hecho registrado vs propuesta.

---

## 5. Interfaz de seguimiento (intuitiva)

Vista del plan **activo** (DECE):

1. **Banner del plan** — estado, fecha, riesgo al crear, progreso (`3/6 hechas`).
2. **Cola de acciones** — lista ordenada por prioridad; cada ítem es una **tarjeta expandible**:
   - Título + badge dimensión + badge LOEI + badge estado.
   - Segmented control / chips de estado: Pendiente · En curso · Hecha · No aplica (un clic, sin abrir diálogo de “Editar plan”).
   - Campo corto “Anotar avance” + botón guardar nota (fecha + autor automáticos).
   - Historial de notas de esa acción.
3. **Acciones del plan** (barra): Regenerar (con confirmación), Cerrar plan, Ver historial.
4. **Vista solo lectura** (tutor/docente/inspector): mismas tarjetas, sin chips ni input de notas; etiqueta “Solo visualización — seguimiento a cargo del DECE”.

Planes cerrados: acordeón / lista en la misma pestaña, debajo, solo lectura.

Generación:

1. DECE pulsa “Generar plan”.
2. Se muestra **borrador editable** (markdown estructurado + lista de acciones ajustables) antes de confirmar.
3. Al confirmar → plan `activo`. Si ya había uno activo, se pide confirmación (cerrar el anterior o cancelar).

---

## 6. Modelo de datos (nuevo)

### `planes_accion` (ActionPlan)
- id, institution_id, student_id  
- created_by (user_id DECE)  
- status: `borrador` | `activo` | `cerrado`  
- risk_level_at_creation  
- summary (texto síntesis)  
- narrative_md (cuerpo profesional generado/editado)  
- loei_articles_used (json/text)  
- closed_at, closure_notes (nullable)  
- created_at, updated_at  

### `planes_accion_items` (ActionPlanItem)
- id, plan_id  
- title, dimension, loei_refs (json), rationale  
- responsible_role, due_hint, priority  
- status: pendiente | en_curso | hecha | no_aplica  
- sort_order  
- updated_at  

### `planes_accion_notas` (ActionPlanNote)
- id, item_id  
- author_id, body, created_at  

Un solo plan `activo` por estudiante (constraint de aplicación).

Migración: patrón actual del repo (`manage.py` / `create_all`), sin Alembic.

---

## 7. LOEI en base vectorial

Indexar como documentos **normativos** (no atados a un estudiante):

| id | source | contenido |
|----|--------|-----------|
| `loei:art_32` | `normativa_loei` | Refuerzo pedagógico |
| `loei:art_172` | `normativa_loei` | Inasistencia / reprobación |
| `loei:art_330` | `normativa_loei` | Clasificación de faltas |
| `loei:art_331` | `normativa_loei` | Acciones disciplinarias / Junta Distrital |

Metadata: `{ "source": "normativa_loei", "article": "32", "scope": "institucional", "block": "academico|asistencia|conductual" }`  
`student_id` omitido o valor especial documentado.

Script idempotente: `python scripts/seed_loei_normativa.py`

### Cambio en búsqueda RAG
Además de `where student_id = X`, consultar (o hacer segunda query) documentos `source == normativa_loei` y fusionar resultados cuando la pregunta o la generación de plan requiera marco legal / “qué hacer”.

### Generación del plan
Endpoint dedicado (recomendado): `POST /action-plans/generate`  
Usa: contexto estructurado del estudiante + chunks LOEI + (si existe) plan previo cerrado.  
Devuelve narrative + items estructurados. No persiste hasta “Guardar”.

---

## 8. Integración con el chat RAG

Cuando exista plan **activo** del estudiante, `_structured_context` incluye bloque:

```
--- PLAN DE ACCIÓN ACTIVO (PostgreSQL) ---
Elaborado: YYYY-MM-DD por {DECE}
Progreso: 3/6 acciones hechas
Síntesis: ...
Acciones:
  - [hecha] ... (Art. 32) — última nota: ...
  - [en_curso] ...
  - [pendiente] ...
NO propongas acciones que contradigan este plan ni repitas como "nuevo" lo ya pendiente/hecho.
Si preguntan "qué plan hay", lista estas acciones con estado.
```

Opcional: indexar el narrative del plan en Chroma como `plan_accion:{id}` con `student_id`.

Reglas de system prompt (añadir):

- Si hay plan activo, alinear recomendaciones con él.
- Distinguir plan propuesto vs acciones ya ejecutadas (alertas atendidas).

---

## 9. API (borrador)

| Método | Ruta | Quién |
|--------|------|-------|
| GET | `/action-plans?student_id=` | ver: roles con vista |
| GET | `/action-plans/{id}` | ver |
| POST | `/action-plans/generate` | DECE/admin |
| POST | `/action-plans` | DECE/admin (guardar) |
| PATCH | `/action-plans/{id}` | DECE/admin (cierre, narrative) |
| PATCH | `/action-plans/{id}/items/{item_id}` | DECE/admin (status) |
| POST | `/action-plans/{id}/items/{item_id}/notes` | DECE/admin |

Auditoría: `plan_accion_generado`, `plan_accion_guardado`, `plan_accion_item_actualizado`, `plan_accion_cerrado`.

---

## 10. Fuera de alcance (v1)

- Notificaciones push al tutor al cambiar estados (puede ser v1.1).  
- Firma digital del representante.  
- Auto-cierre del plan cuando baja el semáforo.  
- Edición masiva de plantillas institucionales.  
- Representante crea/edita planes.

---

## 11. Criterios de éxito

1. DECE genera un plan que lee como informe profesional, con citas LOEI correctas por dimensión.  
2. Cambiar estado de una acción es ≤ 2 clics, sin abrir “Editar plan completo”.  
3. Tutor/docente ven el plan y no pueden modificarlo.  
4. Chat, con plan activo, responde “qué falta hacer” listando ítems pendientes reales.  
5. Artículos LOEI recuperables desde Chroma en generación y en consultas operativas.

---

## 12. Orden de implementación sugerido

1. Seed LOEI + ajuste búsqueda Chroma (normativa institucional).  
2. Modelos + endpoints CRUD/seguimiento.  
3. Generación IA (`/generate`) con prompt DECE.  
4. UI pestaña Plan de acción (borrador → activo → seguimiento).  
5. Inyectar plan activo en contexto RAG + prueba en chat.
