# SIDTRAC — Documentación de Implementación

Sistema Inteligente de Detección Temprana de Riesgo Académico y Conductual.  
Versión del documento: **Junio 2026** — alineado al ERS v1.0.

---

## 1. Resumen ejecutivo

SIDTRAC es un prototipo full-stack con arquitectura **RAG** (Retrieval-Augmented Generation) para instituciones de Bachillerato. Integra datos académicos, conductuales y emocionales en una sola plataforma con alertas tempranas automáticas y consulta conversacional para el DECE.

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + Tailwind + Recharts + Axios |
| Backend | FastAPI + SQLAlchemy async + Uvicorn |
| BD relacional | PostgreSQL 16 |
| BD vectorial | ChromaDB (persistente en `chroma_data/`) |
| LLM | OpenRouter → `meta-llama/llama-3.1-8b-instruct` |
| Email | Resend (alertas alto/crítico) |
| Scheduler | APScheduler (evaluación diaria de riesgo) |

---

## 2. Estructura del proyecto

```
school-alert/
├── school-alert-backend/     # API FastAPI
│   ├── app/
│   │   ├── modules/          # Módulos por dominio (M1–M8)
│   │   ├── api/router.py     # Router central
│   │   └── main.py           # App + scheduler
│   ├── chroma_data/          # Persistencia ChromaDB
│   ├── manage.py             # initdb, migrateusers
│   └── .env
├── school-alert-frontend/    # SPA React
│   └── src/modules/          # Módulos por feature
├── school-alert-frontendnext/ # Prototipo UI original (Next.js, referencia visual)
├── ers.md                    # Especificación de requerimientos
├── bd.md                     # Modelo de datos
└── IMPLEMENTACION.md         # Este documento
```

---

## 3. Módulos implementados (M1–M8)

### M1 — Gestión de Institución y Configuración ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-01 | ✅ | CRUD institución (nombre, código, dirección, teléfono, correo) |
| RF-02 | ✅ | Periodos lectivos; solo uno activo (`activate_term`) |
| RF-03 | ✅ | Cursos por nivel y paralelo |
| RF-04 | ✅ | Materias + asignación curso-materia-docente |
| RF-05 | ✅ | Umbrales en `configuracion_alertas` (panel Alertas en Settings) |
| RF-06 | ✅ | `correo_remitente` en configuración de alertas |

**Frontend:** `/settings` — pestañas Institución, Periodos, Cursos, Materias, Asignaciones, Alertas, Email, Auditoría, RAG.

**API:** `/api/v1/institution/*`

---

### M2 — Gestión de Usuarios y Accesos ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-07 | ✅ | CRUD usuarios con roles múltiples (`usuario_roles`) |
| RF-08 | ✅ | Login por **username** + contraseña (cédula por defecto); bcrypt |
| RF-09 | ✅ | Guards por rol en rutas backend y frontend |
| RF-10 | ✅ | JWT 8 horas (`ACCESS_TOKEN_EXPIRE_HOURS`) |
| RF-11 | ✅ | Activar/desactivar cuenta (`status`) |
| RF-12 | ⚠️ Parcial | Auditoría en login, reportes, alertas, RAG, config; falta logout y edición de notas |
| RF-13 | ⚠️ Parcial | Admin puede resetear password vía API; sin UI de cambio de contraseña |

**Roles:** `administrador`, `dece`, `tutor`, `docente`, `inspector`, `representante`.

**Flujo multi-rol:** Login → si tiene varios roles → `/select-role` → dashboard según rol activo.

**Frontend:** `/users` (admin), `/login`, `/select-role`.

**API:** `/api/v1/auth/*`, `/api/v1/users/*`

---

### M3 — Gestión Académica ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-14 | ✅ | Calificaciones 0–10 por quimestre/parcial |
| RF-15 | ✅ | Promedio calculado al consultar (AVG en SQL) |
| RF-16 | ❌ | Sin cierre de parciales (cualquier docente edita cualquier parcial) |
| RF-17 | ✅ | Asistencia: presente, ausente, tardanza, justificado |
| RF-18 | ⚠️ Parcial | Resumen general; sin filtro por rango de fechas en API |
| RF-19 | ⚠️ Parcial | Gráfico mensual en Perfil 360; sin heatmap por materia |
| RF-20 | ✅ | Bulk attendance + "Marcar todos ausentes" en UI |

