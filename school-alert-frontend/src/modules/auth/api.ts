import { apiClient } from '@/shared/lib/api'
import type { LoginResponse } from './types'
import type { UserRole } from '@/shared/types/roles'

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password })
  return data
}

export async function selectRole(role: UserRole): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/select-role', { role })
  return data
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
