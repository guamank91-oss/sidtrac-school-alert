# Operaciones Alembic — SIDTRAC

## Conceptos

| Entorno | Procedimiento |
|---------|---------------|
| **BD nueva** | Crear database vacía → `alembic upgrade head` |
| **BD existente (ya tiene tablas)** | Inventariar schema → verificar contra baseline → `alembic stamp 20260713_0001` → luego `alembic upgrade head` para migraciones posteriores |
| **Producción** | Nunca `upgrade` sin stamp verificado y backup. Nunca `autogenerate` a ciegas. |

## Comandos (desde `school-alert-backend/`)

```bash
# Ver cabecera actual
alembic current
alembic history

# BD nueva (después de CREATE DATABASE)
alembic upgrade head

# BD existente alineada al baseline
alembic stamp 20260713_0001
alembic upgrade head

# Probar en copia
alembic upgrade head
alembic downgrade -1
```

## Baseline `20260713_0001`

Representa el esquema ORM completo **antes** de columnas Fase 0 (tenant/privacy).  
Se implementa con `Base.metadata.create_all` sobre el registry.

## Checklist stamp en BD existente

1. Backup.  
2. Comparar tablas/columnas críticas (`usuarios`, `estudiantes`, `alertas`, `reportes_dece`, `consultas_rag`, `logs_auditoria`, `documentos_indexados`).  
3. Confirmar ausencia de tablas Alembic previas o limpiar `alembic_version` si era experimental.  
4. `alembic stamp 20260713_0001`.  
5. Acta de verificación.

## Relación con `manage.py initdb`

`initdb` queda como legado greenfield. Preferir Alembic. Documentar en `INSTRUCCIONES.md` al cerrar Fase 0.