**Frontend:** `/academic` — paneles por rol (docente edita, tutor/DECE/admin solo lectura).

**API:** `/api/v1/academic/assignments`, `grades/*`, `attendance/*`, `overview`, `students/{id}/profile`

---

### M4 — Seguimiento Conductual y DECE ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-21 | ✅ | 6 tipos de reporte DECE |
| RF-22 | ✅ | Urgencia, acciones, seguimiento |
| RF-23 | ✅ | Anotaciones tutor (5 tipos) |
| RF-24 | ✅ | Reportes disciplinarios inspector |
| RF-25 | ✅ | Indexación ChromaDB al crear (`index_behavioral_document`) |
| RF-26 | ✅ | Timeline cronológico en Perfil 360 |
| RF-27 | ✅ | Filtros DECE por tipo, urgencia, fechas |

**Tablas:** `reportes_dece`, `anotaciones_tutor`, `reportes_disciplinarios`, `documentos_indexados`.

**Frontend:** `/behavioral` (por rol), timeline en `StudentProfileDialog`.

**API:** `/api/v1/behavioral/*`

**Separación tutor vs DECE:**
- Tutor → crea **anotaciones**; lee reportes DECE (timeline).
- DECE → crea **reportes formales** con urgencia y plan de intervención.

---

### M5 — Motor de Alertas Tempranas ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-28 | ✅ | Evaluación diaria vía APScheduler (hora desde `configuracion_alertas.evaluation_hour`) |
| RF-29 | ✅ | Indicadores: académico, ausencias 30d, disciplinario, combinado |
| RF-30 | ✅ | Niveles bajo/medio/alto/crítico → actualiza `nivel_riesgo_actual` del estudiante |
| RF-31 | ✅ | Sin duplicados activos del mismo nivel en 7 días |
| RF-32 | ✅ | Atender alerta con acciones registradas |
| RF-32b | ✅ | Mitigación de semáforo al atender + anti-duplicado en evaluación — ver `SEMAFORO_INTERVENCION.md` |
| RF-33 | ✅ | Umbrales editables en Settings |
| RF-34 | ✅ | Alerta manual desde `/alerts` |

**Semáforo (estado en tablas):**

| BD (`nivel_riesgo_actual`) | UI | Etiqueta |
|----------------------------|-----|----------|
| `bajo` | Verde | Estable |
| `medio` | Ámbar | En observación |
| `alto` | Rojo | Requiere atención |
| `critico` | Morado | Crítico |

> **Importante:** El badge "Estable" viene del motor de alertas (`POST /alerts/evaluate` o job nocturno), no del promedio mostrado en la tabla. Ejecuta evaluación manual la primera vez si todos salen "Estable".

> **Semáforo e intervención (Jun 2026):** Al atender una alerta con acciones, el semáforo baja un escalón (p. ej. crítico→alto). **Evaluar ahora** no recrea la misma alerta si ya fue atendida en los últimos 21 días. Detalle: **`SEMAFORO_INTERVENCION.md`**.

**Frontend:** `/alerts`, stats en Panel DECE, botón "Evaluar ahora" en Settings y Alerts.

**API:** `/api/v1/alerts/*`

---

### M6 — Consulta RAG (Inteligencia Artificial) ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-35 | ✅ | Chat en `/rag` para DECE y admin |
| RF-36 | ✅ | Preguntas sugeridas en UI |
| RF-37 | ⚠️ Parcial | Pipeline completo; embeddings usa Chroma default (no OpenRouter). Ver **`RAG.md`** |
| RF-38 | ✅ | Sección "Recomendaciones de Intervención" en prompt |
| RF-39 | ✅ | `NIVEL_RIESGO:` parseado de la respuesta |
| RF-40 | ✅ | Log en `consultas_rag` + auditoría; métricas en Settings |
| RF-41 | ✅ | Historial de chat se limpia al cambiar estudiante |

#### Arquitectura RAG (SIDTRAC)

> **Documentación completa:** ver [`RAG.md`](./RAG.md) — flujo, indexación, roles, prueba demo y detalle técnico.

Resumen: **sí está implementado y conectado**. Al crear reportes conductuales se indexan en Chroma; en `/rag` el DECE pregunta en español y el backend arma contexto SQL + documentos recuperados + LLM OpenRouter.

```
Pregunta → [PostgreSQL: notas/asistencia/alertas] + [ChromaDB: top-5 docs] → Prompt → OpenRouter → Respuesta
```

