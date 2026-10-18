/** Role values match backend/DB enum strings. */
export type UserRole =
  | 'superadmin'
  | 'administrador'
  | 'dece'
  | 'tutor'
  | 'docente'
  | 'representante'

/** Risk level values match backend/DB enum strings. */
export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico'

export type RiskLevelUI = 'green' | 'yellow' | 'red' | 'purple'

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'SuperAdmin SaaS',
  administrador: 'Administrador',
  dece: 'DECE',
  tutor: 'Tutor',
  docente: 'Docente',
  representante: 'Representante',
}
