import { apiClient } from '@/shared/lib/api'

export type EmailStatus = 'enviado' | 'error' | 'pendiente'

export interface EmailNotification {
  id: number
  alert_id: number | null
  recipient: string
  subject: string
  status: EmailStatus
  resend_id: string | null
  error_detail: string | null
  sent_at: string | null
  created_at: string
}

export interface InternalNotification {
  id: number
  alert_id: number | null
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function listEmailNotifications(status?: EmailStatus): Promise<EmailNotification[]> {
  const { data } = await apiClient.get<EmailNotification[]>('/notifications/email', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function resendEmail(id: number): Promise<EmailNotification> {
  const { data } = await apiClient.post<EmailNotification>(`/notifications/email/${id}/resend`)
  return data
}

export async function sendTestEmail(recipient: string): Promise<EmailNotification> {
  const { data } = await apiClient.post<EmailNotification>('/notifications/email/test', {
    recipient,
  })
  return data
}

export async function listInternalNotifications(
  unreadOnly = false
): Promise<InternalNotification[]> {
  const { data } = await apiClient.get<InternalNotification[]>('/notifications/internal', {
    params: { unread_only: unreadOnly },
  })
  return data
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.post(`/notifications/internal/${id}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/internal/read-all')
}
