import { apiClient } from '@/shared/lib/api'

export interface AuditLog {
  id: number
  user_id: number | null
  user_name: string
  action: string
  detail: string | null
  ip_address: string | null
  created_at: string
}

export async function listAuditLogs(params?: {
  action?: string
  user_id?: number
  date_from?: string
  date_to?: string
  limit?: number
}): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>('/audit/logs', { params })
  return data
}

export async function listAuditActions(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/audit/actions')
  return data
}
