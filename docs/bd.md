Project SIDTRAC_MiniTesis {
  database_type: 'PostgreSQL'
  Note: 'Modelo entidad-relación simplificado para el sistema SIDTRAC.'
}

/* =========================
   ENUMS
========================= */

Enum rol_usuario {
  administrador
  dece
  tutor
  docente
  inspector
  representante
}

Enum estado_usuario {
  activo
  inactivo
}

Enum estado_estudiante {
  activo
  inactivo
  retirado
}

Enum nivel_riesgo {
  bajo
  medio
  alto
  critico
}

Enum estado_asistencia {
  presente
  ausente
  tardanza
  justificado
}

Enum tipo_reporte_dece {
  observacion_conductual
  entrevista
  seguimiento
  alerta_emocional
  derivacion
  plan_intervencion
}

Enum tipo_anotacion_tutor {
  comportamiento
  rendimiento
  emocional
  familiar
  otro
}

Enum tipo_falta {
  leve
  grave
  muy_grave
}

Enum tipo_alerta {
  academica
  asistencia
  conductual
  emocional
  disciplinaria
  desercion
  combinada
}

Enum estado_alerta {
  activa
  atendida
  archivada
}

Enum estado_notificacion {
  pendiente
  enviada
  error
}

/* =========================
   TABLAS PRINCIPALES
========================= */

Table instituciones {
  id int [pk, increment]
  nombre varchar(150) [not null]
  codigo varchar(50) [unique, not null]
  direccion text
  telefono varchar(20)
  correo varchar(120)
  creado_en timestamp
}

Table periodos_lectivos {
  id int [pk, increment]
  institucion_id int [not null]
  nombre varchar(100) [not null]
  fecha_inicio date [not null]
  fecha_fin date [not null]
  activo boolean [default: false]
}

Table usuarios {
  id int [pk, increment]
  institucion_id int [not null]
  nombres varchar(100) [not null]
  apellidos varchar(100) [not null]
  cedula varchar(20)
  correo varchar(120) [unique, not null]
  password_hash text [not null]
  rol rol_usuario [not null]
  estado estado_usuario [default: 'activo']
  creado_en timestamp
}

Table cursos {
  id int [pk, increment]
  institucion_id int [not null]
  periodo_lectivo_id int [not null]
  tutor_id int
  nivel varchar(50) [not null, note: 'Ej: 1ro Bachillerato, 2do Bachillerato']
  paralelo varchar(10) [not null, note: 'Ej: A, B, C']
  nombre varchar(100) [not null]
}

Table materias {
  id int [pk, increment]
  institucion_id int [not null]
  nombre varchar(100) [not null]
  codigo varchar(30)
  horas_semanales int
}

Table curso_materias {
  id int [pk, increment]
  curso_id int [not null]
  materia_id int [not null]
  docente_id int [not null]
}

Table estudiantes {
  id int [pk, increment]
  institucion_id int [not null]
  curso_id int [not null]
  nombres varchar(100) [not null]
  apellidos varchar(100) [not null]
  cedula varchar(20)
  fecha_nacimiento date
  genero varchar(20)
  representante_id int [note: 'FK a usuarios con rol representante']
  estado estado_estudiante [default: 'activo']
  nivel_riesgo_actual nivel_riesgo [default: 'bajo']
  creado_en timestamp
}

/* =========================
   GESTIÓN ACADÉMICA
========================= */

Table calificaciones {
  id int [pk, increment]
  estudiante_id int [not null]
  curso_materia_id int [not null]
  docente_id int [not null]
  quimestre int [not null, note: '1 o 2']
  parcial int [not null, note: '1, 2 o 3']
  nota decimal(5,2) [not null]
  observacion text
  fecha_registro timestamp
}

Table asistencias {
  id int [pk, increment]
  estudiante_id int [not null]
  curso_materia_id int [not null]
  docente_id int [not null]
  fecha date [not null]
  estado estado_asistencia [not null]
  observacion text
  creado_en timestamp
}

/* =========================
   SEGUIMIENTO CONDUCTUAL
========================= */

Table reportes_dece {
  id int [pk, increment]
  estudiante_id int [not null]
  usuario_dece_id int [not null]
  tipo tipo_reporte_dece [not null]
  descripcion text [not null]
  acciones_tomadas text
  nivel_urgencia nivel_riesgo [default: 'bajo']
  requiere_seguimiento boolean [default: false]
  fecha timestamp
}

