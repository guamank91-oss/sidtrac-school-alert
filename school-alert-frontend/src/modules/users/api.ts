import { apiClient } from '@/shared/lib/api'
import type { User, UserCreatePayload, UserUpdatePayload } from './types'
import type { UserRole } from '@/shared/types/roles'

export async function listUsers(params?: {
  institution_id?: number
  role?: UserRole
}): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users', { params })
  return data
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload)
  return data
}

export async function updateUser(id: number, payload: UserUpdatePayload): Promise<User> {
  const { data } = await apiClient.patch<User>(`/users/${id}`, payload)
  return data
}
