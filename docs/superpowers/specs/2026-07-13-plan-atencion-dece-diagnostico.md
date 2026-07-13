# Diagnóstico técnico-funcional — Plan de atención y seguimiento DECE

**Fecha:** 2026-07-13  
**Estado:** aprobado con decisiones de producto (2026-07-13)  
**Archivado (obsoleto):** [`archive/2026-07-13-plan-accion-dece-design.OBSOLETE.md`](./archive/2026-07-13-plan-accion-dece-design.OBSOLETE.md)  
**Planes / informes:**  
- Fase 0–6 informess en [`../plans/`](../plans/) (`2026-07-13-fase-*-informe.md`)  
- Estado implementación: **Fases 0–6 completadas** (2026-07-13), suite pytest PostgreSQL en verde.

---

## 0. Decisiones de producto aprobadas (2026-07-13)

Estas decisiones **cierran** las preguntas abiertas del diagnóstico y son vinculantes para todas las fases.

### 0.1 Datos reales y proveedor externo

- SIDTRAC se diseñará para **datos reales de NNA**.
- **Minimización obligatoria** antes de OpenRouter: sin nombres, cédulas, teléfonos, correos, direcciones ni nombres de terceros; usar `student_ref` seudónimo; allowlist de campos; map `student_ref ↔ student_id` solo en backend.
- No persistir prompt/respuesta completos sin redacción.
- Config para **desactivar proveedor externo**; auditar **categorías** enviadas, no contenido sensible.
- Prohibido continuar enviando expedientes completos a OpenRouter.

### 0.2 Orden de fases

```text
Fase 0  Seguridad, multi-tenancy, privacidad, pytest
Fase 1  Normativa canónica + Chroma institucional
Fase 2  DeceCase, triage (reglas+IA+confirmación), ProtocolActivation, ExternalReferral
Fase 3  Planes versionados, acciones, notas, ActionPlanEvidence
Fase 4  Generación IA JSON estricto + minimización
Fase 5  UI profesional + vistas por actor + SharedCommitmentSummary
Fase 6  Chat RAG con plan activo
```

**No construir Casos/Planes sobre gaps de multi-tenancy.** Fase 0 es obligatoria primero.

### 0.3 Roles / permisos

- `administrador` **no** implica acceso profesional completo al expediente.
- Preferencia: permisos granulares (`case.view_professional`, `case.view_institutional_summary`, `case.view_assigned_actions`, `case.view_sensitive_sections`, `case.emergency_access`) independientes del nombre de rol, si roles nuevos (`system_admin`, etc.) aún no son viables.
- Acceso excepcional `break_glass` con motivo + auditoría.

### 0.4 Niveles / sostenimiento

Configurable por institución: Inicial, EGB, Bachillerato; fiscal, municipal, fiscomisional, particular. No hardcodear un solo nivel.

### 0.5 Alertas → casos

```text
alerta → revisión profesional → triage → descartada | atendida_sin_caso | convertida_en_caso
```

Caso puede abrirse en `pending_triage`. Tabla puente `DeceCaseAlert`. Una alerta puede vincularse después a un caso existente.

### 0.6 Triage

Reglas deterministas + apoyo IA + confirmación profesional obligatoria por flag.  
`routine_plan_allowed: false` ≠ prohibir plan; significa que el plan **no puede ser la única actuación** y debe revisarse/activarse ruta.

### 0.7 Protocolos vs planes

`ProtocolActivation` es entidad **independiente**. No usar `psychosocial_protocol` como `plan_type`.

### 0.8 Activación de rutas

Cualquiera (tutor/docente/inspector/autoridad/DECE) puede **reportar**. Activación formal: DECE o autoridad autorizada. Estados: `reported` → `under_review` → `confirmed` → `activated` | `closed` | `discarded`. No impedir medidas inmediatas de protección si DECE no está disponible.

### 0.9 Aprobación plan v1

