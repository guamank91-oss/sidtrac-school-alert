# Semáforo de riesgo e intervención DECE — Diseño de mitigación

Documento de **diseño funcional y técnico** para alinear el semáforo institucional (`estudiantes.nivel_riesgo_actual`) con el trabajo real del DECE cuando **ya se tomaron cartas en el asunto**.

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ **Implementado** (Jun 2026) — mitigación A+B + anti-duplicado de alertas |
| **Módulo** | M5 — Motor de Alertas Tempranas |
| **Autor** | Documentación de sesión SIDTRAC (Jun 2026) |
| **Relacionado** | `IMPLEMENTACION.md` (M5), `DECE_PRUEBAS_RAG.md`, `ers.md` RF-28–32 |

---

## 1. Qué documenta este archivo

Este documento **no describe solo lo que ya está en código**. Registra:

1. **El problema detectado** en pruebas con perspectiva DECE (caso Margarita Monroy).
2. **El comportamiento actual** del motor de riesgo y por qué genera fricción operativa.
3. **La solución acordada** (mitigación A + B) con reglas explícitas.
4. **Ejemplos de evolución** del semáforo en el tiempo.
5. **Puntos de cambio en backend** para cuando se implemente.
6. **Qué no cambia** (límites éticos, RAG, alertas archivadas).

Sirve como **referencia para desarrollo**, **defensa del proyecto** (por qué el semáforo no bajaba al atender) y **manual breve para el personal DECE** una vez implementado.

---

## 2. Problema: dos preguntas distintas

| Actor | Pregunta que hace |
|-------|-------------------|
| **Motor M5 (hoy)** | ¿Hay **señales de riesgo** en los últimos 30 días? (notas, ausencias, reportes DECE, tutor, disciplina) |
| **DECE (práctica)** | ¿El caso **sigue sin respuesta institucional** o ya hay **intervención en marcha**? |

Hoy el sistema responde bien la primera pregunta, pero **no distingue intervención activa**. Por eso un estudiante puede permanecer en **crítico** durante semanas aunque:

- la alerta fue **atendida** con acciones documentadas;
- se citó al representante;
- hay reportes DECE con plan de acción.

### Ejemplo real (demo): Margarita Monroy

**Indicadores en ventana de 30 días (evaluación actual):**

| Indicador | Detalle | ¿Extremo? |
|-----------|---------|-----------|
| DECE conductual/emocional | 2 reportes (observación conductual + alerta emocional con urgencia alta) | Sí |
| Tutor | 1 anotación de comportamiento | No |

**Matriz RF-30:** 2 indicadores activos + 1 extremo → **CRÍTICO**.

**Acciones ya tomadas (documentadas):**

- Alerta crítica **atendida**: *"se citó al representante"*.
- Reporte DECE: *"trabajos extracurriculares y taller de conciencia"*.
- Reporte DECE emocional: *"Entrevista inicial"*.

**Resultado actual:** el semáforo sigue en **crítico** hasta que esos reportes/anotaciones **salgan de la ventana de 30 días** y se ejecute una nueva evaluación — aunque el DECE ya intervino.

Eso es **coherente con el código actual**, pero **poco usable** para el orientador.

---

## 3. Comportamiento actual (referencia técnica)

### Quién escribe `nivel_riesgo_actual`

| Evento | ¿Actualiza semáforo? | ¿Puede bajar? |
|--------|----------------------|---------------|
| Evaluación diaria (`APScheduler`, hora en `configuracion_alertas`) | Sí, recalcula todos | Sí, si indicadores desaparecen |
| **Evaluar ahora** (`POST /alerts/evaluate`) | Sí | Sí, misma lógica |
| Crear reporte DECE (urgencia medio+) | Sí, puede **subir** | No baja |
| Alerta manual | Sí, puede **subir** | No baja |
| **Atender alerta** (`POST /alerts/{id}/attend`) | **No** | **No** |

### Ventana temporal

Todos los indicadores conductuales/emocionales usan **rolling 30 días** (`AlertEngine._evaluate_student` en `engine.py`).

