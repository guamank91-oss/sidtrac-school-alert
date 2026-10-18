# Guía de Inicialización Rápida — SIDTRAC

Este documento contiene los comandos exactos y las consideraciones necesarias para inicializar y ejecutar tanto el backend como el frontend en esta máquina Windows.

> [!IMPORTANT]
> **Nota sobre PowerShell en esta máquina:**
> PowerShell tiene deshabilitada la ejecución de scripts (`profile.ps1` y scripts `.ps1` como `npm`). Para evitar errores de permisos, se recomienda ejecutar los comandos de Node/NPM usando **Símbolo del sistema (CMD)**, o anteponer `cmd /c` si utilizas PowerShell.

---

## 1. Requisitos Previos

Asegúrate de que PostgreSQL esté activo en el puerto `5432` con la contraseña configurada en `school-alert-backend/.env`. Actualmente, la base de datos `sidtrac` ya está creada y configurada con la cadena de conexión:
`postgresql+asyncpg://postgres:tu_password@127.0.0.1:5432/sidtrac`

---

## 2. Inicializar y Ejecutar el Backend (FastAPI)

Abre una terminal en la carpeta `school-alert-backend/` y ejecuta:

### Paso A: Instalar Dependencias de Python
```bash
python -m pip install -r requirements.txt
```

### Paso B: Schema con Alembic (preferido)

Con la base `sidtrac` ya existente (tablas legacy):

```bash
alembic stamp 20260713_0001
alembic upgrade head
python scripts/seed_normativa_rgloei.py --no-chroma
```

En `.env` activa el módulo DECE para demo:
`FEATURE_DECE_CASES=true` y `FEATURE_ACTION_PLANS=true`.

`python manage.py initdb` queda como legado greenfield; preferir Alembic.

### Paso C: Crear un Usuario Administrador (Superusuario)
Para crear un administrador inicial para la demo:
```bash
python manage.py createsuperuser --email admin@sidtrac.edu --first-name Admin --last-name System --national-id 9999999999 --password admin123
```
*   **Username generado:** `sadmin` (o correlativo `sadmin2`, `sadmin3` si ya existían previos).
*   **Contraseña:** `admin123`
*   **Cédula (National ID):** `9999999999`

### Paso D: Iniciar el Servidor Backend
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
El backend estará disponible en: `http://127.0.0.1:8000` y la documentación interactiva en `http://127.0.0.1:8000/docs`.

---

## 3. Inicializar y Ejecutar el Frontend (React + Vite)

Abre una terminal en la carpeta `school-alert-frontend/` y ejecuta:

### Paso A: Instalar Dependencias de Node
*   Si estás usando **PowerShell**:
    ```powershell
    cmd /c npm install
    ```
*   Si estás usando **CMD**:
    ```cmd
    npm install
    ```

### Paso B: Iniciar el Servidor de Desarrollo
*   Si estás usando **PowerShell**:
    ```powershell
    cmd /c npm run dev
    ```
*   Si estás usando **CMD**:
    ```cmd
    npm run dev
    ```

El frontend estará disponible en: `http://localhost:5173`

---

## Resumen de Credenciales por Defecto (Demo)
*   **Usuario:** `sadmin` / **Contraseña:** `admin123` (Rol: Administrador / DECE)
