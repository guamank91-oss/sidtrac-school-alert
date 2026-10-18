import { apiClient } from '@/shared/lib/api'
import type { RiskLevel } from '@/shared/types/roles'
import type {
  StudentCreatePayload,
  StudentRecord,
  StudentStatus,
  StudentUpdatePayload,
} from './types'

export async function listStudents(params?: {
  institution_id?: number
  course_id?: number
  term_id?: number
  search?: string
  risk_level?: RiskLevel
  status?: StudentStatus
}): Promise<StudentRecord[]> {
  const { data } = await apiClient.get<StudentRecord[]>('/students', { params })
  return data
}

export async function getStudent(id: number): Promise<StudentRecord> {
  const { data } = await apiClient.get<StudentRecord>(`/students/${id}`)
  return data
}

export async function createStudent(payload: StudentCreatePayload): Promise<StudentRecord> {
  const { data } = await apiClient.post<StudentRecord>('/students', payload)
  return data
}

export async function updateStudent(
  id: number,
  payload: StudentUpdatePayload
): Promise<StudentRecord> {
  const { data } = await apiClient.patch<StudentRecord>(`/students/${id}`, payload)
  return data
}