`approval_mode = dece_only` (+ `approved_by/at/comment`). Preparar `dece_and_authority` (autoridad ve solo resumen funcional).

### 0.10 Seguimiento colaborativo

Ejecutor → `reported_completed`; solo DECE → `validated`. Progreso oficial = `% validated`. Transiciones auditadas. Vencimiento por `due_at` (cálculo, no auto-cambio de estado).

### 0.11 Evidencias v1

`ActionPlanEvidence` con storage abstraído (local/MinIO/S3), URL firmada, namespace por institución, MIME/tamaño, checksum, antimalware, confidencialidad, auditoría acceso. Sin BLOB en Postgres. Formatos: PDF, JPG, PNG, DOCX.

### 0.12 Representante / estudiante

Sin acceso al expediente en v1. `SharedCommitmentSummary` desde campos autorizados. Portal v2.

### 0.13 Derivaciones

`ExternalReferral` registro manual en v1; sin integración automática Distrito/UDAI/Fiscalía.

### 0.14 Conservación

Campos técnicos `retention_class`, `retain_until`, `legal_hold`, `archived_at`, `anonymized_at`, `deleted_at`, `deletion_reason`. Política concreta por institución antes de producción.

### 0.15 Normativa Fase 1

Descarga desde fuentes oficiales + checksum + vigencia. RGLOEI DE-675 arts. 32, 171–172, 330–333, 364–369; protocolos riesgos psicosociales y violencia. Faltas LOEI solo tras verificación del texto vigente.

### 0.16 Alembic

Activación controlada: inventariar → baseline → stamp verificado → migraciones pequeñas. No autogenerate ciego en producción.

---

## 1. Diagnóstico del diseño previo

El documento `2026-07-13-plan-accion-dece-design.md`:

| Aspecto | Veredicto |
|---------|-----------|
| Plan anclado a estudiante (1 activo/estudiante) | **Insuficiente** — no existe jerarquía Caso → Plan |
| Tabla simple de acciones + `due_hint` libre | **Insuficiente** vs acciones medibles y validación DECE |
| “Art. 330/331 = faltas / Junta Distrital” | **Incorrecto** respecto a RGLOEI Decreto 675 (ver §4) |
| Citas como `"Art. 32"` | **Insuficiente** — debe ser objeto normativo versionado |
| Sin triage / protocolos urgentes | **Riesgo alto** — puede banalizar alertas críticas |
| Sin confidencialidad por sección | **Riesgo alto** — tutor/docente verían expediente completo |
| Sin versionado de planes | **Incumpliría** principio de no reemplazo silencioso |
| IA → markdown libre | **Insuficiente** — se requiere JSON estricto |

Este diagnóstico propone el dominio Caso + Plan tipificado + normativa canónica en PostgreSQL + Chroma semántico + vistas por rol.

---

## 2. Hallazgos del repositorio (respuestas a §3)

### 2.1 Modelos actuales

| Entidad | Tabla | Notas |
|---------|-------|-------|
| Student | `estudiantes` | `institution_id`, `course_id`, `guardian_id`, `status`, `current_risk_level` |
| Alert | `alertas` | tipo, nivel, estado, `actions_taken` al atender |
| AlertConfig | `configuracion_alertas` | umbrales por institución |
| DeceReport | `reportes_dece` | tipos incl. `plan_intervencion`, `seguimiento`; **sin** `institution_id` |
| TutorAnnotation | `anotaciones_tutor` | |
| DisciplinaryReport | `reportes_disciplinarios` | creado por **tutor** (columna `inspector_id`) |
| User + roles | `usuarios`, `usuario_roles` | multi-rol |
| Risk | *campo denormalizado* | no hay tabla Risk |

**No existe** entidad Case / Expediente / Plan estructurado.

### 2.2 ¿Caso / expediente?

No. “Expediente” = composición: estudiante + alertas + reportes + timeline + contexto RAG.

`DeceReportType.SEGUIMIENTO` / `PLAN_INTERVENCION` = **subtipos de reporte**, no ciclo de vida de caso.

