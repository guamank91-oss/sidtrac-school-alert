<div align="center">

<img src="docs/assets/sidtrac-banner.svg" width="100%" alt="SIDTRAC — Sistema Institucional de Detección Temprana de Riesgo Académico y Conductual" />

<br />

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=0b1d3a)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-RAG_Normativo-8B5CF6?style=for-the-badge)](https://www.trychroma.com/)

<p align="center">
  <a href="#vision-general"><b>Visión General</b></a> ·
  <a href="#modulos"><b>Módulos</b></a> ·
  <a href="#arquitectura"><b>Arquitectura</b></a> ·
  <a href="#semaforo-ia"><b>Semáforo &amp; IA</b></a> ·
  <a href="#instalacion"><b>Instalación Rápida</b></a> ·
  <a href="#estructura"><b>Estructura</b></a>
</p>

</div>

---

<a id="vision-general"></a>

## 🎯 Visión General

**SIDTRAC** (*Sistema Institucional de Detección Temprana de Riesgo Académico y Conductual*) es una plataforma educativa **multi-institución y multi-rol** diseñada para unidades educativas del Ecuador bajo el marco de la **LOEI** y su Reglamento General (**RGLOEI**).

Su objetivo es **prevenir la deserción escolar, el bajo rendimiento y las vulneraciones psicosociales** integrando en tiempo real:

1. **Monitoreo Académico y Asistencial** por quimestre, parcial y asignatura.
2. **Registro Conductual y Psicosocial** diferenciado por nivel de confidencialidad (*anotaciones de tutoría, faltas disciplinarias e informes reservados DECE*).
3. **Motor Automático de Alertas y Semáforo de Riesgo (`Bajo`, `Medio`, `Alto`, `Crítico`)** con lógica de **mitigación trazable** mediante intervenciones y planes de acción validados.
4. **Planes de Atención DECE y Copiloto RAG Normativo**, capaces de sintetizar hechos del expediente estudiantil sin exponer datos identificables (minimización PII con HMAC) y vincular artículos vigentes del RGLOEI.

---

<a id="modulos"></a>

## ✨ Ecosistema Bento & Módulos

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🧠 Copiloto DECE &amp; RAG Normativo</h3>
      <p>Asistente especializado para el Departamento de Consejería Estudiantil con búsqueda híbrida sobre la normativa educativa (<b>LOEI / RGLOEI</b>), guardia de intención (<i>intent guard</i>) y contexto vivo del expediente 360° del estudiante.</p>
      <ul>
        <li>Generación estructurada de <b>Planes de Atención Documentales</b> con triage inicial.</li>
        <li>Minimización de datos personales antes de invocar proveedores de IA.</li>
        <li>Citas normativas verificables por código de documento y artículo.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🚦 Semáforo de Riesgo &amp; Mitigación</h3>
      <p>Motor determinístico que evalúa indicadores académicos, inasistencias, atrasos y reportes conductuales para clasificar el riesgo estudiantil en tiempo real.</p>
      <ul>
        <li><b>Escalamiento automático</b> ante indicadores extremos o reincidencia.</li>
        <li><b>Mitigación progresiva</b> cuando el tutor o DECE registra seguimiento efectivo.</li>
        <li>Notificaciones internas en tiempo real con priorización visual.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📚 Gestión Académica Sincronizada</h3>
      <p>Espacio de trabajo ágil para docentes y supervisión directiva con interfaz <i>Liquid Glassmorphism</i>.</p>
      <ul>
        <li>Carga rápida de <b>calificaciones</b> por teclado (<kbd>Enter</kbd> / <kbd>↓</kbd> / <kbd>↑</kbd>) con detección de notas menores a <code>7.00</code>.</li>
        <li>Control de <b>asistencia diaria</b> con acciones masivas y protección contra cambios sin guardar.</li>
        <li>Sincronización de filtros en URL y comparativa histórica entre periodos lectivos.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🛡️ Perfil 360° &amp; Gobernanza</h3>
      <p>Expediente integral por estudiante con control estricto de acceso basado en roles (RBAC) y trazabilidad en bitácora de auditoría.</p>
      <ul>
        <li>Gráficos radar de rendimiento por materia y curva de asistencia mensual.</li>
        <li>Exportación de reportes ejecutivos y fichas estudiantiles en <b>PDF</b>.</li>
        <li>Flujo de validación de compromisos entre <b>DECE, Tutor y Docente</b>.</li>
      </ul>
    </td>
  </tr>
</table>

---

<a id="arquitectura"></a>

## 🏗️ Arquitectura del Sistema

```mermaid
flowchart LR
  subgraph Client["💻 Frontend — React 19 + TypeScript + Vite"]
    UI["Glassmorphism Bento UI\n(Tailwind CSS 4 + Radix UI)"]
    Router["RBAC Router & PeriodContext"]
    Charts["Recharts Analytics & PDF"]
  end

  subgraph Server["⚡ Backend — FastAPI Async (Python 3.11+)"]
    API["REST API /api/v1\nJWT + Role Guard"]
    Engine["Alert & Risk Engine\n(Semáforo + Mitigación)"]
    PlanGen["Action Plan Generator\n(Triage + PII Minimization)"]
    RAG["RAG Service & Intent Guard"]
  end

  subgraph Data["🗄️ Persistencia & IA"]
    PG[("PostgreSQL 16\nSQLAlchemy 2.0 Async + Alembic")]
    Chroma[("ChromaDB\nCorpus Normativo RGLOEI")]
    LLM["OpenRouter LLM\n(Structured JSON Output)"]
  end

  UI --> Router --> API
  Charts --> API
  API --> Engine --> PG
  API --> PlanGen --> LLM
  PlanGen --> PG
  API --> RAG --> Chroma
  RAG --> LLM
```

---

<a id="semaforo-ia"></a>

## 🚦 Semáforo Inteligente y Planes DECE

```mermaid
stateDiagram-v2
  [*] --> Bajo: Sin indicadores de alerta
  Bajo --> Medio: Notas < 7.0 o atrasos reiterados
  Medio --> Alto: Faltas graves o múltiples materias en riesgo
  Alto --> Critico: Falta muy grave / ficha DECE alta severidad

  Critico --> Alto: Intervención DECE + Plan Activo
  Alto --> Medio: Avances reportados y validados
  Medio --> Bajo: Estabilización académica y conductual
```

<details>
<summary><b>🔐 Ver Matriz de Roles y Permisos Institucionales (RBAC)</b></summary>
<br />

| Rol | Alcance en la Plataforma | Permisos Clave |
| :--- | :--- | :--- |
| **Superadministrador** | Multi-institución (SaaS) | Alta de instituciones educativas, planes de suscripción y monitoreo global de consumo IA. |
| **Administrador / Rector** | Institucional completo | Configuración de periodos lectivos, cursos, materias, asignaciones docentes, personal y dashboard directivo. |
| **DECE** | Institucional psicosocial | Gestión de casos DECE, triage, generación/aprobación de planes de atención, validación de acciones, fichas reservadas y copiloto RAG. |
| **Tutor de Curso** | Paralelo asignado | Registro de anotaciones formativas, reportes disciplinarios, seguimiento de alertas de su curso y reporte de cumplimiento en planes DECE. |
| **Docente** | Materias asignadas | Registro de calificaciones por quimestre/parcial, toma de asistencia diaria y reporte de acciones pedagógicas asignadas por DECE. |
| **Representante** | Estudiantes representados | Consulta móvil del rendimiento académico, asistencia y comunicados de sus representados. |

</details>

<details>
<summary><b>📋 Ver Ciclo de Vida del Plan de Atención DECE (Caso → Borrador IA → Validación)</b></summary>
<br />

1. **Apertura y Triage (`DeceCase`):** El profesional DECE abre un caso para el estudiante y confirma el triage inicial (evaluando si un plan de seguimiento es suficiente o si requiere activar además un protocolo de protección de derechos).
2. **Síntesis y Borrador Asistido (`generatePlanDraft`):** El sistema recopila hechos verificables del expediente (promedio, materias críticas, inasistencias, reportes disciplinarios) y genera una propuesta estructurada con objetivos, responsables (`dece`, `tutor`, `docente`), indicadores de éxito y sustento normativo RGLOEI.
3. **Revisión y Activación (`approvePlan`):** El DECE edita o ajusta libremente cada acción antes de activar la versión oficial del plan.
4. **Ejecución y Validación Cruzada (`reportItemProgress` → `validateItem`):**
   - Cada actor responsable reporta el cumplimiento de sus acciones desde el **Perfil 360°**.
   - El DECE revisa la evidencia reportada y **aprueba** (incrementando el porcentaje de progreso validado) o **solicita ajustes** (devolviendo la acción a *En progreso* con retroalimentación en bitácora).

</details>

<details>
<summary><b>🔌 Ver Módulos Principales de la API REST (<code>/api/v1</code>)</b></summary>
<br />

| Prefijo | Módulo | Descripción |
| :--- | :--- | :--- |
| `/api/v1/auth` | Autenticación | Login JWT, selección de rol activo (`select-role`) y cambio de contraseña. |
| `/api/v1/institution` | Institución | Periodos lectivos, cursos/paralelos, materias y asignaciones docente-materia. |
| `/api/v1/users` | Personal | Alta y administración de personal con generación automática de credenciales. |
| `/api/v1/students` | Estudiantes | Padrón estudiantil, importación masiva CSV/Excel, Perfil 360° e intervenciones. |
| `/api/v1/academic` | Académico | Nóminas de calificaciones, registro de asistencia diaria y panorámica por curso. |
| `/api/v1/behavioral` | Conductual | Anotaciones del tutor, faltas disciplinarias e informes reservados DECE. |
| `/api/v1/alerts` | Alertas | Bandeja de alertas preventivas, reevaluación del motor y estados de atención. |
| `/api/v1/cases` | Casos DECE | Gestión de expedientes de caso y confirmación de triage. |
| `/api/v1/action-plans` | Planes DECE | Generación de borradores, aprobación versionada, reporte de avance y validación. |
| `/api/v1/rag` | Copiloto RAG | Consultas normativas y situacionales con guardia de alcance y memoria de sesión. |
| `/api/v1/reports` | Reportes PDF | Exportación de informes institucionales y fichas individuales en PDF. |

</details>

---

<a id="instalacion"></a>

## 🚀 Instalación y Despliegue Local

### 1. Requisitos Previos

- **Python** `3.11+`
- **Node.js** `20+` y `npm`
- **PostgreSQL** `16+` ejecutándose en el puerto `5432` (con una base de datos llamada `sidtrac`)

---

### 2. Configurar y Ejecutar el Backend (`school-alert-backend`)

```bash
cd school-alert-backend

# 1. Crear entorno virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt

# 2. Configurar variables de entorno
copy .env.example .env
```

Edita `school-alert-backend/.env` con tus credenciales locales de PostgreSQL y tu clave de OpenRouter (opcional para generación asistida por IA; el sistema incluye *fallback* determinístico local):

```env
APP_NAME=SIDTRAC API
APP_ENV=development
DEBUG=true
SECRET_KEY=cambia-esta-clave-en-produccion
DATABASE_URL=postgresql+asyncpg://postgres:tu_password@127.0.0.1:5432/sidtrac
CORS_ORIGINS=http://localhost:5173
AI_PROVIDER_ENABLED=true
FEATURE_DECE_CASES=true
FEATURE_ACTION_PLANS=true
```

Aplica las migraciones con **Alembic**, carga la semilla normativa del **RGLOEI** e inicia el servidor:

```bash
# Aplicar migraciones de base de datos
alembic upgrade head

# Sembrar corpus normativo RGLOEI
python scripts/seed_normativa_rgloei.py --no-chroma

# Crear superusuario inicial (opcional)
python manage.py createsuperuser --email admin@sidtrac.edu --first-name Admin --last-name System --national-id 9999999999 --password admin123

# Iniciar servidor FastAPI en http://127.0.0.1:8000
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

> [!TIP]
> La documentación interactiva **Swagger / OpenAPI** estará disponible en `http://127.0.0.1:8000/docs`.

---

### 3. Configurar y Ejecutar el Frontend (`school-alert-frontend`)

```bash
cd school-alert-frontend

# 1. Configurar URL de la API
copy .env.example .env

# 2. Instalar dependencias y levantar entorno de desarrollo
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador. Para compilar y verificar tipos para producción:

```bash
npm run build
```

---

<a id="estructura"></a>

## 📂 Estructura del Proyecto

```text
school-alert/
├── docs/
│   └── assets/
│       └── sidtrac-banner.svg          # Banner vectorial animado del repositorio
├── school-alert-backend/               # API Async en FastAPI + SQLAlchemy 2.0
│   ├── alembic/                        # Migraciones versionadas de PostgreSQL
│   ├── app/
│   │   ├── api/                        # Enrutador raíz /api/v1
│   │   ├── core/                       # Configuración, JWT, seguridad y base de datos
│   │   ├── modules/                    # Arquitectura modular por dominio
│   │   │   ├── academic/               # Calificaciones, asistencia y promedios
│   │   │   ├── action_plans/           # Planes de atención DECE, generación y validación
│   │   │   ├── alerts/                 # Motor de semáforo y alertas tempranas
│   │   │   ├── audit/                  # Bitácora inmutable de auditoría
│   │   │   ├── auth/                   # Sesiones y cambio de rol activo
│   │   │   ├── behavioral/             # Anotaciones, disciplina y reportes DECE
│   │   │   ├── cases/                  # Expedientes y triage DECE
│   │   │   ├── institution/            # Periodos, cursos, materias y asignaciones
│   │   │   ├── notifications/          # Notificaciones internas e integraciones
│   │   │   ├── rag/                    # Copiloto DECE, ChromaDB e Intent Guard
│   │   │   ├── reports/                # Generador de reportes PDF
│   │   │   ├── students/               # Padrón estudiantil y Perfil 360°
│   │   │   ├── superadmin/             # Gestión multi-institución SaaS
│   │   │   └── users/                  # Administración de personal y roles
│   │   └── shared/                     # Enums, permisos y excepciones de dominio
│   ├── scripts/                        # Semillas normativas (RGLOEI) y utilidades
│   └── tests/                          # Suite de pruebas unitarias e integración (Pytest)
└── school-alert-frontend/              # SPA en React 19 + TypeScript + Tailwind CSS 4
    └── src/
        ├── app/                        # Router principal y guardias de ruta
        ├── components/ui/              # Sistema de componentes base (Radix + Glass)
        ├── modules/                    # Módulos espejados con el dominio del backend
        └── shared/                     # Cliente HTTP Axios, PeriodContext y utilidades
```

---

<div align="center">
  <sub>Desarrollado con enfoque en excelencia técnica, trazabilidad normativa y prevención estudiantil · <b>SIDTRAC</b></sub>
</div>
