import { apiClient } from '@/shared/lib/api'
import type {
  Assignment,
  AttendanceRosterRow,
  AttendanceStatus,
  GradeRosterRow,
  StudentAcademicProfile,
  StudentAcademicSummary,
} from './types'

export async function listAssignments(termId?: number): Promise<Assignment[]> {
  const { data } = await apiClient.get<Assignment[]>('/academic/assignments', {
    params: termId ? { term_id: termId } : undefined,
  })
  return data
}

export async function getGradeRoster(params: {
  course_subject_id: number
  quarter: number
  partial: number
}): Promise<GradeRosterRow[]> {
  const { data } = await apiClient.get<GradeRosterRow[]>('/academic/grades/roster', { params })
  return data
}

export async function saveGrades(payload: {
  course_subject_id: number
  quarter: number
  partial: number
  grades: { student_id: number; score: number; notes?: string | null }[]
}): Promise<GradeRosterRow[]> {
  const { data } = await apiClient.post<GradeRosterRow[]>('/academic/grades/bulk', payload)
  return data
}

export async function getAttendanceRoster(params: {
  course_subject_id: number
  attendance_date: string
}): Promise<AttendanceRosterRow[]> {
  const { data } = await apiClient.get<AttendanceRosterRow[]>('/academic/attendance/roster', {
    params,
  })
  return data
}

export async function saveAttendance(payload: {
  course_subject_id: number
  attendance_date: string
  records: { student_id: number; status: AttendanceStatus; notes?: string | null }[]
}): Promise<AttendanceRosterRow[]> {
  const { data } = await apiClient.post<AttendanceRosterRow[]>('/academic/attendance/bulk', payload)
  return data
}

export async function getAcademicOverview(
  courseId?: number,
  termId?: number
): Promise<StudentAcademicSummary[]> {
  const { data } = await apiClient.get<StudentAcademicSummary[]>('/academic/overview', {
    params: {
      ...(courseId ? { course_id: courseId } : {}),
      ...(termId ? { term_id: termId } : {}),
    },
  })
  return data
}

export async function getStudentAcademicProfile(
  studentId: number
): Promise<StudentAcademicProfile> {
  const { data } = await apiClient.get<StudentAcademicProfile>(
    `/academic/students/${studentId}/profile`
  )
  return data
}
