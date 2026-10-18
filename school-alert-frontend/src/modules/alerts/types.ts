import type { RiskLevel } from '@/shared/types/roles'

export type AlertType =
  | 'academica'
  | 'asistencia'
  | 'conductual'
  | 'emocional'
  | 'disciplinaria'
  | 'desercion'
  | 'combinada'

export type AlertStatus = 'activa' | 'atendida' | 'archivada'

export interface Alert {
  id: number
  student_id: number
  student_name: string
  course_name: string
  alert_type: AlertType
  level: RiskLevel
  description: string
  recommendations: string | null
  status: AlertStatus
  is_manual: boolean
  attended_by_name: string | null
  actions_taken: string | null
  attended_at: string | null
  email_sent: boolean
  created_at: string
}

export interface AlertStats {
  active_critical: number
  active_high: number
  active_medium: number
  low_pct: number
  total_students: number
}

export interface AlertConfig {
  min_average: number
  absences_medium: number
  absences_high: number
  serious_faults_month: number
  sender_email: string | null
  evaluation_hour: number
}

export interface EvaluationResult {
  students_evaluated: number
  alerts_created: number
  emails_sent: number
  internal_notifications: number
}
