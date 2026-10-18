import { apiClient } from '@/shared/lib/api'
import type { AcademicTerm, BasicUser, Course, CourseSubject, Institution, Subject } from './types'

export async function getInstitution(id: number): Promise<Institution> {
  const { data } = await apiClient.get<Institution>(`/institution/institutions/${id}`)
  return data
}

export async function updateInstitution(
  id: number,
  payload: Partial<Omit<Institution, 'id'>>
): Promise<Institution> {
  const { data } = await apiClient.patch<Institution>(`/institution/institutions/${id}`, payload)
  return data
}

export async function listTerms(institutionId: number): Promise<AcademicTerm[]> {
  const { data } = await apiClient.get<AcademicTerm[]>('/institution/terms', {
    params: { institution_id: institutionId },
  })
  return data
}

export async function createTerm(payload: Omit<AcademicTerm, 'id'>): Promise<AcademicTerm> {
  const { data } = await apiClient.post<AcademicTerm>('/institution/terms', payload)
  return data
}

export async function activateTerm(id: number): Promise<AcademicTerm> {
  const { data } = await apiClient.post<AcademicTerm>(`/institution/terms/${id}/activate`)
  return data
}

export async function updateTerm(
  id: number,
  payload: Partial<Pick<AcademicTerm, 'name' | 'start_date' | 'end_date' | 'is_active'>>
): Promise<AcademicTerm> {
  const { data } = await apiClient.patch<AcademicTerm>(`/institution/terms/${id}`, payload)
  return data
}

export async function listCourses(institutionId: number, termId?: number): Promise<Course[]> {
  const { data } = await apiClient.get<Course[]>('/institution/courses', {
    params: { institution_id: institutionId, term_id: termId },
  })
  return data
}

export async function createCourse(payload: Omit<Course, 'id'>): Promise<Course> {
  const { data } = await apiClient.post<Course>('/institution/courses', payload)
  return data
}

export async function updateCourse(
  id: number,
  payload: Partial<Pick<Course, 'name' | 'grade_level' | 'section' | 'tutor_id' | 'academic_term_id'>>
): Promise<Course> {
  const { data } = await apiClient.patch<Course>(`/institution/courses/${id}`, payload)
  return data
}

export async function deleteCourse(id: number): Promise<void> {
  await apiClient.delete(`/institution/courses/${id}`)
}

export async function listSubjects(institutionId: number): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>('/institution/subjects', {
    params: { institution_id: institutionId },
  })
  return data
}

export async function createSubject(payload: Omit<Subject, 'id'>): Promise<Subject> {
  const { data } = await apiClient.post<Subject>('/institution/subjects', payload)
  return data
}

export async function updateSubject(
  id: number,
  payload: Partial<Pick<Subject, 'name' | 'code' | 'weekly_hours'>>
): Promise<Subject> {
  const { data } = await apiClient.patch<Subject>(`/institution/subjects/${id}`, payload)
  return data
}

export async function deleteSubject(id: number): Promise<void> {
  await apiClient.delete(`/institution/subjects/${id}`)
}

export async function listCourseSubjects(institutionId: number): Promise<CourseSubject[]> {
  const { data } = await apiClient.get<CourseSubject[]>('/institution/course-subjects', {
    params: { institution_id: institutionId },
  })
  return data
}

export async function createCourseSubject(payload: {
  course_id: number
  subject_id: number
  teacher_id: number
}): Promise<CourseSubject> {
  const { data } = await apiClient.post<CourseSubject>('/institution/course-subjects', payload)
  return data
}

export async function updateCourseSubject(
  id: number,
  payload: { teacher_id: number }
): Promise<CourseSubject> {
  const { data } = await apiClient.patch<CourseSubject>(`/institution/course-subjects/${id}`, payload)
  return data
}

export async function deleteCourseSubject(id: number): Promise<void> {
  await apiClient.delete(`/institution/course-subjects/${id}`)
}

export async function listUsersByRole(role: string, institutionId?: number): Promise<BasicUser[]> {
  const { data } = await apiClient.get<BasicUser[]>('/users', {
    params: { role, institution_id: institutionId },
  })
  return data
}
