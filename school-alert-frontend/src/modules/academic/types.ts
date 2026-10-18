export type AttendanceStatus = 'presente' | 'ausente' | 'tardanza' | 'justificado'

export interface Assignment {
  id: number
  course_id: number
  subject_id: number
  teacher_id: number
  course_name: string
  subject_name: string
  teacher_name: string
  can_edit: boolean
}

export interface GradeRosterRow {
  student_id: number
  first_name: string
  last_name: string
  national_id: string | null
  grade_id: number | null
  score: number | null
  notes: string | null
}

export interface AttendanceRosterRow {
  student_id: number
  first_name: string
  last_name: string
  national_id: string | null
  attendance_id: number | null
  status: AttendanceStatus | null
  notes: string | null
}

export interface StudentAcademicSummary {
  student_id: number
  first_name: string
  last_name: string
  course_name: string
  average_score: number | string | null
  absence_count: number
  tardy_count: number
}

export interface SubjectRadarPoint {
  subject: string
  value: number
  full_mark: number
}

export interface MonthlyAttendancePoint {
  month: string
  attendance: number
}

export interface StudentAcademicProfile {
  student_id: number
  average_score: number | null
  absence_count: number
  tardy_count: number
  attendance_rate: number | null
  subject_scores: SubjectRadarPoint[]
  attendance_trend: MonthlyAttendancePoint[]
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  tardanza: 'Tardanza',
  justificado: 'Justificado',
}

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  presente: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  ausente: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
  tardanza: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  justificado: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
}