**Frontend:** `/rag` (chat), métricas e historial en Settings.

**API:** `POST /api/v1/rag/query`, `GET /rag/history`, `GET /rag/metrics`

---

### M7 — Notificaciones por Correo ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-42 | ✅ | Email a representante + DECE en alertas alto/crítico |
| RF-43 | ✅ | HTML con estudiante, curso, riesgo, recomendaciones |
| RF-44 | ✅ | Log en `notificaciones_email` con estado Resend |
| RF-45 | ⚠️ Parcial | Registro de error; reenvío manual desde panel |
| RF-46 | ✅ | Notificación interna (sin email) para nivel medio |
| RF-47 | ✅ | Correo de prueba en Settings |

**Frontend:** Campana de notificaciones (`NotificationsBell`), panel Email en Settings.

**API:** `/api/v1/notifications/*`

---

### M8 — Reportes y Auditoría ✅

| RF | Estado | Detalle |
|----|--------|---------|
| RF-48 | ✅ | Reporte institucional de riesgo |
| RF-49 | ✅ | Reporte individual consolidado |
| RF-50 | ✅ | Export CSV |
| RF-51 | ⚠️ Parcial | Log de auditoría; cobertura incompleta |
| RF-52 | ✅ | Métricas RAG en Settings |

**Frontend:** `/reports`, pestaña Auditoría y RAG en Settings.

**API:** `/api/v1/reports/*`, `/api/v1/audit/*`

---

## 4. Pantallas y rutas frontend

| Ruta | Roles | Descripción |
|------|-------|-------------|
| `/login` | Todos | Autenticación |
| `/select-role` | Multi-rol | Selección de rol activo |
| `/dashboard` | Todos | Panel por rol (DECE, tutor, docente, inspector, representante) |
| `/students` | admin, dece, tutor | CRUD estudiantes |
| `/academic` | admin, dece, tutor, docente | Calificaciones y asistencia |
| `/behavioral` | admin, dece, tutor, inspector | Seguimiento conductual |
| `/alerts` | admin, dece, tutor, inspector | Alertas tempranas |
| `/rag` | admin, dece | Consulta inteligente |
| `/reports` | admin, dece | Reportes y exportación |
| `/users` | admin | Personal y roles |
| `/settings` | admin | Configuración institución |

### Paneles por rol

- **DECE/Admin:** Dashboard con KPIs reales, alertas, reportes DECE, enlace a RAG.
- **Tutor:** Paralelo real, anotaciones, promedios, Perfil 360.
- **Docente:** Materias asignadas, notas, asistencia masiva.
- **Inspector:** Reportes disciplinarios, estudiantes del plantel.
- **Representante:** Vista mobile-first (estado hijo/a, recomendaciones, buzón).

### Perfil 360 (`StudentProfileDialog`)

- Radar de rendimiento por materia (datos reales).
- Gráfico de asistencia mensual.
- Timeline conductual (DECE + tutor + disciplinario).
- KPIs: promedio, ausencias, tardanzas.

---

## 5. API — Endpoints principales

Base: `http://127.0.0.1:8000/api/v1`

```
POST   /auth/login
POST   /auth/select-role
GET    /users
POST   /users
PATCH  /users/{id}

GET    /institution/...
GET    /students
POST   /students
GET    /students/{id}

GET    /academic/assignments
GET    /academic/grades/roster
POST   /academic/grades/bulk
GET    /academic/attendance/roster
POST   /academic/attendance/bulk
GET    /academic/overview
GET    /academic/students/{id}/profile

GET    /behavioral/summary
GET    /behavioral/dece-reports
POST   /behavioral/dece-reports
GET    /behavioral/tutor-notes
POST   /behavioral/tutor-notes
GET    /behavioral/disciplinary-reports
POST   /behavioral/disciplinary-reports
GET    /behavioral/students/{id}/timeline

GET    /alerts
GET    /alerts/stats
POST   /alerts/evaluate
POST   /alerts/manual
POST   /alerts/{id}/attend
GET    /alerts/config
PATCH  /alerts/config

POST   /rag/query
GET    /rag/history
GET    /rag/metrics

GET    /notifications/internal
POST   /notifications/email/test
GET    /notifications/email

GET    /audit/logs
GET    /reports/institutional
GET    /reports/students/{id}
GET    /reports/export/csv
```

Documentación interactiva: `http://127.0.0.1:8000/docs`

---

