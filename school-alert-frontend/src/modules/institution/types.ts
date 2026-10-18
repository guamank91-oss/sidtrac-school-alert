export interface Institution {
  id: number
  name: string
  code: string
  address: string | null
  phone: string | null
  email: string | null
}

export interface AcademicTerm {
  id: number
  institution_id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export interface Course {
  id: number
  institution_id: number
  academic_term_id: number
  tutor_id: number | null
  grade_level: string
  section: string
  name: string
}

export interface Subject {
  id: number
  institution_id: number
  name: string
  code: string | null
  weekly_hours: number | null
}

export interface CourseSubject {
  id: number
  course_id: number
  subject_id: number
  teacher_id: number
  course_name?: string
  subject_name?: string
  teacher_name?: string
}

export interface BasicUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string | null
  roles: string[]
}