### Matriz de clasificación (RF-30)

```
0 indicadores                          → bajo
1 indicador (no extremo)               → medio
2+ indicadores O 1 extremo             → alto
3+ indicadores O (2+ y ≥1 extremo)     → critico
```

### Implicación

**Atender una alerta archiva la alerta** (`status = atendida`, `acciones_tomadas`), pero **no modifica** el semáforo ni elimina indicadores. Por eso “Evaluar ahora” inmediatamente después de atender **no baja** el nivel si los reportes siguen en ventana.

---

## 4. Solución propuesta: mitigación A + B

Objetivo: reflejar **“caso intervenido, seguimiento activo”** sin ocultar el riesgo ni esperar 30 días calendario.

### Principios de diseño

1. **No borrar el riesgo de un golpe** — si hay señales recientes, el estudiante no pasa a *Estable* solo por atender.
2. **Bajar de forma gradual y trazable** — cada baja ligada a acciones documentadas o ausencia de empeoramiento.
3. **Auditoría** — registrar en log cuando la mitigación modifica el nivel calculado “en bruto”.
4. **Coherencia con RAG** — el chat lee `nivel_riesgo_actual`; al bajar el semáforo, el contexto SQL refleja el cambio.

---

### Mitigación A — Al atender alerta (respuesta inmediata)

**Disparador:** `AlertService.attend_alert` cuando:

- `actions_taken` tiene **≥ 5 caracteres** (misma validación que la UI);
- la alerta pasa a `atendida`.

**Acciones del sistema:**

1. Reevaluar **solo ese estudiante** (`AlertEngine.evaluate_student_single` o equivalente).
2. Obtener nivel **bruto** de la matriz RF-30.
3. Aplicar **reducción de un escalón** si hay intervención documentada:

| Nivel bruto | Nivel tras mitigación A | Piso |
|-------------|-------------------------|------|
| critico | alto | — |
| alto | medio | — |
| medio | medio | no baja |
| bajo | bajo | — |

4. **Piso adicional:** si aún hay **≥ 1 indicador activo**, el nivel **no puede ser bajo** (mínimo `medio`).

5. Persistir `student.current_risk_level` y registrar auditoría, p. ej.:
   - acción: `semaforo_mitigado_por_atencion`
   - detalle: nivel bruto → nivel final, `alert_id`, extracto de acciones.

**Efecto en Margarita (mismo día de atención):** crítico (bruto) → **alto** (mitigado).

---

### Mitigación B — Factor “intervención activa” (evaluación continua)

**Disparador:** cada evaluación (diaria, manual o post-atención).

**Condición “intervención activa”** (todas verdaderas):

| # | Condición |
|---|-----------|
| B1 | Existe al menos una alerta **`atendida`** en los últimos **21 días** con `acciones_tomadas` no vacío. |
| B2 | **No** hay alerta **`activa`** creada **después** de esa atención. |
| B3 | **No** hay reporte DECE nuevo con urgencia **`alto`** o **`critico`** **después** de esa atención. |

Si se cumple B1–B3:

1. Calcular nivel bruto con la matriz habitual.
2. Aplicar **una reducción de escalón** (misma tabla que A).
3. Aplicar el mismo **piso mínimo medio** si hay indicadores activos.
4. **Tope de reducción acumulada:** la mitigación B **no** puede dejar el nivel por debajo de **`medio`** mientras exista **cualquier** indicador conductual/emocional (DECE o tutor) en ventana de 30 días — aunque la intervención esté documentada.

**Efecto esperado en el tiempo (Margarita):**

| Momento | Nivel bruto | Tras A o B | Notas |
|---------|-------------|------------|-------|
| Reportes + tutor, sin atender | critico | critico | Sin mitigación |
| Alerta atendida con acciones | critico | **alto** | Mitigación A |
| +2 semanas, sin empeoramiento, intervención activa | critico o alto | **alto** o **medio** | Mitigación B |
| Reportes salen de ventana 30d, sin nuevos | bajo/medio | **bajo** | Motor natural |

