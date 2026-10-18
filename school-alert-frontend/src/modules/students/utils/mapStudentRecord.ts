import type { RiskLevel, RiskLevelUI } from '@/shared/types/roles'
import type { Student, StudentRecord } from '../types'

const RISK_UI: Record<RiskLevel, RiskLevelUI> = {
  bajo: 'green',
  medio: 'yellow',
  alto: 'red',
  critico: 'purple',
}

export function studentRecordToUi(record: StudentRecord): Student {
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
    risk: RISK_UI[record.current_risk_level],
    riskLevel: record.current_risk_level,
    guardianId: record.guardian_id ?? undefined,
    guardianName: record.guardian
      ? `${record.guardian.first_name} ${record.guardian.last_name}`
      : undefined,
    status: record.status,
  }
}
