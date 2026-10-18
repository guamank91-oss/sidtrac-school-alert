import type { DeceReportType, FaultType, TutorAnnotationType } from './types'

export const DECE_TYPE_LABELS: Record<DeceReportType, string> = {
  observacion_conductual: 'Observación conductual',
  entrevista: 'Entrevista',
  seguimiento: 'Seguimiento',
  alerta_emocional: 'Alerta emocional',
  derivacion: 'Derivación',
  plan_intervencion: 'Plan de intervención',
}

export const TUTOR_TYPE_LABELS: Record<TutorAnnotationType, string> = {
  comportamiento: 'Comportamiento',
  rendimiento: 'Rendimiento',
  emocional: 'Emocional',
  familiar: 'Familiar',
  otro: 'Otro',
}

export const FAULT_TYPE_LABELS: Record<FaultType, string> = {
  leve: 'Leve',
  grave: 'Grave',
  muy_grave: 'Muy grave',
}

export const URGENCY_LABELS: Record<string, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}
