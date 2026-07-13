# Informe de cierre — Fase 1

**Fecha:** 2026-07-13  
**Estado:** completada  
**Plan:** [`2026-07-13-fase-1-normativa.md`](./2026-07-13-fase-1-normativa.md)

## Archivos creados / modificados

- Migración `20260713_0003_normativa.py`
- Módulo `app/modules/normative/` (models, schemas, service, seed, router)
- `scripts/seed_normativa_rgloei.py`
- `tests/test_normative.py`
- `app/api/router.py`, `models_registry.py`

## Migraciones

`20260713_0003` → tablas `documentos_normativos`, `versiones_normativas`, `articulos_normativos`.  
Probada: `alembic upgrade head` en `sidtrac_alembic_probe` → version `20260713_0003`.

## Endpoints

| Método | Ruta | Roles |
|--------|------|-------|
| GET | `/api/v1/normative/documents` | admin, DECE |
| GET | `/api/v1/normative/articles` | admin, DECE |
| GET | `/api/v1/normative/articles/{id}` | admin, DECE |

## Pruebas

```text
30 passed  (suite completa, PostgreSQL)
```

Incluye seed idempotente, citation object fields, 330/331 no eje disciplinario.

## Criterios

| Criterio | Estado |
|----------|--------|
| Migración reversible en BD prueba | Cumplido (upgrade probe) |
| Seed idempotente | Cumplido |
| Citas objeto completo | Cumplido |
| Chroma global sin student_id | Cumplido (metadata `scope=global`) |
| 330/331 ≠ faltas | Cumplido |
| Sin DeceCase/ActionPlan | Cumplido |

## Riesgos / deuda

- Textos de cuerpo = paráfrasis operativa del diagnóstico; **reemplazar/verificar con PDF oficial** antes de producción (URL/checksum documentados en seed).
- LOEI tipicidad de faltas **omitida** hasta texto oficial verificado.
- Protocolos psicosociales/violencia: no seedeados como docs separados aún (Fase 2 ProtocolActivation puede referenciar tipos).

## Commits

```text
06b4baf feat: normativa schema migration
8d279b9 feat: normative read API
65425fa feat: seed rgloei and index normative chroma
```
