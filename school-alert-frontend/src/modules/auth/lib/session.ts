import type { AuthUser } from '../types'

const TOKEN_KEY = 'sidtrac_token'
const USER_KEY = 'sidtrac_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function hasActiveRole(): boolean {
  const user = getUser()
  return !!user?.active_role
}

export function isAdmin(): boolean {
  const user = getUser()
  const role = user?.active_role
  return role === 'administrador' || role === 'superadmin'
}

export function canManageStudents(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece'
}

export function canViewStudents(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece' || role === 'tutor'
}

export function canViewAcademic(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece' || role === 'tutor' || role === 'docente'
}

export function canManageAcademic(): boolean {
  return getUser()?.active_role === 'docente'
}

export function canViewBehavioral(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece' || role === 'tutor'
}

export function canCreateDeceReport(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece'
}

export function canCreateTutorNote(): boolean {
  return getUser()?.active_role === 'tutor'
}

export function canCreateDisciplinaryReport(): boolean {
  return getUser()?.active_role === 'tutor'
}

export function canEditDeceReport(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece'
}

export function canEditTutorNote(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'tutor'
}

export function canEditDisciplinaryReport(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'tutor'
}

export function canViewAlerts(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece' || role === 'tutor'
}

export function canUseRag(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece'
}

export function canViewReports(): boolean {
  const role = getUser()?.active_role
  return role === 'administrador' || role === 'dece'
}
