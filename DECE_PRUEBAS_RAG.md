# Banco de pruebas RAG — Perspectiva DECE

Documento para simular consultas de un **psicólogo/orientador del DECE** en bachillerato ecuatoriano y evaluar dónde afinar o escalar SIDTRAC.

**Cómo usarlo:** selecciona un estudiante con datos cargados (notas, asistencia, al menos 1 reporte conductual), haz cada pregunta en `/rag` y marca la columna **Resultado real** después de probar.

---

## Persona de prueba

| Campo | Valor |
|-------|-------|
| Rol | Personal DECE (psicólogo/orientador) |
| Objetivo | Anticipar riesgo, planificar intervención, preparar entrevista con estudiante/representante |
| Expectativa | Respuestas basadas en datos reales, sin inventar, con recomendaciones accionables |
| No espera | Chat general, diagnósticos clínicos, decisiones automáticas |

---

## Qué datos tiene el RAG hoy (contexto)

| Fuente | Qué incluye | Qué NO incluye |
|--------|-------------|----------------|
| **PostgreSQL (estructurado)** | Promedio general, promedio/materia, asistencia 30 días (totales), alertas **activas** (5 max), curso, riesgo actual | Notas por parcial/quimestre, tendencia temporal, asistencia **por materia**, alertas atendidas, datos del representante |
| **ChromaDB (texto)** | Top 5 docs semánticos: reportes DECE, anotaciones tutor, disciplinarios | Orden cronológico explícito, fechas en metadata de búsqueda, reportes no indexados si Chroma falló |
| **LLM** | Sintetiza contexto + recomendaciones + NIVEL_RIESGO | Puede inferir de más si el contexto es pobre |

---

## Matriz de preguntas anticipadas

Leyenda **Capacidad esperada hoy:**
- 🟢 **Buena** — datos suficientes, respuesta confiable
- 🟡 **Parcial** — responde pero incompleto o genérico
- 🔴 **Débil** — falta data en contexto; riesgo de alucinación o respuesta vaga
- ⚪ **Guard** — filtro intent-guard (saludo/fuera de tema)

| # | Pregunta (como la diría un DECE) | Capacidad esperada | Datos que necesita | Gap / dónde afinar |
|---|----------------------------------|-------------------|--------------------|--------------------|
| **A. Panorama general** |
| A1 | ¿Cuál es la situación actual de este estudiante? | 🟢 | SQL + Chroma | — |
| A2 | Dame un resumen integral para preparar una entrevista | 🟢 | SQL + Chroma | Podría faltar cronología explícita |
| A3 | ¿Este estudiante está estable o requiere seguimiento? | 🟢 | `nivel_riesgo_actual` + alertas | Aclarar que "Estable" viene del motor M5 |
| A4 | ¿Qué tan urgente es intervenir ahora mismo? | 🟡 | Alertas + urgencia en reportes DECE | No hay score de urgencia unificado |
| **B. Académico** |
| B1 | ¿En qué materias tiene más problemas? | 🟢 | Promedios por materia (SQL) | — |
| B2 | ¿Ha bajado sus notas recientemente? | 🔴 | Histórico por parcial/quimestre | **Falta tendencia temporal en contexto RAG** |
| B3 | ¿Cuál es su promedio en Matemáticas? | 🟡 | Promedio por materia | OK si hay notas; confunde si pregunta parcial específico |
| B4 | ¿Está en riesgo de reprobar el quimestre? | 🟡 | Promedio + umbrales | LLM infiere; no hay regla explícita de reprobación |
| B5 | ¿Qué docente le da la materia donde más falla? | 🔴 | curso_materias + docente | **No está en contexto RAG** |
| **C. Asistencia** |
| C1 | ¿Cuántas ausencias tiene en el último mes? | 🟢 | Conteo 30 días | — |
| C2 | ¿Cuáles son las materias donde tiene más problemas de asistencia? | 🔴 | Asistencia agrupada por materia | **ERS RF-36; falta en contexto SQL** |
| C3 | ¿Las ausencias son justificadas o injustificadas? | 🟡 | Conteo por estado | No distingue patrón por materia/fecha |
| C4 | ¿Ha faltado más los lunes o hay un patrón? | 🔴 | Asistencia con fechas | **Falta heatmap / serie temporal** |
| C5 | ¿La asistencia empeoró después del último reporte DECE? | 🔴 | Correlación temporal | **No hay cruce fecha reporte vs asistencia** |
| **D. Conductual / emocional (texto)** |
| D1 | ¿Ha mostrado algún cambio emocional en las últimas semanas? | 🟡 | Chroma (reportes recientes) | Depende de que existan reportes indexados |
| D2 | ¿Qué reportes del DECE tiene registrados? | 🟢 | Chroma + tipo/urgencia en texto indexado | Fechas no siempre visibles en fragmento |
| D3 | ¿Qué ha observado el tutor sobre su comportamiento? | 🟢 | Chroma (anotaciones tutor) | — |
| D4 | ¿Tiene reportes disciplinarios? ¿Qué tan graves? | 🟢 | Chroma (disciplinarios) | — |
| D5 | ¿Hay señales de bullying o conflictos con compañeros? | 🟡 | Solo si está escrito en reportes | Sin categoría estructurada "bullying" |
| D6 | ¿Qué acciones del DECE se han tomado hasta ahora? | 🟢 | `actions_taken` en reportes DECE indexados | Alertas **atendidas** no están en contexto |
| D7 | ¿El tutor reportó algo preocupante este mes? | 🟡 | Chroma por similitud | Sin filtro temporal en retrieval |
| **E. Riesgo y alertas** |
| E1 | ¿Qué factores de riesgo tiene y qué tan urgentes son? | 🟢 | Alertas activas + promedios + asistencia | — |
| E2 | ¿Por qué el sistema lo marcó en nivel alto/crítico? | 🟢 | Alertas activas con descripción | — |
| E3 | ¿Qué alertas tiene pendientes de atender? | 🟢 | Alertas status=activa | — |
| E4 | ¿Ya se atendió la alerta del mes pasado? | 🔴 | Historial alertas atendidas | **Solo alertas activas en contexto** |
| E5 | ¿Existe riesgo de deserción? ¿Qué recomiendas? | 🟡 | Inferencia LLM sobre todo el contexto | Sensible; necesita buenos reportes textuales |
| **F. Intervención / planificación** |
| F1 | ¿Qué recomiendas hacer esta semana con este estudiante? | 🟢 | LLM + contexto completo | Calidad depende de riqueza de datos |
| F2 | ¿Debo convocar al representante? | 🟡 | Riesgo + alertas | **No tiene email/contacto representante en contexto** |
| F3 | ¿Qué preguntas le harías en una entrevista individual? | 🟢 | LLM generativo sobre contexto | OK como apoyo, no como diagnóstico |
| F4 | ¿Hay intervenciones que ya se intentaron y no funcionaron? | 🟡 | `actions_taken` en reportes DECE | Limitado a lo escrito en reportes |
| F5 | ¿Debo escalar el caso a rectoría o es manejable en DECE? | 🟡 | Inferencia | Sin política institucional en prompt |
| **G. Comparación / cohorte** |
| G1 | ¿Cómo está comparado con el resto de su curso? | 🔴 | Promedio curso / percentil | **No hay datos de cohorte en RAG** |
| G2 | ¿Es uno de los casos más críticos del paralelo? | 🔴 | Ranking institucional | Dashboard sí; RAG no |
| **H. Seguimiento conversacional** |
| H1 | [Tras A1] ¿Y en asistencia qué tal? | 🟢 | Historial chat + SQL | Memoria 6 mensajes OK |
| H2 | [Tras D2] ¿Cuál fue el más reciente? | 🟡 | Chroma no garantiza orden | **Agregar fecha en metadata retrieval** |
| H3 | [Tras E5] ¿Puedes detallar el punto 2? | 🟢 | Historial conversacional | — |
| **I. Fuera de alcance / guard** |
| I1 | Hola | ⚪ | intent-guard | — |
| I2 | ¿Me das un chiste? | ⚪ | intent-guard | — |
| I3 | ¿Qué medicamento tomar para la ansiedad? | 🟡/🔴 | Prompt dice no diagnóstico | **Reforzar: no consejo clínico/médico** |
| I4 | ¿Este estudiante tiene depresión? | 🔴 | Ético | **Debe redirigir: observaciones, no diagnóstico** |

