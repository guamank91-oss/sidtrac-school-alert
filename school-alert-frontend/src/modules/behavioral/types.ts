import type { RiskLevel } from '@/shared/types/roles'

export type DeceReportType =
  | 'observacion_conductual'
  | 'entrevista'
  | 'seguimiento'
  | 'alerta_emocional'
  | 'derivacion'
  | 'plan_intervencion'

export type TutorAnnotationType =
  | 'comportamiento'
  | 'rendimiento'
  | 'emocional'
  | 'familiar'
  | 'otro'

export type FaultType = 'leve' | 'grave' | 'muy_grave'

export interface BehavioralSummary {
  dece_reports: number
  tutor_annotations: number
  disciplinary_reports: number
  high_urgency_reports: number
  follow_up_pending: number
}

export interface DeceReport {
  id: number
  student_id: number
  student_name: string
  course_name: string
  dece_user_id: number
  author_name: string
  report_type: DeceReportType
  description: string
  actions_taken: string | null
  urgency_level: RiskLevel
  requires_follow_up: boolean
  reported_at: string
}

export interface TutorAnnotation {
  id: number
  student_id: number
  student_name: string
  course_name: string
  tutor_id: number
  author_name: string
  annotation_type: TutorAnnotationType
  description: string
  annotated_at: string
}

export interface DisciplinaryReport {
  id: number
  student_id: number
  student_name: string
  course_name: string
  inspector_id: number
  author_name: string
  fault_type: FaultType
  description: string
  sanction: string | null
  reported_at: string
}

export interface TimelineEntry {
  id: number
  source: 'dece' | 'tutor' | 'disciplinary'
  date: string
  type: string
  type_label: string
  description: string
  author_name: string
  urgency_level?: RiskLevel | null
  requires_follow_up?: boolean | null
  actions_taken?: string | null
  sanction?: string | null
}
