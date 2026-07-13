# Informe de cierre — Fase 0

**Fecha:** 2026-07-13  
**Estado:** completada y validada (suite PostgreSQL verde)  
**Plan:** [`2026-07-13-fase-0-seguridad-privacidad.md`](./2026-07-13-fase-0-seguridad-privacidad.md)

## Resumen

Se cerraron isolation multi-institución, auditoría tenant-aware (lecturas sensibles), Chroma `sidtrac_documents_v2` con `institution_id`, minimización/`student_ref` HMAC, gate `AI_PROVIDER_DISABLED`, feature flags DECE/planes off, capacidades `case.*` (admin **sin** `case.view_professional` por defecto) y scaffold pytest solo PostgreSQL. **Sin** DeceCase, ActionPlan, normativa seed ni Perfil 360.

## Archivos creados (principales)

| Área | Rutas |
|------|--------|
| Alembic | `alembic.ini`, `alembic/env.py`, `alembic/versions/20260713_0001_baseline.py`, `20260713_0002_fase0_security_privacy.py` |
| Shared | `app/shared/tenant.py`, `permissions.py`, `feature_flags.py`, `audit_actions.py`, `privacy/minimization.py`, `exceptions.py` (+ `ForbiddenError`, `http_status_for`) |
| Tests | `tests/conftest.py`, `test_smoke.py`, `fixtures_tenant.py`, `test_tenant_*.py`, `test_audit_institution.py`, `test_chroma_v2.py`, `test_rag_privacy.py`, `test_capabilities.py` |
| Ops | `scripts/migrate_chroma_to_v2.py`, `docs/superpowers/plans/alembic-ops.md` |

## Archivos modificados (principales)

Routers/services: students, users, institution, alerts, behavioral, academic, rag, audit.  
Config: `CHROMA_COLLECTION`, `AI_PROVIDER_ENABLED`, feature flags, `STUDENT_REF_HMAC_SECRET`, `PROFESSIONAL_ACCESS_USER_IDS`.

## Migraciones

1. `20260713_0001_baseline` — schema completo actual (`metadata.create_all` en BD **nueva**).  
2. `20260713_0002_fase0_security_privacy` — audit columns, `documentos_indexados.institucion_id`, RAG redaction fields.

**No** se ejecutó upgrade sobre producción. BD existentes: verificar → `alembic stamp` (ops doc).

## Endpoints / comportamiento nuevo

No hay routers nuevos de dominio DECE. Cambios de comportamiento:

- Query/body `institution_id` ≠ sesión → **403**.  
- Lecturas sensibles auditan acciones Fase 0.  
- `POST /api/v1/rag/query` con `AI_PROVIDER_ENABLED=false` → **503** `AI_PROVIDER_DISABLED`.  
- Listado audit filtrado por institución (+ globales).

## Pruebas

```text
python -m pytest tests/ -q
27 passed  (PostgreSQL sidtrac_test)
```

Cubre smoke, tenant T1–T12 (muestra), audit A*, chroma naming, privacy P*, capabilities.

## Criterios de aceptación

| Criterio | Estado |
|----------|--------|
| Isolation / no override institution_id | Cumplido |
| Chroma v2 + institution_id | Cumplido (script cutover) |
| HMAC student_ref | Cumplido |
| AI_PROVIDER_DISABLED | Cumplido |
| Audit scope_type + lecturas | Cumplido |
| Baseline Alembic completo | Cumplido |
| pytest solo PG | Cumplido |
| Flags off / admin sin professional | Cumplido |
| Sin DeceCase/ActionPlan/education_levels | Cumplido |

## Riesgos / deuda técnica

- Stamp/upgrade en BD real `sidtrac` aún **manual**.  
- Cutover Chroma v1→v2 en datos locales/prod pendiente de ops (`migrate_chroma_to_v2.py`).  
- Minimización del **payload** LLM aún parcial (contexto estructurado completo se arma; store redactado; Fase 4 endurece generate).  
- `education_levels` / `funding_type` aplazados (Fase 1–2 configuración).  
- Matriz §7 del diagnóstico vs §0.3: se aplica **§0.3** (admin sin professional por defecto).

## Commits

```text
c673526 test: add pytest scaffold against PostgreSQL
9e08f87 chore: alembic full schema baseline
f39e997 feat: fase0 security privacy schema
7fd0e83 fix: enforce institution isolation
3ee8128 feat: tenant-aware sensitive read audit
7d5dd69 feat: chroma collection v2 with institution_id
55eea13 feat: minimize AI payloads and gate provider
55b97dc feat: feature flags and case capabilities
81957e0 docs: mark Fase 0 complete and ready for Fase 1
```
