import type { RiskLevel, RiskLevelUI } from '@/shared/types/roles'

export type StudentStatus = 'activo' | 'inactivo' | 'retirado'

export interface GuardianSummary {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string | null
  national_id: string | null
}

export interface StudentRecord {
  id: number
  institution_id: number
  course_id: number
  course_name: string
  first_name: string
  last_name: string
  national_id: string | null
  birth_date: string | null
  gender: string | null
  guardian_id: number | null
  guardian: GuardianSummary | null
  status: StudentStatus
  current_risk_level: RiskLevel
}

export interface StudentCreatePayload {
  institution_id: number
  course_id: number
  first_name: string
  last_name: string
  national_id?: string | null
  birth_date?: string | null
  gender?: string | null
  guardian_id?: number | null
}

export interface StudentUpdatePayload {
  course_id?: number
  first_name?: string
  last_name?: string
  national_id?: string | null
  birth_date?: string | null
  gender?: string | null
  guardian_id?: number | null
  status?: StudentStatus
}

/** UI shape used by dashboards and profile dialog */
export interface Student {
  id: string
  firstName: string
  lastName: string
  displayName: string
  nationalId?: string
  course: string
  courseId: number
  average: number
  absences: number
  risk: RiskLevelUI
  riskLevel: RiskLevel
  guardianId?: number
  guardianName?: string
  birthDate?: string
  gender?: string
  status: StudentStatus
}

export interface BehavioralReport {
  id: string
  date: string
  title: string
  description: string
  severity: 'mild' | 'moderate' | 'severe'
  author: string
}