Table anotaciones_tutor {
  id int [pk, increment]
  estudiante_id int [not null]
  tutor_id int [not null]
  tipo tipo_anotacion_tutor [not null]
  descripcion text [not null]
  fecha timestamp
}

Table reportes_disciplinarios {
  id int [pk, increment]
  estudiante_id int [not null]
  inspector_id int [not null]
  tipo_falta tipo_falta [not null]
  descripcion text [not null]
  sancion_aplicada text
  fecha timestamp
}

/* =========================
   ALERTAS Y RAG
========================= */

Table alertas {
  id int [pk, increment]
  estudiante_id int [not null]
  tipo tipo_alerta [not null]
  nivel nivel_riesgo [not null]
  descripcion text [not null]
  recomendaciones text
  estado estado_alerta [default: 'activa']
  generada_automaticamente boolean [default: true]
  atendida_por_id int
  acciones_atencion text
  fecha_generacion timestamp
  fecha_atencion timestamp
}

Table consultas_rag {
  id int [pk, increment]
  usuario_id int [not null]
  estudiante_id int [not null]
  pregunta text [not null]
  respuesta text [not null]
  modelo_usado varchar(100)
  nivel_riesgo_detectado nivel_riesgo
  latencia_ms int
  fecha timestamp
}

Table documentos_indexados {
  id int [pk, increment]
  estudiante_id int [not null]
  origen varchar(50) [not null, note: 'reporte_dece, anotacion_tutor o reporte_disciplinario']
  origen_id int [not null]
  chroma_document_id varchar(150)
  texto_indexado text
  fecha_indexacion timestamp

  Note: 'Tabla simple para registrar qué textos fueron enviados a ChromaDB para el módulo RAG.'
}

/* =========================
   NOTIFICACIONES Y AUDITORÍA
========================= */

Table notificaciones_email {
  id int [pk, increment]
  alerta_id int [not null]
  destinatario varchar(120) [not null]
  asunto varchar(200) [not null]
  estado estado_notificacion [default: 'pendiente']
  mensaje_error text
  resend_id varchar(150)
  fecha_envio timestamp
}

Table auditoria {
  id int [pk, increment]
  usuario_id int
  accion varchar(100) [not null]
  tabla_afectada varchar(100)
  registro_id int
  descripcion text
  ip varchar(50)
  fecha timestamp
}

/* =========================
   RELACIONES
========================= */

Ref: periodos_lectivos.institucion_id > instituciones.id

Ref: usuarios.institucion_id > instituciones.id

Ref: cursos.institucion_id > instituciones.id
Ref: cursos.periodo_lectivo_id > periodos_lectivos.id
Ref: cursos.tutor_id > usuarios.id

Ref: materias.institucion_id > instituciones.id

Ref: curso_materias.curso_id > cursos.id
Ref: curso_materias.materia_id > materias.id
Ref: curso_materias.docente_id > usuarios.id

Ref: estudiantes.institucion_id > instituciones.id
Ref: estudiantes.curso_id > cursos.id
Ref: estudiantes.representante_id > usuarios.id

Ref: calificaciones.estudiante_id > estudiantes.id
Ref: calificaciones.curso_materia_id > curso_materias.id
Ref: calificaciones.docente_id > usuarios.id

Ref: asistencias.estudiante_id > estudiantes.id
Ref: asistencias.curso_materia_id > curso_materias.id
Ref: asistencias.docente_id > usuarios.id

Ref: reportes_dece.estudiante_id > estudiantes.id
Ref: reportes_dece.usuario_dece_id > usuarios.id

Ref: anotaciones_tutor.estudiante_id > estudiantes.id
Ref: anotaciones_tutor.tutor_id > usuarios.id

Ref: reportes_disciplinarios.estudiante_id > estudiantes.id
Ref: reportes_disciplinarios.inspector_id > usuarios.id

Ref: alertas.estudiante_id > estudiantes.id
Ref: alertas.atendida_por_id > usuarios.id

Ref: consultas_rag.usuario_id > usuarios.id
Ref: consultas_rag.estudiante_id > estudiantes.id

Ref: documentos_indexados.estudiante_id > estudiantes.id

Ref: notificaciones_email.alerta_id > alertas.id

Ref: auditoria.usuario_id > usuarios.id