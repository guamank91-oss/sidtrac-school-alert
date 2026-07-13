# Informe de cierre — Fase 2

**Fecha:** 2026-07-13  
**Estado:** completada  

## Migración

`20260713_0004_dece_cases` — `casos_dece`, `caso_alerta`, `triages_caso`, `activaciones_protocolo`, `derivaciones_externas`. Probada en `sidtrac_alembic_probe`.

## Endpoints

- `POST/GET /api/v1/cases`, `GET /cases/{id}`
- `POST /cases/{id}/triage`
- `POST /cases/{id}/protocols`, `PATCH /cases/protocols/{id}`
- `POST /cases/{id}/referrals`

## Pruebas

34 passed (suite completa). Criterios: flag off 403, admin sin professional no confirma triage, cross-tenant 403, protocolo independiente, referral manual.

## Riesgos

- UI aun no expone casos (Fase 5).  
- AI assist en triage no implementado (solo reglas + confirmación).  
- Vistas assigned_actions pendientes de planes (Fase 3).

## Commits

`feat: DeceCase triage protocols and referrals`
