import { apiClient } from '@/shared/lib/api'

export interface PlanItem {
  id: number
  title: string
  objective: string
  status: string
  responsible_role: string
  assignee_user_id?: number | null
  due_at?: string | null
  due_hint?: string | null
  evidence_required: boolean
  priority: number
  case_dimension?: string | null
  dece_axis?: string | null
  action_type?: string | null
  expected_result?: string | null
  success_indicator?: string | null
  rationale?: string | null
  supporting_roles?: string | null
}

export interface NormativeRef {
  document_code: string
  version: string
  article: string
  article_title: string
  effective_from: string
  source_chunk_id: string
  article_id?: number | null
}

export interface PlanNote {
  id: number
  text: string
  visibility_scope: string
  author_id: number
  created_at: string
  item_id?: number | null
  note_kind?: string | null
}

export interface ActionPlan {
  id: number
  case_id: number
  institution_id: number
  plan_type: string
  version: number
  status: string
  general_objective: string
  limitations?: string | null
  review_criteria?: string | null
  opening_reason?: string | null
  review_at_hint?: string | null
  document_json?: string | null
  items: PlanItem[]
  notes?: PlanNote[]
  normative_references?: NormativeRef[]
  validated_progress_pct: number
}

export interface SharedPlanSummary {
  plan_id: number
  general_objective: string | null
  commitments: Array<{
    title: string
    status: string
    due_hint?: string | null
  }>
  validated_progress_pct: number
}

export interface DeceCase {
  id: number
  student_id: number
  status: string
  title: string
  professional_view: boolean
  created_at: string
  opening_summary?: string | null
}

export interface GeneratedAction {
  title: string
  objective: string
  responsible_role: string
  supporting_roles?: string[]
  due_hint: string
  /** Fecha límite exacta (YYYY-MM-DD o ISO UTC). */
  due_at?: string
  evidence_required: boolean
  priority: number
  confidentiality_level: string
  case_dimension: string
  dece_axis: string
  action_type?: string
  expected_result?: string
  success_indicator?: string
  rationale?: string
  normative_hint?: string | null
}

export interface GeneratedNormativeRef {
  document_code: string
  document_name?: string
  version: string
  article: string
  article_title: string
  effective_from: string
  source_chunk_id: string
  article_id?: number | null
}

export interface ActionPlanGeneration {
  triage: {
    routine_plan_allowed: boolean
    protocol_review_required: boolean
    protocol_type?: string | null
    urgency: string
    flags: string[]
    reasons: string[]
    professional_confirmation_required?: string[]
    immediate_integrity_risk?: string
    violence_presumption?: string
    self_harm_risk?: string
    rights_violation?: string
    repeated_absences?: string
    urgent_protocol_needed?: string
  }
  plan: {
    plan_type: string
    general_objective: string
    limitations: string[]
    review_criteria: string
    review_at_hint?: string | null
    review_triggers?: string[]
  }
  actions: GeneratedAction[]
  normative_references: GeneratedNormativeRef[]
  assessment: {
    situation_summary: string
    opening_reason?: string
    facts: Array<{ fact_id: string; text: string; source: string; date?: string | null }>
    protective_factors: string[]
    risk_factors: string[]
    missing_information: string[]
  }
  draft_origin?: 'ai' | 'local_fallback'
  context_course?: string | null
  context_risk?: string | null
}

export async function listCases(studentId: number): Promise<DeceCase[]> {
  const { data } = await apiClient.get<DeceCase[]>('/cases', {
    params: { student_id: studentId },
  })
  return data
}

export async function createCase(payload: {
  student_id: number
  title: string
  opening_summary?: string
}): Promise<DeceCase> {
  const { data } = await apiClient.post<DeceCase>('/cases', payload)
  return data
}

export async function confirmTriageOpen(caseId: number): Promise<DeceCase> {
  const { data } = await apiClient.post<DeceCase>(`/cases/${caseId}/triage`, {
    routine_plan_allowed: true,
    protocol_review_required: false,
    urgency: 'normal',
    outcome: 'open',
    confirm: true,
    reasons: ['Apertura de plan de atención desde Perfil 360'],
  })
  return data
}

export async function deleteCase(caseId: number): Promise<DeceCase> {
  const { data } = await apiClient.post<DeceCase>(`/cases/${caseId}/discard`)
  return data
}

export async function getActivePlanForCase(caseId: number): Promise<ActionPlan | null> {
  const { data } = await apiClient.get<ActionPlan | null>(`/action-plans/by-case/${caseId}/active`)
  return data
}

export async function getActivePlanForStudent(studentId: number): Promise<ActionPlan | null> {
  const { data } = await apiClient.get<ActionPlan | null>(
    `/action-plans/by-student/${studentId}/active`,
  )
  return data
}

export async function getSharedPlanSummary(planId: number): Promise<SharedPlanSummary> {
  const { data } = await apiClient.get<SharedPlanSummary>(`/action-plans/${planId}/shared-summary`)
  return data
}

export async function generatePlanDraft(
  caseId: number,
  questionFocus?: string,
): Promise<ActionPlanGeneration> {
  const { data } = await apiClient.post<ActionPlanGeneration>('/action-plans/generate', {
    case_id: caseId,
    question_focus: questionFocus,
  })
  return data
}

export async function createPlanDraft(payload: {
  case_id: number
  plan_type: string
  general_objective: string
  limitations?: string
  review_criteria?: string
  opening_reason?: string
  review_at_hint?: string
  document_json?: string
  items: Array<{
    title: string
    objective: string
    responsible_role: string
    due_at?: string | null
    due_hint?: string | null
    evidence_required: boolean
    priority: number
    confidentiality_level: string
    case_dimension?: string | null
    dece_axis?: string | null
    action_type?: string | null
    expected_result?: string | null
    success_indicator?: string | null
    rationale?: string | null
    supporting_roles?: string | null
  }>
  normative_references: GeneratedNormativeRef[]
}): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>('/action-plans', payload)
  return data
}

export async function submitPlan(planId: number): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(`/action-plans/${planId}/submit`)
  return data
}

export async function approvePlan(planId: number, comment?: string): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(`/action-plans/${planId}/approve`, {
    comment,
  })
  return data
}

export async function discardPlan(planId: number): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(`/action-plans/${planId}/discard`)
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

export async function validateItem(
  planId: number,
  itemId: number,
  approved = true,
  comment?: string,
): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(
    `/action-plans/${planId}/items/${itemId}/validate`,
    { approved, comment },
  )
  return data
}

export async function addPlanNote(
  planId: number,
  text: string,
  visibilityScope = 'professional',
): Promise<ActionPlan> {
  const { data } = await apiClient.post<ActionPlan>(`/action-plans/${planId}/notes`, {
    text,
    visibility_scope: visibilityScope,
  })
  return data
}
