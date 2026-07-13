# Fase 0 — Seguridad, multi-tenancy, privacidad y pruebas

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.  
> **Estado:** aprobado para ejecución (2026-07-13) con ajustes listados en § Decisiones de ejecución.

**Goal:** Cerrar gaps de isolation multi-institución, privacidad hacia OpenRouter, auditoría tenant-aware (incl. lecturas sensibles), feature flags del módulo DECE y base pytest contra PostgreSQL — **antes** de construir Casos/Planes.

**Architecture:** Capas transversales (`tenant`, `privacy`, `permissions`, `feature_flags`) + endurecimiento de routers/servicios + Alembic baseline **completo** + Chroma colección `sidtrac_documents_v2` + redacción de `consultas_rag`. Sin dominio `DeceCase` en esta fase.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL, ChromaDB, OpenRouter (opcional), pytest + httpx + pytest-asyncio, Alembic.

**Specs:**  
- [`../specs/2026-07-13-plan-atencion-dece-diagnostico.md`](../specs/2026-07-13-plan-atencion-dece-diagnostico.md) §0  
- Decisiones de producto 2026-07-13 + ajustes de ejecución 2026-07-13

## Global Constraints

- Datos reales de NNA: minimización obligatoria hacia proveedor externo (allowlist).
- `administrador` **sin** `case.view_professional` por defecto; demo = allowlist de user IDs / capacidades explícitas.
- Feature flags off por defecto para módulo casos/planes.
- Tests e integración **solo PostgreSQL** (nunca SQLite).
- `AI_PROVIDER_ENABLED=false` → error controlado `AI_PROVIDER_DISABLED` (sin respuesta simulada).
- No `alembic upgrade` en producción sin stamp verificado.
- Sin `education_levels` / `funding_type` en Fase 0.
- Commits pequeños; no DeceCase / ActionPlan / normativa / Perfil 360.

---

## Decisiones de ejecución (aprobadas 2026-07-13)

1. **Baseline Alembic completo:** `20260713_0001_baseline.py` crea el esquema actual entero; `alembic upgrade head` sirve para BD nueva. BD existentes: verificar → `alembic stamp` (no recrear tablas).
2. **Admin sin vista profesional** por defecto; demo vía capacidades/allowlist de IDs.
3. **Auditoría de lecturas sensibles:** `student_profile_viewed`, `student_timeline_viewed`, `dece_report_viewed`, `sensitive_context_viewed`, `rag_query_executed`, `break_glass_used`.
4. **Chroma:** nueva colección `sidtrac_documents_v2` → reindex → validar → switch config → retirar v1. No mezclar docs con/sin `institution_id`.
5. **`student_ref`:** HMAC con secreto servidor **o** random por conversación; incluir contexto institucional; no ID real ni hash simple.
6. **Tests PostgreSQL** + casos extra: admin A↛B, tutor no asignados, representante ajenos, listados sin leak, `institution_id` query/body no sobrescribe sesión.
7. **Audit `scope_type`:** `global` | `institution`. `institution_id` nulo **solo** en globales; obligatorio en student/report/RAG/expediente.
8. **AI off:** `AI_PROVIDER_DISABLED`, sin llamada externa ni fake answer.
9. **Sin** `education_levels` / `funding_type` en Fase 0.

---

## Mapa de archivos (previstos)

### Crear

| Archivo | Responsabilidad |
|---------|-----------------|
| `alembic.ini`, `alembic/env.py` | Alembic |
| `alembic/versions/20260713_0001_baseline.py` | **Schema completo actual** |
| `alembic/versions/20260713_0002_fase0_security_privacy.py` | Columnas Fase 0 |
| `app/shared/tenant.py` | Isolation helpers |
| `app/shared/privacy/minimization.py` | Allowlist + HMAC `student_ref` + redact |
| `app/shared/permissions.py` | Capacidades `case.*` + allowlist demo |
| `app/shared/feature_flags.py` | Flags módulo |
| `app/shared/audit_actions.py` | Constantes de acciones sensibles |
| `scripts/migrate_chroma_to_v2.py` | Reindex → validate → cutover |
| `tests/conftest.py`, `pytest.ini`, `requirements-dev.txt` | Suite PG |
| `tests/test_tenant_isolation.py` | Cross-tenant + roles |
| `tests/test_rag_privacy.py` | Minimización + AI off |
| `tests/test_audit_institution.py` | scope_type + lecturas |
| `docs/superpowers/plans/alembic-ops.md` | Stamp / upgrade / downgrade |

### Modificar

| Archivo | Cambio |
|---------|--------|
| `app/core/config.py` | AI flags, `STUDENT_REF_HMAC_SECRET`, `CHROMA_COLLECTION`, feature flags, `PROFESSIONAL_ACCESS_USER_IDS` |
| Routers/services students, alerts, behavioral, academic, reports, rag, institution | Tenant assert; ignore client `institution_id` override |
| `rag/indexer.py`, `service.py`, `openrouter.py` | v2 collection, minimize, AI_PROVIDER_DISABLED |
| `rag/infrastructure/models.py` | institution_id, redacted fields, categories, student_ref |
| `audit/*` | institution_id, scope_type, entity_*, categories, reason; sensitive read actions |
| `manage.py` | Preferir Alembic; initdb documentado como legacy greenfield |