---

## 5. Qué NO hace esta mitigación

| Situación | Comportamiento |
|-----------|----------------|
| Atender sin escribir acciones (o &lt; 5 caracteres) | Sin mitigación A |
| Nueva alerta activa tras atención | Mitigación B **desactivada** hasta nueva atención |
| Nuevo reporte DECE urgencia alta/crítica tras atención | Mitigación B **desactivada** |
| Diagnóstico clínico / cierre de caso por IA | **Fuera de alcance** — solo reglas institucionales |
| Sustituir criterio profesional | El DECE sigue registrando reportes y seguimientos |

---

## 6. Evolución opcional (fase 2): reporte DECE de seguimiento

No incluida en A+B, pero compatible:

- Reporte tipo **`seguimiento`** o **`plan_intervencion`** con urgencia **baja** y texto de evolución.
- Dispara reevaluación y puede **no contar** reportes DECE anteriores como “extremos” si el seguimiento indica mejoría (regla a definir con el plantel).

Documentado aquí como **Opción C** para una iteración posterior.

---

## 7. Flujo DECE (una vez implementado)

```
1. Sistema detecta riesgo → alerta activa + semáforo alto/crítico
2. DECE interviene → atiende alerta + acciones (citación, entrevista, etc.)
3. Semáforo baja un escalón el mismo día (A) — el caso sigue visible, no “Estable”
4. DECE registra seguimiento en reportes DECE según avance
5. Evaluación diaria / “Evaluar ahora” aplica B si no hubo empeoramiento
6. Con el tiempo, sin nuevos incidentes, el nivel baja por ventana 30d o por B
```

**Mensaje para el usuario DECE en UI (sugerido):**

> *“Al atender la alerta con acciones documentadas, el semáforo refleja que el caso está en intervención activa. El estudiante puede seguir en observación hasta que mejoren los indicadores.”*

---

## 8. Implementación técnica

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `app/modules/alerts/application/engine.py` | `apply_mitigation`, `_has_active_intervention`, `_should_create_alert`, `update_student_risk_level` |
| `app/modules/alerts/application/service.py` | Tras `attend_alert`, reevalúa semáforo + auditoría `semaforo_mitigado_por_atencion` |
| `app/modules/alerts/application/service.py` | `create_alert_from_behavioral` usa `_should_create_alert` |

### Anti-duplicado de alertas (bug corregido)

**Problema:** RF-31 solo evitaba alertas **activas** duplicadas. Al atender, la alerta pasaba a `atendida` y **Evaluar ahora** volvía a crear la misma alerta crítica.

**Regla nueva (`_should_create_alert`):** si en los últimos **21 días** hay alerta **atendida** con acciones documentadas (≥ 5 caracteres) al **mismo nivel o superior**, **no** se crea otra alerta automática salvo que el nivel bruto **suba** (empeoramiento).

### Script de verificación

```bash
python scripts/test_semaforo_mitigacion.py
```

Esperado (Margarita): tras atender → semáforo `alto`; segunda evaluación → `0` alertas nuevas.

---

## 9. Trazabilidad con otros documentos

| Documento | Relación |
|-----------|----------|
| `IMPLEMENTACION.md` | M5 — enlace a este diseño; ítem pendiente de implementación |
| `DECE_PRUEBAS_RAG.md` | Preguntas E1/A3 usan `nivel_riesgo_actual`; tras mitigación, validar coherencia chat ↔ semáforo |
| `RAG.md` | Contexto SQL incluye semáforo y acciones documentadas |
| `ers.md` RF-32 | Atender alerta — extiende semántica con mitigación de semáforo |

---

## 10. Resumen en una frase

**El semáforo seguirá detectando riesgo por datos, pero cuando el DECE atienda alertas y documente acciones, el sistema bajará el nivel de forma controlada para distinguir “emergencia sin respuesta” de “caso en intervención activa”, sin esperar 30 días.**

---

*SIDTRAC — Diseño semáforo e intervención DECE — UNEMI*
