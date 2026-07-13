import { apiClient } from '@/shared/lib/api'

export interface PlanItem {
  id: number
  title: string
  objective: string
  status: string
  responsible_role: string
  assignee_user_id?: number | null
  due_hint?: string | null
  evidence_required: boolean
  priority: number
}

export interface ActionPlan {
  id: number
  case_id: number
  institution_id: number
  plan_type: string
  version: number
  status: string
  general_objective: string
  items: PlanItem[]
  validated_progress_pct: number
}

export interface DeceCase {
  id: number
  student_id: number
  status: string
  title: string
  professional_view: boolean
  created_at: string
}

export async function listCases(studentId: number): Promise<DeceCase[]> {
  const { data } = await apiClient.get<DeceCase[]>('/cases', {
    params: { student_id: studentId },
  })
  return data
}

export async function getActivePlanForCase(caseId: number): Promise<ActionPlan | null> {
  const { data } = await apiClient.get<ActionPlan | null>(`/action-plans/by-case/${caseId}/active`)
  return data
}

export async function reportItemProgress(
  planId: number,
  itemId: number,
  note?: string,
): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(
    `/action-plans/${planId}/items/${itemId}/progress`,
    { note },
  )
  return data
}