### 2.3 Cálculo de riesgo

`alerts/application/engine.py`:

- Indicadores (ventana ~30 días): académico (promedio), asistencia (ausencias), disciplinario (faltas graves), emocional/conductual (DECE), conductual (tutor).
- Matriz: 0→bajo; ≥3 o (≥2 y ≥1 extremo)→crítico; ≥2 o ≥1 extremo→alto; else→medio.
- Mitigación: alerta atendida reciente con `actions_taken` puede bajar un nivel el semáforo.
- `AlertType.DESERCION` existe en enum pero **el motor no lo emite**.

### 2.4 Roles y permisos

Roles: `administrador`, `dece`, `tutor`, `docente`, `inspector`, `representante`.

Enforcement: JWT + `active_role` + `require_roles` + checks en servicios (institución, tutor→cursos, representante→hijos).

RAG: solo admin/DECE.  
Docente: académico; **no** Perfil 360 hoy.  
Inspector: alertas/behavioral parcial; gaps de acceso a get student.

### 2.5 Perfil 360

`StudentProfileDialog`: pestañas **Resumen** | **Intervenciones**.  
Carga timeline + perfil académico + alertas atendidas.  
Entradas: Students / DECE / Tutor / Inspector dashboards. **No docente.**

### 2.6 `_structured_context`

Bloques: fecha, académico/asistencia, alertas activas, acciones ejecutadas (alertas atendidas), reportes DECE (`plan=` = propuesto, no ejecutado), anotaciones tutor, resumen por dimensión, nota temporal, cronología.

**No** incluye plan activo estructurado.

### 2.7 Chroma

`indexer.py`: upsert a `sidtrac_documents` con metadata `{student_id, source, source_id}`.  
Fuentes: `reporte_dece`, `anotacion_tutor`, `reporte_disciplinario`.  
PG: `documentos_indexados` con `estudiante_id` **NOT NULL**.

### 2.8 Filtro Chroma

Solo `where={"student_id": ...}`. **Sin `institution_id`.** Isolation depende de que los IDs de estudiante no se cruzan en app logic (insuficiente para docs institucionales compartidos).

### 2.9 Proveedor IA

OpenRouter (`OPENROUTER_API_KEY`), modelo `RAG_MODEL` default `openai/gpt-4o-mini`.  
Se envía: system prompt + historial (6) + expediente completo con **nombre real**, notas sensibles, chips Chroma.  
Se persiste hasta 8000 chars en `consultas_rag`.

### 2.10 Auditorías

`logs_auditoria`: `user_id`, `action`, `detail`, `ip`, `created_at`.  
Mayoría writes + `consulta_rag` + export CSV.  
**No** audita lecturas ordinarias del expediente.  
**No** institution_id, **no** before/after estructurado.

### 2.11 Archivos / evidencias

**No** hay uploads ni storage de adjuntos. Solo texto en BD + Chroma local.

### 2.12 Multiinstitución

Sí: `institution_id` en institución, periodos, cursos, usuarios, estudiantes, alertas.  
Reportes conductuales heredan vía estudiante.  
Gaps: query params de institución no siempre assert-igualdad; audit global; RAG get student sin check institución explícito.

### 2.13 Migraciones

`manage.py initdb` → `create_all`.  
`migrateusers` ad-hoc.  
Alembic en `requirements.txt` pero **sin** carpeta/config.  
Sin versionado real de schema.

### 2.14 Pruebas

Sin suite pytest. Solo scripts smoke HTTP/`scripts/test_*.py`.

### 2.15 Reutilizable sin duplicar

