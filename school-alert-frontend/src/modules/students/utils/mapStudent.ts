import type { RiskLevel, RiskLevelUI } from '@/shared/types/roles'
import type { Student, StudentRecord } from '../types'

const RISK_UI_MAP: Record<RiskLevel, RiskLevelUI> = {
  bajo: 'green',
  medio: 'yellow',
  alto: 'red',
  critico: 'purple',
}

export function toUiStudent(record: StudentRecord): Student {
  const guardianName = record.guardian
    ? `${record.guardian.first_name} ${record.guardian.last_name}`
    : undefined

  return {
    id: String(record.id),
    firstName: record.first_name,
    lastName: record.last_name,
    displayName: `${record.first_name} ${record.last_name}`,
    nationalId: record.national_id ?? undefined,
    course: record.course_name,
    courseId: record.course_id,
    average: 0,
    absences: 0,
    risk: RISK_UI_MAP[record.current_risk_level],
    riskLevel: record.current_risk_level,
    guardianId: record.guardian_id ?? undefined,
    guardianName,
    birthDate: record.birth_date ?? undefined,
    gender: record.gender ?? undefined,
    status: record.status,
  }
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}
