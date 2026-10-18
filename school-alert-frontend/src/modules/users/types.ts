import type { UserRole } from '@/shared/types/roles'

export type UserStatus = 'activo' | 'inactivo'

export type StaffRole = 'tutor' | 'docente' | 'representante' | 'dece'

export const ASSIGNABLE_ROLES: StaffRole[] = ['dece', 'tutor', 'docente', 'representante']

export interface User {
  id: number
  institution_id: number
  username: string
  first_name: string
  last_name: string
  national_id: string | null
  email: string | null
  roles: UserRole[]
  status: UserStatus
}

export interface UserCreatePayload {
  institution_id: number
  first_name: string
  last_name: string
  national_id: string
  roles: UserRole[]
  email?: string | null
}

export interface UserUpdatePayload {
  first_name?: string
  last_name?: string
  national_id?: string | null
  email?: string | null
  roles?: UserRole[]
  status?: UserStatus
}