| Reutilizar | Cómo |
|------------|------|
| Alert + `attend` / `actions_taken` | Intervenciones ejecutadas; vincular a Case |
| DeceReport (todos los tipos) | Evidencia / valoración; **no** sustituye ActionPlan |
| Timeline + StudentInterventionsPanel | Tab histórico |
| Perfil 360 shell | Nueva pestaña |
| RagService structured + OpenRouter client | Extender bloques; generate JSON |
| Intent/scope CONTROL header | Mantener |
| AlertConfig umbrales | Inputs de triage suave |
| Enum RiskLevel / UserRole | Extender enums nuevos |

---

## 3. Corrección normativa (Decreto Ejecutivo 675 — RGLOEI)

Según instrucción del producto (validar siempre contra fuente oficial al seedear):

| Artículo | Título / uso SIDTRAC |
|----------|----------------------|
| **32** | Refuerzo pedagógico → plan/dimensión académica |
| **171** | Inasistencia |
| **172** | Prohibición de ausencia una vez iniciadas las clases |
| **330** | Sensibilización y formación continua (**NO** tipificación de faltas) |
| **331** | Actores responsables de la protección de derechos |
| **332–333** | Atención, seguimiento y derivaciones |
| **364–369** | Procedimiento disciplinario estudiantes |
| Faltas/sanciones | Validar también contra **LOEI** vigente (ley), no solo reglamento antiguo |

El diseño anterior que asociaba 330/331 a faltas y Junta Distrital **no debe implementarse**.

Citas canónicas: objeto JSON completo (`document_code`, `version`, `article`, `article_title`, `effective_from`, `source_chunk_id`), resuelto desde PostgreSQL tras retrieval Chroma.

---

## 4. Riesgos normativos

1. Alucinar artículos o tipificar faltas/delitos vía IA.  
2. Usar numeración del reglamento derogado.  
3. Presentar recomendación DECE como sanción disciplinaria.  
4. Tratar protocolo de violencia / autolesión como “plan rutinario”.  
5. Citar LOEI cuando el texto es del Reglamento (o viceversa).

---

## 5. Riesgos de privacidad / seguridad

1. PII + notas conductuales salen a OpenRouter sin minimización.  
2. Chroma sin `institution_id`.  
3. RAG/query sin assert institución en get student.  
4. Docente con acceso a Perfil 360 completo = sobreexposición.  
5. Audit insuficiente en lecturas sensibles.  
6. `IndexedDocumentModel` no admite docs sin estudiante.  
7. Multi-tenant: posible IDOR si se conoce `student_id`.

---

## 6. Modelo de dominio propuesto

```
Institution
 └── Student
      ├── Alert(s)  (pueden vincularse a Case)
      └── DeceCase (1..n)
           ├── CaseAssessment / TriageRecord
           ├── ActionPlan (versionado; 1 activo por plan_type)
           │    ├── ActionPlanItem
           │    ├── ActionPlanNote (visibility_scope)
           │    └── ActionPlanEvidence (fase futura archivos)
           ├── Referral
           ├── ProtocolActivation
           ├── CaseDocument (fase futura)
           └── CaseClosure
NormativeDocument → NormativeVersion → NormativeArticle
NormativeReference (desde plan/item → article)
```

Principios:

- Plan cuelga de **Case**, no solo de Student.  
- `Un plan activo por (case_id, plan_type)`.  
- Versiones: cambios estructurales → nueva versión / `superseded`; no PATCH destructivo silencico.  
- Estados de acción: `pending` … `reported_completed` → `validated` (solo DECE).  
- `due_at` real antes de `active`; `due_hint` solo en borrador IA.

---

## 7. Matriz de permisos (propuesta)

| Capacidad | Admin | DECE | Tutor | Docente | Inspector | Representante |
|-----------|:-----:|:----:|:-----:|:-------:|:---------:|:-------------:|
| Ver resumen institucional del caso | ✓ | ✓ | limitado* | limitado* | limitado* | ✗ v1 |
| `full_professional_view` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| `assigned_actions_view` | ✓ | ✓ | ✓ (asignadas) | ✓ (asignadas) | ✓ (asignadas) | ✗ |
| Crear caso / triage / aprobar plan | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Reportar avance en acción asignada | ✓ | ✓ | **pendiente decisión** | **pendiente** | **pendiente** | ✗ |
| Validar avance / cerrar plan | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Ver notas `confidentiality=dece_only` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Generar borrador IA | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

