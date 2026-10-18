import { apiClient } from '@/shared/lib/api'
import type { RiskLevel } from '@/shared/types/roles'
import type {
  BehavioralSummary,
  DeceReport,
  DeceReportType,
  DisciplinaryReport,
  FaultType,
  TimelineEntry,
  TutorAnnotation,
  TutorAnnotationType,
} from './types'

export async function getBehavioralSummary(termId?: number): Promise<BehavioralSummary> {
  const { data } = await apiClient.get<BehavioralSummary>('/behavioral/summary', {
    params: termId ? { term_id: termId } : undefined,
  })
  return data
}

export async function listDeceReports(params?: {
  student_id?: number
  report_type?: DeceReportType
  urgency_level?: RiskLevel
  date_from?: string
  date_to?: string
  term_id?: number
}): Promise<DeceReport[]> {
  const { data } = await apiClient.get<DeceReport[]>('/behavioral/dece-reports', { params })
  return data
}

export async function createDeceReport(payload: {
  student_id: number
  report_type: DeceReportType
  description: string
  actions_taken?: string | null
  urgency_level?: RiskLevel
  requires_follow_up?: boolean
}): Promise<DeceReport> {
  const { data } = await apiClient.post<DeceReport>('/behavioral/dece-reports', payload)
  return data
}

export async function updateDeceReport(
  id: number,
  payload: {
    report_type?: DeceReportType
    description?: string
    actions_taken?: string | null
    urgency_level?: RiskLevel
    requires_follow_up?: boolean
  }
): Promise<DeceReport> {
  const { data } = await apiClient.patch<DeceReport>(`/behavioral/dece-reports/${id}`, payload)
  return data
}

export async function deleteDeceReport(id: number): Promise<void> {
  await apiClient.delete(`/behavioral/dece-reports/${id}`)
}

export async function listTutorNotes(
  studentId?: number,
  termId?: number
): Promise<TutorAnnotation[]> {
  const { data } = await apiClient.get<TutorAnnotation[]>('/behavioral/tutor-notes', {
    params: {
      ...(studentId ? { student_id: studentId } : {}),
      ...(termId ? { term_id: termId } : {}),
    },
  })
  return data
}

export async function createTutorNote(payload: {
  student_id: number
  annotation_type: TutorAnnotationType
  description: string
}): Promise<TutorAnnotation> {
  const { data } = await apiClient.post<TutorAnnotation>('/behavioral/tutor-notes', payload)
  return data
}

export async function updateTutorNote(
  id: number,
  payload: { annotation_type?: TutorAnnotationType; description?: string }
): Promise<TutorAnnotation> {
  const { data } = await apiClient.patch<TutorAnnotation>(`/behavioral/tutor-notes/${id}`, payload)
  return data
}

export async function deleteTutorNote(id: number): Promise<void> {
  await apiClient.delete(`/behavioral/tutor-notes/${id}`)
}

export async function listDisciplinaryReports(
  studentId?: number,
  termId?: number
): Promise<DisciplinaryReport[]> {
  const { data } = await apiClient.get<DisciplinaryReport[]>('/behavioral/disciplinary-reports', {
    params: {
      ...(studentId ? { student_id: studentId } : {}),
      ...(termId ? { term_id: termId } : {}),
    },
  })
  return data
}

export async function createDisciplinaryReport(payload: {
  student_id: number
  fault_type: FaultType
  description: string
  sanction?: string | null
}): Promise<DisciplinaryReport> {
  const { data } = await apiClient.post<DisciplinaryReport>(
    '/behavioral/disciplinary-reports',
    payload
  )
  return data
}

export async function updateDisciplinaryReport(
  id: number,
  payload: { fault_type?: FaultType; description?: string; sanction?: string | null }
): Promise<DisciplinaryReport> {
  const { data } = await apiClient.patch<DisciplinaryReport>(
    `/behavioral/disciplinary-reports/${id}`,
    payload
  )
  return data
}

export async function deleteDisciplinaryReport(id: number): Promise<void> {
  await apiClient.delete(`/behavioral/disciplinary-reports/${id}`)
}

export async function getStudentTimeline(studentId: number): Promise<TimelineEntry[]> {
  const { data } = await apiClient.get<TimelineEntry[]>(
    `/behavioral/students/${studentId}/timeline`
  )
  return data
}
