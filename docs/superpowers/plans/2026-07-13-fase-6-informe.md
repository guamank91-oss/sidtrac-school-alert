# Informe de cierre — Fase 6

**Integración:** bloque `PLAN DE ATENCIÓN ACTIVO` en `RagService._structured_context` con ítems y citas normativas objeto.  
**Prueba:** `tests/test_rag_active_plan.py` — contexto incluye objetivo y acción del plan activo.  
**Criterios:** chat usa hechos del plan; no inventa artículos fuera de refs del plan; feature flag respetado.  
**Suite final:** **38 passed** (PostgreSQL).
