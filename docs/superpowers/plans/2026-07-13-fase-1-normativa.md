# Fase 1 — Normativa canónica y Chroma institucional

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or implement task-by-task. Steps use checkbox (`- [ ]`) syntax.  
> **Prerrequisito:** Fase 0 completada ([informe](./2026-07-13-fase-0-informe.md)).

**Goal:** Persistir documentos/versiones/artículos normativos versionados, seed idempotente RGLOEI (DE-675) con arts. acordados, indexar chunks institucionales en Chroma v2 **sin** `student_id`, y exponer lectura API + resolución de citas.

**Architecture:** Tablas `documentos_normativos` → `versiones_normativas` → `articulos_normativos`; indexación Chroma metadata `{institution_id? null for global, document_code, article, source_chunk_id}`; API read-only DECE/admin; sin DeceCase/ActionPlan.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic migración **0003** aislada, Chroma, pytest PostgreSQL.

## Global Constraints

- Una migración Alembic por fase (solo 0003 aquí).
- Tests solo PostgreSQL.
- No mezclar docs sin `institution_id` con student docs en cutover; normativa puede usar metadata `scope=global` y `student_id` ausente.
- Citas = objeto completo (no solo `"Art. 32"`).
- No tipificar faltas LOEI sin texto verificado; en seed solo RGLOEI arts. listados (+ stubs de protocolo con título si falta texto oficial).
- Sin PII a OpenRouter (esta fase no llama IA).
- Admin sin professional por defecto (sin cambio).

---

## Mapa de archivos

| Crear | Rol |
|-------|-----|
| `alembic/versions/20260713_0003_normativa.py` | Tablas normativas |
| `app/modules/normative/...` | models, schemas, service, router, seed data |
| `scripts/seed_normativa_rgloei.py` | Seed idempotente + index Chroma |
| `tests/test_normative.py` | CRUD lectura, resolve, isolation metadata |

| Modificar | Cambio |
|-----------|--------|
| `app/api/router.py` | include `/normative` |
| `models_registry.py` | import models |
| indexer helpers | upsert normativo sin student_id |

---

## Tasks

### Task 1.1 — Migración 0003

- [ ] Crear tablas + índices
- [ ] Upgrade en `sidtrac_test` / probe
- [ ] Commit: `feat: normativa schema migration`

### Task 1.2 — Modelos + API lectura

- [ ] Models/schemas/service/router
- [ ] `GET /normative/documents`, `GET /normative/articles`, `GET /normative/articles/{id}`
- [ ] Tests lectura
- [ ] Commit: `feat: normative read API`

### Task 1.3 — Seed + Chroma institucional

- [ ] Seed RGLOEI-DE-675 arts. 32, 171–172, 330–333, 364–369
- [ ] Index Chroma v2 chunks `norm:{code}:{article}`
- [ ] Tests seed idempotente + metadata sin student_id
- [ ] Commit: `feat: seed rgloei and index normative chroma`

### Task 1.4 — Gate Fase 1

- [ ] Suite verde + informe + actualizar diagnóstico
- [ ] Solo entonces Fase 2

---

## Criterios de aceptación

1. Migración 0003 reversible en BD de prueba.  
2. Seed idempotente (re-run no duplica articles).  
3. API retorna citas con `document_code`, `version`, `article`, `article_title`, `effective_from`, `source_chunk_id`.  
4. Chroma chunks normativos sin `student_id`; búsqueda por metadata document/article.  
5. Arts. 330/331 **no** tipificados como faltas.  
6. Sin tablas DeceCase/ActionPlan.
