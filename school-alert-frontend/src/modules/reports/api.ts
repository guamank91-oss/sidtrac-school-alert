import { apiClient } from '@/shared/lib/api'

export interface RiskDistribution {
  level: string
  count: number
  previous_month: number
}

export interface InstitutionalReport {
  total_students: number
  distribution: RiskDistribution[]
  active_alerts: number
  attended_alerts_month: number
  alerts_by_type: { type: string; count: number }[]
  generated_at: string
}

export interface StudentReportGrade {
  subject: string
  average: number
  grades_count: number
}

export interface StudentReportEntry {
  date: string
  type: string
  description: string
  author?: string | null
}

export interface StudentFullReport {
  student_id: number
  full_name: string
  national_id: string | null
  course_name: string
  guardian_name: string | null
  risk_level: string
  average_score: number | null
  attendance_rate: number | null
  absences_30d: number
  grades_by_subject: StudentReportGrade[]
  dece_reports: StudentReportEntry[]
  tutor_annotations: StudentReportEntry[]
  disciplinary_reports: StudentReportEntry[]
  alerts: StudentReportEntry[]
  generated_at: string
}

export interface LevelCount {
  level: string
  count: number
}

export interface PeriodSummary {
  term_id: number
  term_name: string
  start_date: string
  end_date: string
  students: number
  alerts_total: number
  alerts_by_level: LevelCount[]
  alerts_attended: number
  dece_reports: number
  disciplinary_reports: number
  tutor_annotations: number
  average_score: number | null
  attendance_rate: number | null
  risk_distribution: LevelCount[]
}

export interface PeriodComparison {
  period_a: PeriodSummary
  period_b: PeriodSummary | null
}

export async function getInstitutionalReport(termId?: number): Promise<InstitutionalReport> {
  const { data } = await apiClient.get<InstitutionalReport>('/reports/institutional', {
    params: termId ? { term_id: termId } : undefined,
  })
  return data
}

export async function getPeriodSummary(termId: number): Promise<PeriodSummary> {
  const { data } = await apiClient.get<PeriodSummary>('/reports/period-summary', {
    params: { term_id: termId },
  })
  return data
}

export async function getPeriodComparison(
  termAId: number,
  termBId?: number
): Promise<PeriodComparison> {
  const { data } = await apiClient.get<PeriodComparison>('/reports/period-comparison', {
    params: { term_a_id: termAId, term_b_id: termBId },
  })
  return data
}

export async function getStudentFullReport(studentId: number): Promise<StudentFullReport> {
  const { data } = await apiClient.get<StudentFullReport>(`/reports/students/${studentId}`)
  return data
}

export async function downloadCsv(dataset: 'students' | 'alerts' | 'grades' | 'attendance') {
  const response = await apiClient.get(`/reports/export/${dataset}`, { responseType: 'blob' })
  const disposition = response.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? `${dataset}.csv`
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