\*limitado = acciones asignadas + objective/title públicos; sin family_context, student_perspective, notas DECE, triage sensible.

---

## 8. Flujo (alto nivel)

```text
Alerta / derivación / observación
        │
        ▼
   Triage DECE ──¿protocolo urgente?──► ProtocolActivation + warning UI
        │ no rutinario solo
        ▼
   DeceCase (pending_triage → open / under_assessment)
        │
        ▼
   POST /generate (JSON) ── humano revisa ──► draft → pending_approval → active
        │
        ▼
   Acciones: pending → in_progress → reported_completed → validated
        │
        ▼
   Cierre con outcome_evaluation (no auto-cierre)
```

---

## 9. Cambios de base de datos (faseados)

**Fase 1 — Normativa**

- `normative_documents`, `normative_versions`, `normative_articles`  
- Chroma metadata alineada; script seed idempotente RGLOEI-DE-675 (arts. 32, 171, 172, 330–333, 364–369 + refs LOEI faltas si se aportan textos oficiales)

**Fase 2 — Caso**

- `dece_cases` (+ assessments / triage / protocol_activations / referrals mínimo)

**Fase 3 — Plan**

- `action_plans`, `action_plan_items`, `action_plan_notes`, `normative_references`  
- Evidencias: stub o tabla sin blob hasta definir storage

**Migración:** introducir **Alembic real** (ya está en requirements) o comandos `manage.py` versionados. Recomendación: activar Alembic desde Fase 1.

---

## 10. Contratos API (borrador)

```
POST   /cases                         # crear desde alerta(s) / manual
GET    /cases?student_id=
GET    /cases/{id}                    # vista según rol / visibility
POST   /cases/{id}/triage
POST   /cases/{id}/protocols

POST   /action-plans/generate         # JSON estricto; no persiste
POST   /action-plans                  # guardar draft
POST   /action-plans/{id}/submit
POST   /action-plans/{id}/approve
POST   /action-plans/{id}/versions    # reformulación
PATCH  /action-plans/{id}/items/{item_id}/status
POST   /action-plans/{id}/items/{item_id}/progress
POST   /action-plans/{id}/items/{item_id}/validate
POST   /action-plans/{id}/close

GET    /normative/articles?code=&article=
```

Todos con assert `institution_id` y auditoría enriquecida.

---

## 11. Esquema JSON de generación (esencial)

```json
{
  "triage": {
    "routine_plan_allowed": true,
    "protocol_review_required": false,
    "protocol_type": null,
    "urgency": "normal",
    "flags": [],
    "reasons": [],
    "professional_confirmation_required": []
  },
  "assessment": {
    "situation_summary": "",
    "facts": [{"fact_id": "", "text": "", "source": "", "date": null}],
    "inferences": [{"text": "", "based_on_fact_ids": []}],
    "protective_factors": [],
    "risk_factors": [],
    "missing_information": []
  },
  "plan": {
    "plan_type": "psychosocial_attention_followup",
    "general_objective": "",
    "limitations": [],
    "review_criteria": "",
    "review_at_hint": null
  },
  "actions": [
    {
      "title": "",
      "objective": "",
      "action_type": "",
      "dece_axis": "psychosocial_attention",
      "case_dimension": "academic",
      "rationale": "",
      "source_fact_ids": [],
      "responsible_role": "dece",
      "supporting_roles": [],
      "due_hint": "",
      "expected_result": "",
      "success_indicator": "",
      "evidence_required": true,
      "priority": 1,
      "confidentiality_level": "professional"
    }
  ],
  "normative_references": [
    {
      "document_code": "RLOEI-DE-675",
      "document_name": "Reglamento General a la Ley Orgánica de Educación Intercultural",
      "version": "Decreto Ejecutivo 675",
      "article": "32",
      "article_title": "Refuerzo pedagógico",
      "effective_from": "2023-02-22",
      "source_chunk_id": "norm:RLOEI-DE-675:32"
    }
  ]
}
```

