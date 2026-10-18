import type { MonthlyAttendancePoint, SubjectRadarPoint } from '../types'
import { StudentAcademicSnapshot } from './StudentAcademicSnapshot'
import type { StudentAcademicProfile } from '../types'

interface StudentAcademicChartsProps {
  subjectScores: SubjectRadarPoint[]
  attendanceTrend: MonthlyAttendancePoint[]
  compact?: boolean
  /** Perfil 360 usa radar; otras vistas usan barras */
  subjectsView?: 'bars' | 'radar'
  profile?: StudentAcademicProfile | null
  loading?: boolean
}

/** @deprecated Prefer StudentAcademicSnapshot — kept for backward-compatible props. */
export function StudentAcademicCharts({
  subjectScores,
  attendanceTrend,
  profile,
  loading,
  compact,
  subjectsView,
}: StudentAcademicChartsProps) {
  const resolvedProfile: StudentAcademicProfile | null =
    profile ??
    (subjectScores.length > 0 || attendanceTrend.length > 0
      ? {
          student_id: 0,
          average_score:
            subjectScores.length > 0
              ? subjectScores.reduce((s, x) => s + x.value, 0) / subjectScores.length
              : null,
          absence_count: 0,
          tardy_count: 0,
          attendance_rate:
            attendanceTrend.length > 0
              ? Math.round(
                  attendanceTrend.reduce((s, x) => s + x.attendance, 0) /
                    attendanceTrend.length
                )
              : null,
          subject_scores: subjectScores,
          attendance_trend: attendanceTrend,
        }
      : null)

  return (
    <StudentAcademicSnapshot
      profile={resolvedProfile}
      loading={loading}
      compact={compact}
      subjectsView={subjectsView}
    />
  )
}
