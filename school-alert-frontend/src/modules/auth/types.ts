import type { UserRole } from '@/shared/types/roles'

export interface AuthUser {
  id: number
  institution_id: number
  username: string
  first_name: string
  last_name: string
  email: string | null
  roles: UserRole[]
  active_role: UserRole | null
  requires_role_selection?: boolean
}

export interface LoginResponse {
  token: { access_token: string; token_type: string }
  user: AuthUser
}