### Explicitamente fuera de Fase 0

- `DeceCase`, ActionPlan, normativa, Perfil 360 UI, `education_levels`/`funding_type`.

---

## Migraciones SQL

### `20260713_0001_baseline`

- `upgrade()`: `Base.metadata.create_all`-equivalente o `op.create_table` para **todas** las tablas del registry actual.
- `downgrade()`: drop en orden seguro (documentar riesgo).
- BD existentes: checklist + `alembic stamp 20260713_0001`.

### `20260713_0002_fase0_security_privacy`

**`logs_auditoria`**
- `institution_id` FK nullable (solo si `scope_type=global`)
- `scope_type` VARCHAR NOT NULL DEFAULT `institution` (o `global`)
- `entity_type`, `entity_id`, `categories`, `reason`

**`consultas_rag`**
- `institution_id` NOT NULL (backfill)
- Redactar writes; `context_categories`; `ai_provider_used`; `student_ref`
- Dejar de guardar contexto en claro

**`documentos_indexados`**
- `institution_id` NOT NULL (backfill)
- `student_id` nullable (prep. normativa Fase 1)
- Índice `(institution_id, student_id)`

Sin columnas education_levels / funding_type.

---

## Chroma cutover

1. Escribir siempre a `sidtrac_documents_v2` con `institution_id`.  
2. Reindex completo desde Postgres.  
3. Validar conteos + sample queries.  
4. `CHROMA_COLLECTION=sidtrac_documents_v2`.  
5. Retirar/archivar colección v1.  
Nunca mezclar docs sin `institution_id` en v2.

---

## Pruebas (PostgreSQL)

Fixtures: instituciones A/B; DECE_A/B, Tutor_A, Admin_A, Docente_A, Representante_A; estudiantes S_A (tutor/rep), S_B.

| ID | Caso | Esperado |
|----|------|----------|
| T1 | DECE_A → student B | 403/404 |
| T2 | DECE_A `?institution_id=B` | ignorado / 403; nunca datos B |
| T3–T6 | alerts, behavioral, academic, rag cross-tenant | 403/404/vacío sin leak |
| T7 | Admin_A sin capability → timeline/report sensible | 403 |
| T8 | Admin_A → student B | 403/404 |
| T9 | Tutor_A → estudiante no asignado (misma u otra institución) | 403 |
| T10 | Representante_A → estudiante ajeno | 403 |
| T11 | Listados no incluyen filas de otros tenants | |
| T12 | Body/query `institution_id` no sustituye sesión | |
| P1–P4 | Minimización, AI off → `AI_PROVIDER_DISABLED`, redact logs | |
| A1–A3 | Audit institution + scope_type + sensitive reads | |

---

## Tasks

### Task 0.1 — Scaffold pytest

- [x] `requirements-dev.txt` + `pytest.ini`  
- [x] `tests/conftest.py` (PostgreSQL `TEST_DATABASE_URL`)  
- [x] Smoke import/health  
- [x] Commit: `test: add pytest scaffold against PostgreSQL`

### Task 0.2 — Alembic baseline completo

- [x] `alembic.ini` + `env.py`  
- [x] `0001_baseline` crea schema completo (`metadata.create_all`)  
- [x] Doc ops stamp (`alembic-ops.md`)  
- [x] Commit: `chore: alembic full schema baseline`

### Task 0.3 — Migración Fase 0

- [x] `0002_fase0_security_privacy`  
- [x] Upgrade/downgrade en copia PG  
- [x] Commit: `feat: fase0 security privacy schema`

### Task 0.4 — Tenant guards

- [x] `tenant.py` + routers/services  
- [x] Tests T1–T6, T8–T12  
- [x] Commit: `fix: enforce institution isolation`

### Task 0.5 — Audit enriquecido + lecturas sensibles

- [x] Modelo + `record_audit` + acciones de lectura  
- [x] Tests A*  
- [ ] Commit: `feat: tenant-aware sensitive read audit`

### Task 0.6 — Chroma v2

- [ ] Indexer/search → `sidtrac_documents_v2`  
- [ ] Script migrate + validate  
- [ ] Commit: `feat: chroma collection v2 with institution_id`

### Task 0.7 — Privacy + AI flags

- [ ] HMAC/`student_ref`, allowlist, redact RAG store  
- [ ] `AI_PROVIDER_DISABLED`  
- [ ] Tests P*  
- [ ] Commit: `feat: minimize AI payloads and gate provider`

### Task 0.8 — Feature flags + capabilities

- [ ] Flags off; `case.view_professional` no en admin; allowlist demo IDs  
- [ ] break_glass stub + audit action constant  
- [ ] Commit: `feat: feature flags and case capabilities`

### Task 0.9 — Gate

- [ ] Suite verde + checklist  
- [ ] Stop → pedir Fase 1

---

## Criterios de aceptación

1–12 según ajustes: isolation, query override, Chroma v2, HMAC ref, AI_PROVIDER_DISABLED, audit scope_type + lecturas, baseline completo, pytest PG, flags off, sin DeceCase/ActionPlan/education_levels.
