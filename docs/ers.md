DOCUMENTO DE ESPECIFICACIÓN DE
REQUERIMIENTOS
Sistema Inteligente con Arquitectura RAG para Detección
Temprana de Riesgo Académico y Conductual en Estudiantes de
Bachillerato
Versión: 1.0
Fecha: Junio 2025
Institución: Universidad Estatal de Milagro – UNEMI
Carrera: Ingeniería de Software
Proyecto: Integración Curricular – Grupo 2
TABLA DE CONTENIDOS
1. Introducción y propósito del sistema
2. Alcance del sistema
3. Stakeholders y perfiles de usuario
4. Módulos del sistema
5. Requerimientos funcionales por módulo
6. Requerimientos no funcionales
7. Arquitectura tecnológica
8. Modelo de datos (entidades principales)
9. Flujos de trabajo principales
10. Descripción de pantallas (vistas)
11. Integraciones externas
12. Reglas de negocio
13. Restricciones y consideraciones éticas
14. Glosario
1. INTRODUCCIÓN Y PROPÓSITO DEL SISTEMA
1.1 Propósito
El presente documento describe de forma exhaustiva los requerimientos, características,
perfiles de usuario, módulos funcionales y restricciones del Sistema Inteligente de Detección
Temprana de Riesgo Académico y Conductual (SIDTRAC), un prototipo basado en
arquitectura RAG (Retrieval-Augmented Generation) diseñado para instituciones de
Bachillerato.
El sistema tiene como objetivo transformar el modelo de seguimiento estudiantil de una lógica
reactiva (actuar cuando el problema ya ocurrió) a una lógica preventiva (identificar señales de
riesgo antes de que escalen), integrando en una sola plataforma la información académica,
conductual y emocional de cada estudiante.
1.2 Problema que resuelve
Las instituciones educativas de Bachillerato acumulan grandes volúmenes de información
sobre sus estudiantes — calificaciones, registros de asistencia, reportes del DECE,
anotaciones de tutores, reportes disciplinarios — pero esta información vive fragmentada en
sistemas separados y no se cruza hasta que el estudiante ya se encuentra en una situación
crítica.
Las primeras señales de riesgo raramente aparecen en las notas: aparecen en las
observaciones textuales que los docentes y orientadores escriben semanas antes de que el
promedio baje. Los sistemas convencionales no pueden leer ni interpretar esta información
textual, lo que limita su capacidad de anticipación justo cuando más se necesita.
SIDTRAC resuelve este problema al:
- Reunir en un único sistema toda la información dispersa de cada estudiante.
- Permitir que el personal del DECE consulte en lenguaje natural el estado de cualquier
estudiante.
- Generar alertas tempranas automáticas con recomendaciones concretas de
intervención.
- Notificar a los actores correspondientes (DECE, tutores, representantes) mediante
correo electrónico automatizado.
1.3 Usuarios objetivo
El sistema está dirigido al personal del Departamento de Consejería Estudiantil (DECE), tutores
de curso, docentes, inspectores y la administración de instituciones de Bachillerato.
2. ALCANCE DEL SISTEMA
2.1 Lo que incluye el sistema
- Gestión de perfiles de estudiantes con información académica, conductual y familiar.
- Registro y visualización de calificaciones por materia, parcial y quimestre.
- Registro de asistencia diaria por materia y estudiante.
- Módulo de reportes del DECE: observaciones conductuales, entrevistas, planes de
intervención.
- Módulo de anotaciones de tutores y reportes disciplinarios.
- Motor de alertas tempranas automáticas basado en reglas configurables.
- Interfaz de consulta conversacional en lenguaje natural (RAG) para el equipo DECE.
- Dashboard centralizado con semáforo de riesgo institucional.
- Notificaciones por correo electrónico automáticas para alertas de nivel alto y crítico.
- Gestión de usuarios con roles diferenciados y control de acceso.
- Historial de consultas realizadas al sistema de IA para auditoría.
2.2 Lo que NO incluye el sistema
- Integración con sistemas del Ministerio de Educación del Ecuador.
- Módulo de gestión financiera o de matrículas.
- Comunicación en tiempo real (chat) entre usuarios del sistema.
- Aplicación móvil nativa.
- Generación de documentos PDF oficiales firmados digitalmente.
3. STAKEHOLDERS Y PERFILES DE USUARIO
El sistema define cinco perfiles con distintos niveles de acceso y capacidades. Cada perfil tiene
acceso exclusivo a las funciones que corresponden a su rol institucional.
Perfil 1: Administrador del Sistema
Descripción: Responsable técnico y operativo de la plataforma dentro de la institución.
Generalmente es el director TI o rector delegado.
Capacidades:
- Crear, editar, activar y desactivar cuentas de todos los usuarios del sistema.
- Configurar los parámetros de la institución (nombre, logo, correo institucional, periodo
lectivo activo).
- Gestionar los periodos lectivos, cursos y materias.
- Ver el historial completo de auditoría: quién accedió, qué consultó y cuándo.
- Configurar los umbrales de alerta automática (por ejemplo, cuántas ausencias activan
una alerta de nivel medio).
- Ver el panel de monitoreo de integraciones (estado de OpenRouter y Resend).
- Exportar datos del sistema en formato CSV o Excel.
- Acceder a todos los módulos sin restricción.
Restricciones: No puede modificar calificaciones ni registros académicos directamente; esos
son responsabilidad del docente.
Perfil 2: Personal DECE (Psicólogo/Orientador)
Descripción: Principal usuario operativo del sistema. Es quien realiza el seguimiento
psicopedagógico y usa el motor de consulta RAG con mayor frecuencia.
Capacidades:
- Ver el dashboard global de riesgo con semáforo institucional.
- Acceder al perfil integral de cualquier estudiante: calificaciones, asistencia, historial de
reportes y alertas activas.
- Registrar reportes de tipo: observación conductual, entrevista, seguimiento, alerta
emocional, derivación y plan de intervención.
- Usar la interfaz de consulta en lenguaje natural (chat RAG) para analizar la situación de
un estudiante específico.
- Atender (marcar como gestionada) una alerta activa y registrar las acciones tomadas.
- Ver las notificaciones enviadas a representantes y su estado de entrega.
- Filtrar y buscar alertas por nivel, curso, periodo o tipo.
Restricciones: No puede crear ni modificar cuentas de usuarios. No puede alterar
calificaciones ni asistencia.
Perfil 3: Tutor de Curso
Descripción: Docente asignado como responsable de acompañamiento del grupo. Tiene
visibilidad sobre todos los estudiantes de su curso.
Capacidades:
- Ver el listado de estudiantes de su curso con indicadores de riesgo actualizados.
- Registrar anotaciones sobre estudiantes de su curso (comportamiento, rendimiento,
situación emocional, familiar u otra).
- Ver el perfil básico de cada estudiante de su curso: calificaciones, asistencia y alertas
activas.
- Recibir notificaciones internas del sistema cuando una alerta se activa para un
estudiante de su curso.
- Ver los reportes DECE de sus estudiantes (solo lectura).
Restricciones: No tiene acceso al módulo de consulta RAG ni al dashboard global. Solo ve a
los estudiantes de su propio curso.
Perfil 4: Docente
Descripción: Responsable de registrar calificaciones y asistencia por materia.
Capacidades:
- Registrar y editar calificaciones de sus materias asignadas, organizadas por estudiante,
parcial y quimestre.
- Registrar asistencia diaria (presente, ausente, tardanza, justificado) de los estudiantes
de sus cursos.
- Ver el listado de estudiantes por materia y curso.
- Agregar observaciones breves al registrar una ausencia o calificación baja.
Restricciones: Solo ve a los estudiantes de las materias que le han sido asignadas. No
accede a reportes DECE, alertas ni perfil conductual de los estudiantes.
Perfil 5: Inspector / Disciplina
Descripción: Encargado de registrar y gestionar las faltas disciplinarias.
Capacidades:
- Registrar reportes disciplinarios para cualquier estudiante: tipo de falta (leve, grave, muy
grave), descripción detallada y sanción aplicada.
- Ver el historial disciplinario de cualquier estudiante.
- Ver las alertas activas que involucran indicadores conductuales.
- Recibir notificaciones cuando el sistema genera una alerta con componente
disciplinario.
Restricciones: No accede a calificaciones, asistencia ni reportes DECE. No puede gestionar
cuentas de usuario.
Resumen de accesos por perfil
Módulo /
Función
Admin DECE Tutor Docente Inspector
Dashboard
global de
riesgo
✓ ✓ — — —
Perfil integral
del
estudiante
✓ ✓ Parcial — —
Calificaciones
(registro)
— — — ✓ —
Asistencia
(registro)
— — — ✓ —
Reportes
DECE
✓ ✓ Solo lectura — —
Anotaciones
de tutor
✓ ✓ ✓ — —
Reportes
disciplinarios
✓ ✓ — — ✓
Alertas
tempranas
✓ ✓ Solo lectura — Solo
conductuales
Consulta
RAG (chat
IA)
✓ ✓ — — —
Gestión de
usuarios
✓ — — — —
Configuración
del sistema
✓ — — — —
Auditoría y
logs
✓ — — — —
4. MÓDULOS DEL SISTEMA
El sistema está organizado en ocho módulos principales:
M1 – Gestión de Institución y Configuración
M2 – Gestión de Usuarios y Accesos
M3 – Gestión Académica (Calificaciones y Asistencia)
M4 – Seguimiento Conductual y DECE
M5 – Motor de Alertas Tempranas
M6 – Consulta RAG (Inteligencia Artificial)
M7 – Notificaciones por Correo Electrónico
M8 – Reportes y Auditoría
5. REQUERIMIENTOS FUNCIONALES POR MÓDULO
M1 – Gestión de Institución y Configuración
RF-01 El sistema permite registrar los datos generales de la institución: nombre, código,
dirección, teléfono y correo institucional.
RF-02 El administrador puede crear y gestionar periodos lectivos con nombre, fecha de inicio y
fecha de fin. Solo puede existir un periodo activo a la vez.
RF-03 El sistema permite registrar cursos organizados por nivel (1ro, 2do, 3ro de Bachillerato) y
paralelo (A, B, C, etc.), asociados a un periodo lectivo.
RF-04 El administrador puede registrar materias con nombre, código y cantidad de horas
semanales, y asignarlas a cursos específicos con el docente responsable.
RF-05 El administrador puede configurar los umbrales numéricos que activan las alertas
automáticas: número de ausencias por periodo de tiempo, promedio mínimo por materia,
número de faltas disciplinarias graves, entre otros.
RF-06 El sistema permite definir el correo electrónico que aparecerá como remitente en las
notificaciones enviadas a representantes y personal.
M2 – Gestión de Usuarios y Accesos
RF-07 El administrador puede crear cuentas de usuario con los campos: nombres, apellidos,
cédula, correo electrónico, contraseña temporal y rol asignado.
RF-08 El sistema implementa autenticación mediante correo electrónico y contraseña. Las
contraseñas se almacenan cifradas con un algoritmo de hashing seguro (bcrypt).
RF-09 El acceso a cada módulo y funcionalidad está controlado por el rol del usuario. Un
usuario con sesión activa no puede acceder a módulos que su rol no contempla.
RF-10 El sistema genera un token de sesión con tiempo de expiración configurable (por defecto
8 horas). Transcurrido ese tiempo, el usuario debe volver a autenticarse.
RF-11 El administrador puede activar o desactivar una cuenta sin eliminarla. Una cuenta
desactivada no puede iniciar sesión.
RF-12 El sistema registra en un log de auditoría cada inicio de sesión, cierre de sesión y acción
relevante (crear reporte, atender alerta, realizar consulta RAG), con fecha, hora y usuario
responsable.
RF-13 El usuario puede cambiar su propia contraseña desde su perfil. El administrador puede
restablecer la contraseña de cualquier usuario.
M3 – Gestión Académica (Calificaciones y Asistencia)
RF-14 El docente puede registrar calificaciones para cada estudiante de sus materias
asignadas, organizadas por quimestre (1° o 2°) y parcial (1°, 2° o 3°). El rango de notas válido
es de 0.00 a 10.00.
RF-15 El sistema calcula automáticamente la nota promedio por materia y el promedio general
del estudiante en el periodo activo, actualizándose cada vez que se registra o modifica una
calificación.
RF-16 El docente puede editar calificaciones ya registradas dentro del parcial activo. Las
calificaciones de parciales cerrados solo pueden ser modificadas por el administrador con
justificación registrada.
RF-17 El docente registra la asistencia diaria por materia para cada estudiante, seleccionando
el estado: presente, ausente, tardanza o justificado. Puede agregar una observación opcional.
RF-18 El sistema acumula y calcula automáticamente el porcentaje de inasistencias de cada
estudiante por materia y de forma general, con filtro por rango de fechas.
RF-19 El sistema genera una vista resumen de asistencia que muestra el historial cronológico
del estudiante por materia, diferenciando visualmente los estados con colores.
RF-20 El sistema permite al docente registrar ausencias de forma masiva para un grupo
completo, marcando como ausentes a todos y permitiendo excepciones individuales.
M4 – Seguimiento Conductual y DECE
RF-21 El personal del DECE puede registrar reportes con los siguientes tipos:
- Observación conductual: descripción libre de comportamientos observados en el
entorno escolar.
- Entrevista: resumen de una entrevista con el estudiante o el representante.
- Seguimiento: actualización de un caso en proceso.
- Alerta emocional: registro de señales de angustia, tristeza, aislamiento u otras.
- Derivación: referencia a un especialista externo o institución de apoyo.
- Plan de intervención: descripción detallada del plan de acompañamiento establecido.
RF-22 Cada reporte DECE incluye: fecha, tipo, descripción en texto libre, acciones tomadas,
nivel de urgencia (bajo, medio, alto, crítico) y si requiere seguimiento.
RF-23 El tutor de curso puede registrar anotaciones sobre sus estudiantes con los tipos:
comportamiento, rendimiento, emocional, familiar u otro. El campo de descripción es texto libre.
RF-24 El inspector puede registrar reportes disciplinarios con: tipo de falta (leve, grave, muy
grave), descripción detallada y sanción aplicada.
RF-25 Todos los documentos en texto libre (reportes DECE, anotaciones de tutores, reportes
disciplinarios) son indexados automáticamente en la base de datos vectorial ChromaDB en el
momento del registro, lo que los hace disponibles para la consulta RAG.
RF-26 El sistema muestra en el perfil integral de cada estudiante un historial cronológico
completo de todos sus reportes DECE, anotaciones de tutores y reportes disciplinarios,
ordenados del más reciente al más antiguo.
RF-27 El personal del DECE puede filtrar los reportes de un estudiante por tipo, fecha y nivel
de urgencia.
M5 – Motor de Alertas Tempranas
RF-28 El sistema evalúa automáticamente a todos los estudiantes activos una vez por día
(configurado por defecto a las 23:00). En cada evaluación se calculan los indicadores de riesgo
de cada estudiante.
RF-29 Los indicadores evaluados son:
- Indicador académico: promedio general por debajo del umbral configurado (por
defecto 5.5/10).
- Indicador de ausencias: número de ausencias injustificadas en los últimos 30 días
supera el umbral configurado (por defecto 5 ausencias = riesgo medio, 10 = riesgo alto).
- Indicador disciplinario: número de faltas graves en el mes supera el umbral
configurado.
- Indicador combinado: confluencia de dos o más indicadores activos en el mismo
estudiante.
RF-30 El nivel de riesgo se califica en cuatro categorías con su semaforización visual
correspondiente:
Nivel Color Criterio general
Bajo Verde Indicadores dentro de
parámetros normales
Medio Amarillo Un indicador por encima del
umbral mínimo
Alto Rojo Dos indicadores por encima
del umbral, o uno en nivel
crítico
Crítico Morado Múltiples indicadores
simultáneos con valores
extremos o riesgo inminente
de deserción
RF-31 El sistema genera una alerta por estudiante cuando el nivel calculado es medio, alto o
crítico. No se generan alertas duplicadas si ya existe una alerta activa no atendida del mismo
nivel para el mismo estudiante en los últimos 7 días.
RF-32 El personal del DECE puede atender (gestionar) una alerta, registrando las acciones
realizadas. Una alerta atendida se archiva y no aparece en el listado de alertas activas.
RF-33 El administrador puede ajustar los umbrales de cada indicador desde el módulo de
configuración sin necesidad de modificar el sistema.
RF-34 El sistema permite generar una alerta de forma manual desde el perfil de un estudiante,
seleccionando el tipo y nivel, para casos que el sistema no detectó automáticamente.
M6 – Consulta RAG (Inteligencia Artificial)
RF-35 El sistema ofrece una interfaz de consulta conversacional en lenguaje natural, disponible
para el perfil DECE y el administrador. El usuario selecciona un estudiante y escribe su
pregunta en español.
RF-36 Ejemplos de preguntas que el sistema puede responder:
- "¿Cuál es la situación actual de este estudiante?"
- "¿Ha mostrado algún cambio emocional en las últimas semanas?"
- "¿Qué factores de riesgo tiene este estudiante y qué tan urgentes son?"
- "¿Cuáles son las materias donde tiene más problemas de asistencia?"
- "¿Qué acciones del DECE se han tomado con él o ella hasta ahora?"
- "¿Existe riesgo de deserción? ¿Qué recomiendas hacer?"
RF-37 Para generar cada respuesta, el sistema ejecuta el siguiente proceso de forma
automática e invisible para el usuario:
1. Recupera los datos estructurados del estudiante desde la base de datos relacional
(calificaciones, asistencia, alertas activas).
2. Realiza una búsqueda semántica en ChromaDB para recuperar los documentos
textuales más relevantes a la pregunta (reportes DECE, anotaciones de tutores,
reportes disciplinarios).
3. Construye un contexto enriquecido combinando los datos estructurados y los
documentos recuperados.
4. Envía ese contexto junto con la pregunta al modelo de lenguaje a través de
OpenRouter.
5. Presenta la respuesta generada al usuario en la interfaz de chat.
RF-38 Cada respuesta del sistema incluye al final una sección de Recomendaciones de
Intervención con pasos concretos y accionables para el equipo DECE.
RF-39 El sistema asigna un nivel de riesgo textual en cada respuesta (Bajo / Medio / Alto /
Crítico) basado en el análisis integral realizado por el modelo de lenguaje.
RF-40 El sistema registra cada consulta RAG realizada con: usuario, estudiante consultado,
pregunta formulada, respuesta generada, modelo utilizado y latencia de la respuesta. Este
historial es visible solo para el administrador.
RF-41 El historial de conversación se mantiene dentro de la sesión del usuario. Al cambiar de
estudiante o cerrar sesión, el historial se limpia.
M7 – Notificaciones por Correo Electrónico
RF-42 Cuando el motor de alertas genera o actualiza una alerta de nivel alto o crítico, el
sistema envía automáticamente un correo electrónico de notificación a:
- El correo del representante legal del estudiante (si está registrado).
- Todos los usuarios con perfil DECE activos en el sistema.
RF-43 El correo de notificación contiene: nombre completo del estudiante, curso, nivel de
riesgo con indicación visual, descripción de los indicadores que activaron la alerta y las
recomendaciones de intervención generadas por el sistema.
RF-44 El sistema registra el resultado de cada envío de correo: destinatario, asunto, fecha de
envío, estado (enviado / error) e identificador del mensaje devuelto por Resend para
trazabilidad.
RF-45 Si el envío de un correo falla, el sistema registra el error y lo marca como pendiente de
reenvío. El administrador puede consultar los correos fallidos y reenviarlos manualmente desde
el panel de administración.
RF-46 Para alertas de nivel medio, el sistema genera solo una notificación interna dentro de la
plataforma (no envía correo electrónico al representante). El personal DECE y el tutor del curso
reciben una alerta interna visible en su panel.
RF-47 El sistema permite al administrador enviar un correo de prueba desde el panel de
configuración para verificar que la integración con Resend está funcionando correctamente.
M8 – Reportes y Auditoría
RF-48 El sistema genera un Reporte de Situación de Riesgo Institucional que muestra el
número total de estudiantes por nivel de riesgo (crítico, alto, medio, bajo) en el periodo activo,
con comparativa respecto al mes anterior.
RF-49 El sistema genera un Reporte Individual de Estudiante que consolida en una sola
vista: datos personales, calificaciones por materia, porcentaje de asistencia, historial de
reportes DECE, historial de anotaciones del tutor, reportes disciplinarios y alertas generadas.
RF-50 El administrador puede exportar cualquier reporte en formato CSV para análisis externo
en hojas de cálculo.
RF-51 El sistema mantiene un Log de Auditoría que registra las acciones clave: inicios de
sesión, creación de reportes, modificación de calificaciones, atención de alertas, consultas RAG
realizadas y cambios de configuración. Cada registro incluye usuario, acción, fecha, hora e IP
de acceso.
RF-52 El sistema muestra métricas de uso del motor RAG: número de consultas por día,
promedio de latencia, modelos más utilizados y distribución de consultas por perfil.
6. REQUERIMIENTOS NO FUNCIONALES
6.1 Rendimiento
RNF-01 El tiempo de respuesta de cualquier pantalla del sistema (carga de listas, perfiles,
reportes) no debe superar los 3 segundos en condiciones normales de uso.
RNF-02 El tiempo de respuesta del motor de consulta RAG (desde que el usuario envía la
pregunta hasta que recibe la respuesta completa) debe ser inferior a 8 segundos en el 90% de
los casos.
RNF-03 El sistema debe soportar hasta 30 usuarios concurrentes sin degradación perceptible
del rendimiento.
RNF-04 La indexación de un nuevo documento en ChromaDB (tras registrar un reporte DECE,
anotación o reporte disciplinario) debe completarse de forma automática en segundo plano sin
afectar la experiencia del usuario.
6.2 Seguridad
RNF-05 Todas las comunicaciones entre el navegador del usuario y el servidor deben
realizarse sobre HTTPS (certificado SSL/TLS obligatorio en producción).
RNF-06 Las contraseñas de los usuarios se almacenan únicamente en forma de hash bcrypt.
El sistema no almacena ni registra contraseñas en texto plano en ningún punto.
RNF-07 El sistema implementa protección contra ataques de fuerza bruta en el endpoint de
autenticación: bloqueo temporal de la cuenta tras 5 intentos fallidos consecutivos en un periodo
de 10 minutos.
RNF-08 Todos los datos de los estudiantes (calificaciones, reportes DECE, alertas) se
procesan y almacenan exclusivamente dentro del servidor de la institución. Ningún dato
personal de menores de edad sale de la infraestructura institucional, excepto las notificaciones
de alerta enviadas al representante legal del propio estudiante.
RNF-09 El modelo de lenguaje se accede a través de OpenRouter, que actúa como proxy sin
retención de datos. El texto enviado al modelo contiene el contexto del estudiante solo durante
el procesamiento de la consulta; no se retiene en ninguna base de datos externa.
RNF-10 El sistema implementa validación de entradas en todos los formularios para prevenir
inyección de SQL y otros ataques comunes (XSS, CSRF).
6.3 Usabilidad
RNF-11 La interfaz debe ser utilizable sin capacitación técnica previa por parte del personal
DECE, tutores e inspectores. Los flujos principales (registrar reporte, consultar estudiante,
atender alerta) no deben requerir más de 3 clics desde el menú principal.
RNF-12 La interfaz debe ser responsiva y funcional en resoluciones de pantalla desde 1280 ×
720 píxeles (laptops de uso institucional) hasta 1920 × 1080 píxeles.
RNF-13 El sistema debe ser compatible con los navegadores Chrome (versión 110+) y Firefox
(versión 110+). No se requiere compatibilidad con Internet Explorer.
RNF-14 El semáforo de riesgo (verde, amarillo, rojo, morado) debe ser consistente en todas las
pantallas donde aparezca. Los colores deben acompañarse siempre de etiquetas textuales
para accesibilidad (bajo, medio, alto, crítico).
6.4 Disponibilidad y mantenimiento
RNF-15 El sistema debe tener una disponibilidad mínima del 95% durante el horario escolar
(7:00 a 18:00, días hábiles).
RNF-16 La base de datos PostgreSQL debe contar con respaldos automáticos diarios. El
administrador puede descargar un respaldo desde el panel de administración.
RNF-17 El sistema debe registrar errores internos en un archivo de log del servidor con nivel de
detalle suficiente para diagnóstico, sin exponer información sensible en la interfaz del usuario.
6.5 Escalabilidad
RNF-18 La arquitectura debe permitir agregar nuevas instituciones al sistema en el futuro sin
modificaciones estructurales en el código o la base de datos, utilizando el campo
institucion_id presente en todas las entidades principales.
7. ARQUITECTURA TECNOLÓGICA
El sistema adopta una arquitectura de tres capas: presentación, lógica de negocio y
persistencia. No requiere Docker ni contenedores para su funcionamiento; puede instalarse
directamente sobre el sistema operativo del servidor.
7.1 Capa de Presentación – Frontend
Tecnología: React 18 con Vite como bundler
Estilos: Tailwind CSS
Gráficas: Recharts (para barras, líneas y tendencias)
Comunicación con backend: Axios (peticiones HTTP/REST)
Gestión de estado: React Hooks (useState, useEffect, useContext)
El frontend es una SPA (Single Page Application) que se sirve como archivos estáticos. No
requiere servidor de Node.js en producción; los archivos compilados pueden servirse desde
cualquier servidor web (Nginx, Apache).
7.2 Capa de Lógica de Negocio – Backend
Tecnología: FastAPI (Python 3.11)
ORM: SQLAlchemy asíncrono con driver asyncpg
Autenticación: JSON Web Tokens (JWT)
Tareas programadas: APScheduler (motor de alertas automáticas)
Servidor: Uvicorn (servidor ASGI)
El backend expone una API REST con los siguientes grupos de endpoints: autenticación,
estudiantes, calificaciones, asistencia, reportes, alertas, consulta RAG, notificaciones y
administración.
7.3 Capa de Persistencia
Base de datos relacional: PostgreSQL 16
Almacena todos los datos estructurados: perfiles, calificaciones, asistencia, reportes, alertas,
usuarios y logs de auditoría.
Base de datos vectorial: ChromaDB
Almacena los embeddings (representaciones vectoriales) de todos los documentos textuales
(reportes DECE, anotaciones, reportes disciplinarios) para habilitar la búsqueda semántica del
motor RAG.
7.4 Integraciones externas
OpenRouter: Plataforma de acceso a modelos de lenguaje (LLM). Se utiliza para dos
funciones: generación de embeddings (convertir texto en vectores para ChromaDB) y
generación de respuestas conversacionales (motor RAG).
Resend: Servicio de envío de correos electrónicos transaccionales. Se utiliza exclusivamente
para las notificaciones de alertas de riesgo alto y crítico.
8. MODELO DE DATOS (ENTIDADES PRINCIPALES)
A continuación se describen las entidades principales del sistema y sus atributos relevantes. No
se incluye código SQL; se describe el modelo a nivel conceptual.
Institución
Entidad raíz del sistema. Contiene el nombre, código, dirección, teléfono y correo institucional.
Todas las demás entidades están asociadas a una institución mediante un identificador.
Periodo Lectivo
Representa un año escolar (ej. 2024-2025). Tiene fecha de inicio, fecha de fin y un estado que
indica si está activo. Solo puede existir un periodo activo por institución al mismo tiempo.
Curso
Representa un grupo de estudiantes (ej. 1ro Bachillerato A). Está asociado a un nivel, un
paralelo y un periodo lectivo. Un curso puede tener asignado un tutor.
Materia
Representa una asignatura. Tiene nombre, código y número de horas semanales. Se asigna a
cursos específicos junto con el docente responsable.
Usuario
Representa a cualquier persona con acceso al sistema. Contiene nombres, apellidos, cédula,
correo electrónico, hash de contraseña, rol y estado (activo/inactivo). El rol determina
completamente los permisos del usuario.
Estudiante
Contiene el perfil completo del estudiante: nombres, apellidos, cédula, fecha de nacimiento,
género, nombre del representante legal, teléfono y correo del representante, y el curso al que
está asignado.
Calificación
Registra la nota de un estudiante en una materia específica, para un quimestre y parcial
determinado. Incluye la nota del parcial, la nota del examen supletorio si aplica, y la nota final
calculada. Está asociada al docente que la registró.
Asistencia
Registra el estado de presencia de un estudiante en una materia en una fecha específica. Los
estados posibles son: presente, ausente, tardanza y justificado. Puede incluir una observación
opcional.
Reporte DECE
Documento de texto libre registrado por el personal del DECE. Incluye tipo de reporte, fecha,
descripción narrativa, acciones tomadas, nivel de urgencia y si requiere seguimiento activo.
Este texto se indexa en ChromaDB.
Anotación de Tutor
Documento de texto libre registrado por el tutor de curso. Incluye tipo (comportamiento,
rendimiento, emocional, familiar, otro), fecha y descripción narrativa. Este texto se indexa en
ChromaDB.
Reporte Disciplinario
Documento registrado por el inspector. Incluye tipo de falta, fecha, descripción del incidente y
sanción aplicada. Este texto se indexa en ChromaDB.
Alerta
Registra una alerta generada por el sistema o manualmente. Incluye el tipo de riesgo
(académico, conductual, emocional, deserción, combinado), el nivel (bajo, medio, alto, crítico),
la descripción detallada, las recomendaciones de intervención, si fue atendida, quién la atendió
y cuándo, y si se envió notificación por correo.
Notificación de Email
Registra cada correo electrónico enviado mediante Resend. Incluye la alerta que lo originó, el
destinatario, el asunto, el estado del envío (enviado / error), el identificador del mensaje
devuelto por Resend y cualquier detalle de error.
Consulta RAG
Registra cada consulta realizada al motor de inteligencia artificial. Incluye el usuario que
consultó, el estudiante sobre el que se consultó, la pregunta formulada, el contexto recuperado
de ChromaDB, la respuesta generada, el modelo de lenguaje utilizado, los tokens consumidos
y la latencia en milisegundos.
9. FLUJOS DE TRABAJO PRINCIPALES
Flujo 1: Registro de un Reporte DECE
1. El psicólogo accede al perfil del estudiante desde el buscador o el listado de alertas.
2. Selecciona la pestaña "Reportes DECE" dentro del perfil del estudiante.
3. Hace clic en "Nuevo Reporte".
4. Selecciona el tipo de reporte (observación conductual, entrevista, etc.).
5. Completa la descripción en texto libre y las acciones tomadas.
6. Define el nivel de urgencia y si requiere seguimiento.
7. Guarda el reporte.
8. El sistema lo almacena en PostgreSQL e inmediatamente lo indexa en ChromaDB en
segundo plano.
9. Si el nivel de urgencia es alto o crítico, el sistema genera automáticamente una alerta
vinculada a este reporte.
Flujo 2: Consulta RAG
1. El psicólogo accede al módulo "Consulta Inteligente".
2. Selecciona al estudiante sobre el que quiere consultar desde un buscador con
autocompletado.
3. Escribe su pregunta en lenguaje natural en el campo de texto.
4. Hace clic en "Enviar" o presiona Enter.
5. El sistema muestra un indicador de procesamiento mientras el motor RAG trabaja.
6. El sistema presenta la respuesta generada, incluyendo el análisis integral y las
recomendaciones de intervención.
7. El psicólogo puede seguir haciendo preguntas dentro de la misma sesión.
8. La consulta queda registrada en el log de auditoría.
Flujo 3: Generación y Atención de una Alerta
1. A las 23:00 el motor de alertas evalúa a todos los estudiantes activos.
2. Para un estudiante con promedio de 3.8 y 12 ausencias en el mes, el sistema calcula
nivel "Crítico".
3. El sistema genera la alerta con descripción detallada y recomendaciones.
4. Simultáneamente, el sistema envía un correo electrónico al representante y al equipo
DECE vía Resend.
5. Al día siguiente, el psicólogo ve la alerta crítica en el dashboard con semáforo morado.
6. Abre el perfil del estudiante y revisa el historial completo.
7. Realiza una consulta RAG: "¿Cuál es la situación de este estudiante y qué debo hacer
primero?"
8. Con la información, programa una entrevista y registra un reporte de tipo Plan de
Intervención.
9. Marca la alerta como "Atendida" y registra las acciones realizadas.
Flujo 4: Registro de Calificaciones y Asistencia (Docente)
1. El docente accede al módulo "Mis Materias".
2. Selecciona la materia y el curso.
3. Para calificaciones: selecciona el quimestre y parcial, e ingresa la nota de cada
estudiante en la lista.
4. Para asistencia: selecciona la fecha y marca el estado de cada estudiante. Puede usar
la opción "Marcar todos como presentes" y luego cambiar los ausentes individualmente.
5. Guarda el registro. El sistema actualiza automáticamente los promedios de cada
estudiante.
6. Si algún promedio actualizado cruza un umbral de alerta, el motor lo detectará en la
próxima evaluación nocturna.
10. DESCRIPCIÓN DE PANTALLAS (VISTAS)
Pantalla: Login
Campo de correo electrónico y contraseña. Botón de ingresar. Enlace "¿Olvidé mi contraseña?"
que envía un correo de restablecimiento. No hay opción de registro público; las cuentas solo las
crea el administrador.
Pantalla: Dashboard Principal (DECE / Admin)
Panel con indicadores clave en la parte superior: total de alertas críticas activas, total de alertas
altas activas, total de estudiantes con riesgo medio, porcentaje de estudiantes en nivel bajo (sin
riesgo). Debajo, gráfico de distribución de riesgo por nivel. A la derecha, listado de las alertas
activas más recientes con semáforo, nombre del estudiante, curso y botón de acción directa.
En la parte inferior, accesos rápidos a las funciones más usadas.
Pantalla: Listado de Estudiantes
Tabla con todos los estudiantes activos. Columnas: nombre, curso, promedio general,
ausencias en 30 días, nivel de riesgo actual (semáforo). Filtros por curso, nivel de riesgo y
periodo lectivo. Barra de búsqueda por nombre o cédula. Clic en cualquier fila lleva al perfil
integral del estudiante.
Pantalla: Perfil Integral del Estudiante
Vista organizada en pestañas:
- Resumen: foto (si existe), datos personales, representante, nivel de riesgo actual.
- Calificaciones: tabla con notas por materia, quimestre y parcial. Gráfico de línea
mostrando la tendencia del promedio en el tiempo.
- Asistencia: calendario de calor (heatmap) mostrando presencias, ausencias y
tardanzas en los últimos 60 días. Contador de ausencias por materia.
- Reportes DECE: historial cronológico de todos los reportes. Botón para agregar nuevo
reporte.
- Anotaciones del Tutor: historial de anotaciones.
- Reportes Disciplinarios: historial de faltas e infracciones.
- Alertas: historial de alertas generadas (activas y atendidas).
- Consulta RAG: acceso directo al chat de inteligencia artificial con ese estudiante
preseleccionado.
Pantalla: Módulo de Alertas
Listado completo de alertas activas ordenadas por nivel de urgencia (críticas primero).
Columnas: semáforo, estudiante, curso, tipo de alerta, fecha de generación, si se envió correo.
Filtros por nivel, curso, fecha y estado. Clic en una alerta muestra el detalle completo:
descripción, recomendaciones, historial de notificaciones enviadas. Botón para atender la alerta
y registrar acciones.
Pantalla: Consulta RAG (Chat Inteligente)
Panel dividido en dos columnas. Columna izquierda: buscador de estudiante con
autocompletado. Al seleccionar, muestra un mini-resumen del estudiante (promedio, ausencias,
nivel de riesgo actual). Columna derecha: interfaz de chat con historial de mensajes, campo de
entrada de texto y botón enviar. Las respuestas del sistema se muestran con formato legible,
separando el análisis de las recomendaciones de intervención.
Pantalla: Registro de Calificaciones (Docente)
Selector de materia, curso, quimestre y parcial. Tabla editable con todos los estudiantes del
curso en las filas y el campo de nota como celda editable. Botón "Guardar todo" al final.
Indicación visual si alguna nota está por debajo del umbral de riesgo.
Pantalla: Registro de Asistencia (Docente)
Selector de materia, curso y fecha. Tabla con todos los estudiantes del curso. Para cada
estudiante, botones de radio para seleccionar el estado: presente, ausente, tardanza,
justificado. Campo de observación opcional al marcar ausente. Botón de guardado masivo.
Pantalla: Panel de Administración
Submenús: Gestión de Usuarios, Configuración de la Institución, Periodos Lectivos, Cursos y
Materias, Umbrales de Alerta, Log de Auditoría, Respaldos de Base de Datos, Configuración de
Email (test de Resend), Métricas del Motor RAG.
11. INTEGRACIONES EXTERNAS
11.1 OpenRouter
Propósito: Acceso al modelo de lenguaje para el motor RAG.
Funciones que utiliza el sistema:
- Embeddings: Conversión de textos a vectores numéricos para su almacenamiento en
ChromaDB. Se ejecuta cada vez que se registra un nuevo documento textual (reporte
DECE, anotación, reporte disciplinario) y cada vez que el usuario envía una pregunta al
chat RAG.
- Generación de texto: El modelo recibe el contexto enriquecido (datos del estudiante +
documentos relevantes) y genera la respuesta para el personal DECE.
Modelo utilizado para generación: meta-llama/llama-3.1-8b-instruct
Modelo utilizado para embeddings: openai/text-embedding-3-small
Consideraciones de privacidad: El texto enviado a OpenRouter contiene información del
estudiante únicamente durante el procesamiento de la consulta. OpenRouter actúa como proxy
hacia el proveedor del modelo. No se almacena ningún dato en OpenRouter tras completarse la
petición. El administrador debe revisar y aceptar las políticas de privacidad de OpenRouter
antes de activar la función RAG en producción.
Configuración requerida:
- API Key de OpenRouter (generada desde openrouter.ai → Settings → API Keys).
- Crédito mínimo recomendado para el prototipo: $5 USD.
- El sistema identifica el sitio ante OpenRouter mediante el nombre de la institución en la
cabecera de cada petición.
11.2 Resend
Propósito: Envío de correos electrónicos transaccionales para notificaciones de alertas.
Funciones que utiliza el sistema:
- Envío de notificaciones de alerta de nivel alto y crítico a representantes legales y al
equipo DECE.
- Correos de restablecimiento de contraseña (si se implementa esa función).
- Correo de prueba desde el panel de administración.
Configuración requerida:
- Cuenta en resend.com.
- Verificación del dominio de la institución en Resend (necesario para que los correos no
lleguen a spam).
- API Key generada en Resend → Settings → API Keys.
- Plan gratuito de Resend: 3,000 correos por mes (suficiente para el prototipo).
Datos que se envían a Resend: destinatario (correo del representante o del personal DECE),
asunto, cuerpo HTML del correo. No se envían documentos adjuntos ni información más allá de
lo contenido en la alerta.
12. REGLAS DE NEGOCIO
RN-01 Un estudiante solo puede estar matriculado en un curso activo a la vez dentro del mismo
periodo lectivo.
RN-02 Una calificación solo puede registrarse si el docente tiene asignada esa materia en ese
curso. El sistema valida esta asignación en cada petición de registro.
RN-03 El sistema no genera alertas para estudiantes inactivos (que han sido dados de baja
formalmente del periodo lectivo).
RN-04 Una alerta atendida no puede volver al estado activo. Si la situación del estudiante
empeora nuevamente, el motor de alertas generará una nueva alerta.
RN-05 El motor de alertas no genera alertas duplicadas: si ya existe una alerta activa no
atendida del mismo nivel para un estudiante en los últimos 7 días, no se crea una nueva.
RN-06 Un correo de notificación solo se envía una vez por alerta. Si el envío falla, queda en
estado "pendiente" para reintento manual; el sistema no reintenta automáticamente para evitar
spam.
RN-07 El acceso al historial de consultas RAG está restringido al administrador. El personal
DECE puede ver su propio historial de consultas pero no el de otros usuarios.
RN-08 El sistema no permite eliminar estudiantes, calificaciones ni reportes; solo puede
desactivarlos o archivarlos. Esto garantiza la integridad del historial para auditorías.
RN-09 El correo electrónico de cada usuario debe ser único en todo el sistema. No pueden
existir dos cuentas con el mismo correo.
RN-10 Solo el administrador puede cambiar el periodo lectivo activo. Al activar un nuevo
periodo, el sistema no elimina los datos del periodo anterior.
13. RESTRICCIONES Y CONSIDERACIONES ÉTICAS
Privacidad de menores de edad: Los datos procesados corresponden a estudiantes menores
de edad. El sistema debe operar en cumplimiento de las normativas vigentes de protección de
datos en Ecuador (Ley Orgánica de Protección de Datos Personales, 2021). El administrador
de la institución es responsable de informar a los representantes legales sobre el uso de este
sistema.
Acceso mínimo necesario: Cada perfil de usuario solo accede a la información estrictamente
necesaria para cumplir su función. No existe un perfil con acceso irrestricto a todo, excepto el
administrador del sistema, quien asume responsabilidad legal y operativa sobre el uso del
sistema.
El sistema es un apoyo, no un reemplazo: Las alertas y recomendaciones generadas por el
sistema son insumos para la toma de decisiones humanas. En ningún caso el sistema toma
decisiones automáticas sobre el futuro escolar de un estudiante. La intervención
psicopedagógica, las sanciones disciplinarias y las comunicaciones con representantes
siempre son responsabilidad del personal calificado de la institución.
Transparencia del uso de IA: El personal del DECE debe conocer que las respuestas del chat
RAG son generadas por un modelo de lenguaje a partir de la información real del estudiante.
Las respuestas deben ser validadas por el profesional antes de ser utilizadas como base de
una intervención.
Sesgo del modelo: El modelo de lenguaje puede producir respuestas imprecisas o sesgadas
en casos atípicos. El personal del DECE debe mantener un criterio crítico frente a las
recomendaciones generadas automáticamente.
14. GLOSARIO
RAG (Retrieval-Augmented Generation): Arquitectura de inteligencia artificial que combina la
búsqueda de información en bases de conocimiento propias con la generación de texto por
parte de un modelo de lenguaje. Permite que el modelo responda con información real y
actualizada de la institución, no solo con lo que aprendió durante su entrenamiento.
DECE: Departamento de Consejería Estudiantil. Equipo interdisciplinario (psicólogos,
trabajadores sociales, orientadores) responsable del bienestar integral de los estudiantes en la
institución educativa ecuatoriana.
Embedding: Representación matemática de un texto en forma de vector numérico de alta
dimensión, que permite comparar textos por similitud semántica. Se usa en ChromaDB para
encontrar documentos relevantes a una consulta.
ChromaDB: Base de datos vectorial de código abierto diseñada para almacenar y buscar
embeddings de forma eficiente. Permite encontrar los documentos más similares
semánticamente a una pregunta dada.
OpenRouter: Plataforma que unifica el acceso a múltiples modelos de lenguaje (LLM) de
distintos proveedores (Meta, OpenAI, Anthropic, etc.) a través de una única API. Permite
cambiar de modelo sin modificar el sistema.
Resend: Servicio especializado en el envío de correos electrónicos transaccionales
(notificaciones, alertas, confirmaciones) con altas tasas de entrega y trazabilidad completa de
cada envío.
FastAPI: Framework web de Python orientado a la construcción de APIs REST de alto
rendimiento, con soporte nativo para operaciones asíncronas y documentación automática.
PostgreSQL: Sistema de gestión de bases de datos relacionales de código abierto. Elegido por
su robustez, soporte para tipos de datos avanzados (JSONB, UUID) y control de acceso por
roles.
Semáforo de riesgo: Sistema visual de cuatro colores (verde, amarillo, rojo, morado) que
representa el nivel de riesgo calculado para cada estudiante, facilitando la priorización de
intervenciones por parte del equipo DECE.
Quimestre: División del año escolar ecuatoriano. El Bachillerato se divide en dos quimestres,
cada uno con tres parciales de evaluación.
SPA (Single Page Application): Aplicación web que carga una sola página HTML y actualiza
el contenido dinámicamente sin recargar el navegador, proporcionando una experiencia más
fluida al usuario.