## 6. Variables de entorno

### Backend (`school-alert-backend/.env`)

```env
APP_NAME=SIDTRAC API
SECRET_KEY=change-me-in-production
ACCESS_TOKEN_EXPIRE_HOURS=8
DATABASE_URL=postgresql+asyncpg://postgres:tu_password@127.0.0.1:5432/sidtrac
CORS_ORIGINS=http://localhost:5173
OPENROUTER_API_KEY=sk-or-...        # Requerido para chat IA completo
RESEND_API_KEY=re_...               # Requerido para emails de alerta
```

### Frontend (`school-alert-frontend/.env`)

```env
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

---

## 7. Comandos de instalación y ejecución

### Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 16

### Backend

```powershell
cd school-alert-backend
pip install -r requirements.txt
python manage.py initdb          # Crea BD y tablas
python manage.py migrateusers    # Si hay usuarios legacy
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd school-alert-frontend
npm install
npm run dev
```

Abrir: `http://localhost:5173`

### Usuario admin por defecto

Tras seed/migración: `sadmin` / `admin123` (o según datos en BD).

---

## 8. Flujo recomendado para demo completa

1. **Login** como `sadmin` → rol Administrador o DECE.
2. **Settings** → verificar institución, cursos, materias asignadas.
3. **Estudiantes** → registrar o verificar estudiantes con representante.
4. **Académico** (como docente) → ingresar notas y asistencia.
5. **Seguimiento** → crear reporte DECE o anotación tutor (indexa en Chroma).
6. **Alertas** → `Evaluar ahora` → ver semáforos actualizados en estudiantes.
7. **Consulta IA** (`/rag`) → seleccionar estudiante, preguntar en español.
8. **Representante** → login con usuario representante → ver panel hijo/a.

---

## 9. Pendientes menores (no bloquean el prototipo)

| Área | Descripción |
|------|-------------|
| RF-16 | Cierre de parciales académicos |
| RF-18/19 | Asistencia con filtro de fechas y heatmap |
| RF-12 | Auditoría completa (logout, edición notas) |
| RF-13 | UI cambio de contraseña |
| RNF-07 | Bloqueo por intentos fallidos de login |
| Indexación | Pasar Chroma a tarea en background (Celery) |
| Scheduler | Re-programar hora si cambia `evaluation_hour` sin reiniciar servidor |

---

## 10. Tablas de base de datos

Registradas en `models_registry.py`:

- `instituciones`, `periodos_lectivos`, `cursos`, `materias`, `curso_materias`
- `usuarios`, `usuario_roles`
- `estudiantes`
- `calificaciones`, `asistencias`
- `reportes_dece`, `anotaciones_tutor`, `reportes_disciplinarios`
- `documentos_indexados`, `consultas_rag`
- `alertas`, `configuracion_alertas`
- `notificaciones_email`, `notificaciones_internas`
- `log_auditoria`

Detalle completo en `bd.md`.

---

## 11. Documentación del repositorio

| Archivo | Autor / origen | Contenido |
|---------|----------------|-----------|
| `ers.md` | Proyecto académico | Especificación de requerimientos (ERS v1.0) |
| `bd.md` | Proyecto académico | Modelo relacional PostgreSQL |
| **`IMPLEMENTACION.md`** | **Asistente IA (esta sesión)** | Estado M1–M8, rutas, APIs, comandos, pendientes |
| **`RAG.md`** | **Asistente IA (esta sesión)** | Arquitectura RAG detallada: flujo, Chroma, OpenRouter, demo |
| **`INSTRUCCIONES.md`** | **Asistente IA (esta sesión)** | Comandos paso a paso para inicializar backend/frontend en Windows |
| **`SEMAFORO_INTERVENCION.md`** | **Asistente IA (Jun 2026)** | Diseño mitigación semáforo tras intervención DECE (A+B); problema, reglas, implementación pendiente |
| **`DECE_PRUEBAS_RAG.md`** | **Asistente IA (Jun 2026)** | Banco de pruebas RAG desde perspectiva DECE |

## 12. Referencias externas

- **UI prototipo:** `school-alert-frontendnext/` — diseño original Next.js.
- **RAG referencia:** `DISEÑO DE INTEGRACIÓN CURRICULAR/proyecto/` — patrón orquestador (adaptado a ChromaDB en SIDTRAC).

---

*Documento generado para el proyecto SIDTRAC — UNEMI, Ingeniería de Software.*