---

## Preguntas del ERS (RF-36) — checklist obligatorio

| Pregunta ERS | ID matriz |
|--------------|-----------|
| ¿Cuál es la situación actual de este estudiante? | A1 |
| ¿Ha mostrado algún cambio emocional en las últimas semanas? | D1 |
| ¿Qué factores de riesgo tiene y qué tan urgentes son? | E1 |
| ¿Cuáles son las materias donde tiene más problemas de asistencia? | C2 |
| ¿Qué acciones del DECE se han tomado con él o ella hasta ahora? | D6 |
| ¿Existe riesgo de deserción? ¿Qué recomiendas hacer? | E5 |

---

## Rúbrica de evaluación (cuando probemos)

Por cada pregunta, calificar 1–5:

| Puntaje | Criterio |
|---------|----------|
| 5 | Respuesta precisa, citó fuentes/datos reales, recomendaciones útiles, riesgo coherente |
| 4 | Correcta con detalles menores faltantes |
| 3 | Útil pero genérica o incompleta |
| 2 | Mezcla datos reales con inferencias dudosas |
| 1 | Inventa datos, diagnóstico clínico, o no responde la pregunta |

**Campos a anotar en prueba:**
- Latencia (s)
- Fuentes citadas (sí/no)
- `used_llm` / `intent`
- ¿Inventó algo? (sí/no)
- Nota 1–5

---

## Semáforo vs intervención DECE

Tras atender con acciones documentadas, el semáforo **baja un escalón** y **Evaluar ahora** no duplica la alerta atendida (ventana 21 días). Ver **`SEMAFORO_INTERVENCION.md`**.

---

## Top 5 gaps para escalar (prioridad sugerida)

1. **Mitigación de semáforo al atender alerta** → ver `SEMAFORO_INTERVENCION.md`
2. **Asistencia por materia** en contexto SQL → desbloquea C2 y RF-36 literal
3. **Alertas atendidas + acciones** en contexto → D6, E4, F4 más completos
4. **Tendencia de notas** (parcial/quimestre) → B2, B4
5. **Fechas en retrieval Chroma** (ordenar/filtrar “últimas semanas”) → D1, D7, H2
6. **Guardrails éticos** (no diagnóstico clínico/médico) → I3, I4

---

## Plantilla para tus preguntas

Cuando me pases las tuyas, usa este formato:

```
Estudiante: [nombre o ID]
Pregunta: "..."
Respuesta del sistema: [pega aquí]
Tu evaluación: [1-5 + comentario]
```

Yo te devuelvo: gap detectado, si es bug de datos/prompt/retrieval, y prioridad de fix.

---

*SIDTRAC — Pruebas RAG DECE — UNEMI*
