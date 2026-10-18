import { apiClient } from '@/shared/lib/api'
import type { RiskLevel } from '@/shared/types/roles'
import type {
  Alert,
  AlertConfig,
  AlertStats,
  AlertStatus,
  AlertType,
  EvaluationResult,
} from './types'

export async function listAlerts(params?: {
  status?: AlertStatus
  level?: RiskLevel
  alert_type?: AlertType
  course_id?: number
  student_id?: number
  term_id?: number
}): Promise<Alert[]> {
  const { data } = await apiClient.get<Alert[]>('/alerts', { params })
  return data
}

export async function getAlertStats(termId?: number): Promise<AlertStats> {
  const { data } = await apiClient.get<AlertStats>('/alerts/stats', {
    params: termId ? { term_id: termId } : undefined,
  })
  return data
}

export async function createManualAlert(payload: {
  student_id: number
  alert_type: AlertType
  level: RiskLevel
  description: string
  recommendations?: string | null
}): Promise<Alert> {
  const { data } = await apiClient.post<Alert>('/alerts/manual', payload)
  return data
}

export async function attendAlert(alertId: number, actionsTaken: string): Promise<Alert> {
  const { data } = await apiClient.post<Alert>(`/alerts/${alertId}/attend`, {
    actions_taken: actionsTaken,
  })
  return data
}

export async function runEvaluation(): Promise<EvaluationResult> {
  const { data } = await apiClient.post<EvaluationResult>('/alerts/evaluate')
  return data
}

export async function getAlertConfig(): Promise<AlertConfig> {
  const { data } = await apiClient.get<AlertConfig>('/alerts/config')
  return data
}

export async function updateAlertConfig(payload: Partial<AlertConfig>): Promise<AlertConfig> {
  const { data } = await apiClient.patch<AlertConfig>('/alerts/config', payload)
  return data
}