Validación: Pydantic. Referencias: solo IDs presentes en el prompt (post-resolve PostgreSQL).

---

## 12. Estrategia de migración

1. Activar Alembic; baseline del schema actual.  
2. Migraciones incrementales por fase.  
3. Seed normativa offline (textos aportados / fuente oficial).  
4. No migrar automáticamente `plan_intervencion` reports → ActionPlan; opcional “vincular evidencia”.  
5. Feature flag `ACTION_PLANS_ENABLED` hasta Fase 5 UI.

---

## 13. Estrategia de pruebas

- Unit: triage flags, JSON schema, resolve normativo, permisos por vista.  
- Integration: generate no persiste; approve versiona; reported≠validated.  
- RAG: fixture con plan activo → chat no inventa hechos; no cita art. inventado.  
- Security: docente no ve notas DECE; cross-institution 403.  
- Protocol: flag urgencia → `routine_plan_allowed=false`.

(Smoke scripts actuales no bastan.)

---

## 14. Plan por fases (actualizado)

```text
Fase 0  Seguridad, multi-tenancy, privacidad y pruebas básicas   ← COMPLETADA
Fase 1  Normativa canónica y Chroma institucional                ← COMPLETADA
Fase 2  DeceCase, triage, ProtocolActivation, ExternalReferral ← COMPLETADA
Fase 3  Planes versionados, acciones, notas, evidencias          ← COMPLETADA
Fase 4  Generación IA JSON estricto + minimización               ← COMPLETADA
Fase 5  UI profesional y vistas por actor                        ← COMPLETADA
Fase 6  Integración plan activo ↔ chat RAG                       ← COMPLETADA
```

Detalle de ejecución Fase 0: ver plan citado en el encabezado.

---

## 15. Preguntas pendientes (estado post-aprobación)

| Tema | Estado |
|------|--------|
| Datos reales + minimización OpenRouter | **Decidido** (§0.1) |
| Niveles / sostenimiento configurables | **Decidido** (§0.4) — piloto confirma valores concretos sin bloquear dominio |
| Quién ve secciones sensibles | **Decidido** — permisos granulares + DECE profesional; admin técnico no por defecto (§0.3) |
| Reportar avances / validar DECE | **Decidido** (§0.10) |
| Aprobación plan | **Decidido** dece_only v1 (§0.9) |
| Alerta → caso | **Decidido** triage primero (§0.5) |
| Quién activa rutas | **Decidido** (§0.8) |
| Integración externa | **Decidido** solo registro v1 (§0.13) |
| Evidencias adjuntos | **Decidido** v1 con storage abstraído (§0.11) |
| Representante/estudiante | **Decidido** SharedCommitmentSummary v1; portal v2 (§0.12) |
| Conservación | **Decidido** soporte técnico; política institucional pre-prod (§0.14) |
| Textos oficiales normativa | **Decidido** descarga desde fuentes oficiales en Fase 1 (§0.15) |

Pendiente operativo (no bloquea Fase 0):

- Confirmación de niveles/sostenimiento de la institución piloto (configuración).  
- Canales oficiales exactos de PDF/HTML del Ministerio para seed Fase 1.  
- Política de retención concreta antes de go-live.

---

## 16. Criterio de avance

| Siguiente paso | Condición |
|----------------|-----------|
| Ejecutar Fase 0 | **Hecho** (2026-07-13) — ver informe Fase 0 |
| Fase 1 normativa | Fase 0 validada + go-ahead (aprobado implementación completa) |
| Fases 2–6 | Secuenciales tras la anterior; informe al cerrar cada una |

---

*Diagnóstico aprobado. Código de aplicación no modificado en esta etapa documental.*
