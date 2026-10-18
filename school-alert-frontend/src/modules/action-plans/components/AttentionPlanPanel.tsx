import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardCheck, FilePlus2, FolderKanban, Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getUser } from '@/modules/auth/lib/session'
import {
  approvePlan,
  addPlanNote,
  confirmTriageOpen,
  createCase,
  createPlanDraft,
  deleteCase,
  discardPlan,
  generatePlanDraft,
  getActivePlanForCase,
  getActivePlanForStudent,
  listCases,
  reportItemProgress,
  submitPlan,
  validateItem,
  type ActionPlan,
  type ActionPlanGeneration,
  type DeceCase,
  type GeneratedAction,
} from '../api'
import { ConfirmButton } from './ConfirmButton'
import { ActivePlanDocument, DraftPlanDocument } from './PlanDocumentViews'

interface AttentionPlanPanelProps {
  studentId: number
}

type WizardMode = 'view' | 'create' | 'review'

const CASE_STATUS_LABEL: Record<string, string> = {
  pending_triage: 'Pendiente',
  open: 'Abierto',
  under_assessment: 'En evaluación',
  discarded: 'Descartado',
  attended_without_case: 'Atendido sin caso',
  closed: 'Cerrado',
}

const CASE_STATUS_CLASSES: Record<string, string> = {
  pending_triage: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  open: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  under_assessment: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  discarded: 'border-white/15 bg-white/5 text-slate-400',
  attended_without_case: 'border-white/15 bg-white/5 text-slate-300',
  closed: 'border-white/15 bg-white/5 text-slate-400',
}

function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] || status
}

function caseStatusClasses(status: string): string {
  return CASE_STATUS_CLASSES[status] || 'border-white/15 bg-white/5 text-slate-300'
}

function apiDetail(err: unknown): string | undefined {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
    (err as Error)?.message
  )
}

function pickWorkingCase(rows: DeceCase[]): DeceCase | null {
  return (
    rows.find((c) => c.status === 'open' || c.status === 'under_assessment') ??
    rows.find((c) => c.status === 'pending_triage') ??
    rows[0] ??
    null
  )
}

export function AttentionPlanPanel({ studentId }: AttentionPlanPanelProps) {
  const role = getUser()?.active_role
  const isProfessional = role === 'dece'
  const canOperate = role === 'dece'
  const canReport = role === 'tutor' || role === 'docente' || isProfessional

  const [cases, setCases] = useState<DeceCase[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyItem, setBusyItem] = useState<number | null>(null)
  const [busyCaseId, setBusyCaseId] = useState<number | null>(null)

  const [mode, setMode] = useState<WizardMode>('view')
  const [caseTitle, setCaseTitle] = useState('Plan de atención y seguimiento')
  const [caseSummary, setCaseSummary] = useState('')
  const [draft, setDraft] = useState<ActionPlanGeneration | null>(null)
  const [draftObjective, setDraftObjective] = useState('')
  const [draftActions, setDraftActions] = useState<GeneratedAction[]>([])
  const [draftCaseId, setDraftCaseId] = useState<number | null>(null)

  const requestRef = useRef(0)

  const refresh = useCallback(
    async (preferredCaseId?: number | null) => {
      const requestId = ++requestRef.current
      setLoading(true)
      setError(null)
      try {
        if (canOperate) {
          const rows = await listCases(studentId)
          if (requestId !== requestRef.current) return
          setCases(rows)
          const preferred = pickWorkingCase(rows)
          const caseId =
            preferredCaseId && rows.some((c) => c.id === preferredCaseId)
              ? preferredCaseId
              : preferred?.id ?? null
          setSelectedCaseId(caseId)
          if (!caseId) {
            setPlan(null)
            return
          }
          const active = await getActivePlanForCase(caseId)
          if (requestId !== requestRef.current) return
          setPlan(active)
          return
        }

        setCases([])
        setSelectedCaseId(null)
        const active = await getActivePlanForStudent(studentId)
        if (requestId !== requestRef.current) return
        setPlan(active)
      } catch {
        if (requestId !== requestRef.current) return
        setCases([])
        setPlan(null)
        setError(
          canOperate
            ? 'No se pudo cargar el plan de atención. Verifique su sesión DECE e intente de nuevo.'
            : 'No se pudo cargar el plan de atención asignado. Verifique que sea tutor del curso de este estudiante.',
        )
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false)
        }
      }
    },
    [studentId, canOperate],
  )

  useEffect(() => {
    setMode('view')
    setDraft(null)
    setDraftActions([])
    setDraftCaseId(null)
    void refresh(null)
  }, [studentId, refresh])

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null

  async function selectCase(caseId: number) {
    const requestId = ++requestRef.current
    setSelectedCaseId(caseId)
    setError(null)
    try {
      const active = await getActivePlanForCase(caseId)
      if (requestId === requestRef.current) setPlan(active)
    } catch {
      if (requestId === requestRef.current) setPlan(null)
    }
  }

  async function onReport(itemId: number, note: string) {
    if (!plan) return
    setBusyItem(itemId)
    setError(null)
    try {
      const updated = await reportItemProgress(plan.id, itemId, note)
      setPlan(updated)
    } catch {
      setError('No se pudo reportar el avance.')
      throw new Error('report_failed')
    } finally {
      setBusyItem(null)
    }
  }

  async function onValidate(itemId: number, approved: boolean, comment?: string) {
    if (!plan) return
    setBusyItem(itemId)
    setError(null)
    try {
      const updated = await validateItem(plan.id, itemId, approved, comment)
      setPlan(updated)
    } catch {
      setError(approved ? 'No se pudo validar la acción.' : 'No se pudo rechazar la acción.')
      throw new Error('validate_failed')
    } finally {
      setBusyItem(null)
    }
  }

  async function onAddNote(text: string) {
    if (!plan || !canOperate) return
    setBusy(true)
    setError(null)
    try {
      const updated = await addPlanNote(plan.id, text, 'professional')
      setPlan(updated)
    } catch {
      setError('No se pudo guardar la nota.')
      throw new Error('note_failed')
    } finally {
      setBusy(false)
    }
  }

  async function openAndPrepareCase(caseId: number): Promise<number> {
    const current = cases.find((c) => c.id === caseId)
    if (current?.status === 'pending_triage') {
      const opened = await confirmTriageOpen(caseId)
      setCases((prev) => prev.map((c) => (c.id === opened.id ? opened : c)))
      return opened.id
    }
    return caseId
  }

  async function runGenerate(caseId: number) {
    const readyId = await openAndPrepareCase(caseId)
    const generated = await generatePlanDraft(readyId)
    setDraft(generated)
    setDraftObjective(generated.plan.general_objective)
    setDraftActions(generated.actions || [])
    setDraftCaseId(readyId)
    setSelectedCaseId(readyId)
    setMode('review')
  }

  async function handleCreateAndGenerate() {
    if (!canOperate) return
    const title = caseTitle.trim()
    if (title.length < 3) {
      setError('El título del caso debe tener al menos 3 caracteres.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createCase({
        student_id: studentId,
        title,
        opening_summary: caseSummary.trim() || undefined,
      })
      setCases((prev) => [created, ...prev])
      await runGenerate(created.id)
    } catch (err: unknown) {
      const detail = apiDetail(err)
      setError(
        detail
          ? `No se pudo crear el caso o generar el borrador: ${detail}`
          : 'No se pudo crear el caso o generar el borrador. Revise permisos e IA.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleStartPlan() {
    if (!canOperate) return
    setError(null)
    if (selectedCase && !plan) {
      setBusy(true)
      try {
        await runGenerate(selectedCase.id)
      } catch (err: unknown) {
        const detail = apiDetail(err)
        setError(
          detail
            ? `No se pudo generar el borrador del plan: ${detail}`
            : 'No se pudo generar el borrador del plan. Verifique que la IA esté disponible.',
        )
      } finally {
        setBusy(false)
      }
      return
    }
    setMode('create')
  }

  function handleEditActivePlan() {
    if (!plan || !canOperate) return
    let snapshot: ActionPlanGeneration | null = null
    if (plan.document_json) {
      try {
        snapshot = JSON.parse(plan.document_json) as ActionPlanGeneration
      } catch {
        snapshot = null
      }
    }
    const actionsFromPlan: GeneratedAction[] = plan.items.map((item, idx) => ({
      title: item.title,
      objective: item.objective,
      responsible_role: item.responsible_role || 'dece',
      supporting_roles: item.supporting_roles ? item.supporting_roles.split(',') : [],
      due_hint: item.due_hint || '',
      due_at: item.due_at ? item.due_at.slice(0, 10) : '',
      evidence_required: item.evidence_required,
      priority: item.priority ?? idx + 1,
      confidentiality_level: 'professional',
      case_dimension: item.case_dimension || 'institucional',
      dece_axis: item.dece_axis || 'psychosocial_attention',
      action_type: item.action_type || 'followup',
      expected_result: item.expected_result || '',
      success_indicator: item.success_indicator || '',
      rationale: item.rationale || '',
    }))
    const base: ActionPlanGeneration = snapshot || {
      draft_origin: 'local_fallback',
      triage: {
        routine_plan_allowed: true,
        protocol_review_required: false,
        urgency: 'normal',
        flags: [],
        reasons: [],
      },
      assessment: {
        situation_summary: plan.opening_reason || plan.general_objective,
        opening_reason: plan.opening_reason || '',
        facts: [],
        protective_factors: [],
        risk_factors: [],
        missing_information: [],
      },
      plan: {
        plan_type: plan.plan_type,
        general_objective: plan.general_objective,
        limitations: plan.limitations ? plan.limitations.split('\n') : [],
        review_criteria: plan.review_criteria || '',
        review_at_hint: plan.review_at_hint,
      },
      actions: actionsFromPlan,
      normative_references: (plan.normative_references || []).map((r) => ({
        document_code: r.document_code,
        version: r.version,
        article: r.article,
        article_title: r.article_title,
        effective_from: r.effective_from,
        source_chunk_id: r.source_chunk_id,
        article_id: r.article_id,
      })),
    }
    base.actions = actionsFromPlan.length ? actionsFromPlan : base.actions
    setDraft(base)
    setDraftObjective(plan.general_objective)
    setDraftActions(actionsFromPlan.length ? actionsFromPlan : base.actions)
    setDraftCaseId(plan.case_id)
    setSelectedCaseId(plan.case_id)
    setMode('review')
  }

  async function handleDeleteActivePlan() {
    if (!plan || !canOperate) return
    setBusy(true)
    setError(null)
    try {
      await discardPlan(plan.id)
      setPlan(null)
      await refresh(selectedCaseId)
    } catch (err: unknown) {
      const detail = apiDetail(err)
      setError(detail ? `No se pudo eliminar el plan: ${detail}` : 'No se pudo eliminar el plan.')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCase(caseId: number) {
    if (!canOperate) return
    setBusyCaseId(caseId)
    setError(null)
    try {
      await deleteCase(caseId)
      const remaining = cases.filter((c) => c.id !== caseId)
      setCases(remaining)
      if (selectedCaseId === caseId) {
        const next = pickWorkingCase(remaining)
        setSelectedCaseId(next?.id ?? null)
        setPlan(null)
        if (next) {
          const active = await getActivePlanForCase(next.id)
          setPlan(active)
        }
      } else if (plan?.case_id === caseId) {
        setPlan(null)
      }
      if (draftCaseId === caseId) {
        setDraft(null)
        setDraftActions([])
        setDraftCaseId(null)
        setMode('view')
      }
    } catch (err: unknown) {
      const detail = apiDetail(err)
      setError(detail ? `No se pudo eliminar el caso: ${detail}` : 'No se pudo eliminar el caso.')
      throw err
    } finally {
      setBusyCaseId(null)
    }
  }

  async function handleActivatePlan() {
    if (!canOperate || !draft || !draftCaseId) return
    setBusy(true)
    setError(null)
    try {
      const created = await createPlanDraft({
        case_id: draftCaseId,
        plan_type: draft.plan.plan_type || 'psychosocial_attention_followup',
        general_objective: draftObjective.trim() || draft.plan.general_objective,
        limitations: draft.plan.limitations?.join('\n') || undefined,
        review_criteria: draft.plan.review_criteria || undefined,
        opening_reason:
          draft.assessment.opening_reason || draft.assessment.situation_summary || undefined,
        review_at_hint: draft.plan.review_at_hint || undefined,
        document_json: JSON.stringify(draft),
        items: draftActions.map((a, idx) => {
          const dueAtIso =
            a.due_at && a.due_at.includes('T')
              ? a.due_at
              : a.due_at
                ? `${a.due_at.slice(0, 10)}T23:59:59.999Z`
                : null
          return {
            title: a.title,
            objective: a.objective,
            responsible_role: a.responsible_role || 'dece',
            due_at: dueAtIso,
            due_hint: a.due_hint || null,
            evidence_required: a.evidence_required ?? true,
            priority: a.priority ?? idx + 1,
            confidentiality_level: a.confidentiality_level || 'professional',
            case_dimension: a.case_dimension || null,
            dece_axis: a.dece_axis || null,
            action_type: a.action_type || null,
            expected_result: a.expected_result || null,
            success_indicator: a.success_indicator || null,
            rationale: a.rationale || null,
            supporting_roles: (a.supporting_roles || []).join(',') || null,
          }
        }),
        normative_references: (draft.normative_references || []).map((r) => ({
          document_code: r.document_code,
          version: r.version,
          article: r.article,
          article_title: r.article_title,
          effective_from: r.effective_from,
          source_chunk_id: r.source_chunk_id,
          article_id: r.article_id ?? null,
        })),
      })
      await submitPlan(created.id)
      const active = await approvePlan(created.id, 'Aprobado desde Perfil 360')
      setPlan(active)
      setDraft(null)
      setDraftActions([])
      setMode('view')
      await refresh(draftCaseId)
    } catch (err: unknown) {
      const detail = apiDetail(err)
      setError(
        detail
          ? `No se pudo guardar y activar el plan: ${detail}`
          : 'No se pudo guardar y activar el plan.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-400" />
        Cargando plan de atención...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {canOperate && mode === 'create' ? (
        <div className="glass-panel overflow-hidden rounded-2xl border border-white/15 shadow-[var(--shadow-glass)]">
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-black/25 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-300">
              <FilePlus2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Nuevo caso y plan documental</h3>
              <p className="text-xs text-slate-400">
                Se abrirá el caso y se generará un borrador editable (triage, hechos, acciones y normativa) antes de activarlo.
              </p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Título del caso</label>
              <Input
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                className="rounded-xl border-white/15 bg-black/20 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Motivo / resumen de apertura</label>
              <Textarea
                value={caseSummary}
                onChange={(e) => setCaseSummary(e.target.value)}
                rows={3}
                className="rounded-xl border-white/15 bg-black/20 text-white"
                placeholder="Ej.: seguimiento por asistencia irregular y descenso académico"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500"
                disabled={busy}
                onClick={() => void handleCreateAndGenerate()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Crear caso y generar documento
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                disabled={busy}
                onClick={() => setMode('view')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {canOperate && mode === 'review' && draft && draftCaseId ? (
        <DraftPlanDocument
          draft={draft}
          caseId={draftCaseId}
          caseTitle={cases.find((c) => c.id === draftCaseId)?.title || caseTitle}
          objective={draftObjective}
          actions={draftActions}
          editable
          busy={busy}
          onObjectiveChange={setDraftObjective}
          onActionsChange={setDraftActions}
          onActivate={() => void handleActivatePlan()}
          onDiscard={() => {
            setDraft(null)
            setDraftActions([])
            setMode('view')
          }}
        />
      ) : null}

      {mode === 'view' ? (
        <>
          {canOperate ? (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/15 shadow-[var(--shadow-glass)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/25 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-white">Casos DECE</h3>
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  className="gap-1.5 rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500"
                  onClick={() => void handleStartPlan()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {selectedCase && !plan ? 'Crear plan' : 'Nuevo plan'}
                </Button>
              </div>
              <div className="space-y-2 p-4">
                {!cases.length ? (
                  <p className="py-2 text-center text-sm text-slate-400">
                    No hay casos DECE para este estudiante. Usa “Nuevo plan” para empezar.
                  </p>
                ) : (
                  cases.map((c) => {
                    const active = selectedCaseId === c.id
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors',
                          active
                            ? 'border-sky-400/40 bg-sky-500/15 shadow-[0_0_15px_rgba(14,165,233,0.12)]'
                            : 'border-white/10 bg-white/5 hover:bg-white/10',
                        )}
                        onClick={() => void selectCase(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            void selectCase(c.id)
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-white">{c.title}</span>
                          <span className="text-[11px] text-slate-400">Caso #{c.id}</span>
                        </div>
                        <Badge variant="outline" className={caseStatusClasses(c.status)}>
                          {caseStatusLabel(c.status)}
                        </Badge>
                        <ConfirmButton
                          triggerLabel="Eliminar"
                          title="¿Eliminar este caso?"
                          description="Se eliminará el caso y cualquier plan asociado dejará de estar vigente. Esta acción se registra en auditoría."
                          confirmLabel="Sí, eliminar"
                          variant="outline"
                          size="sm"
                          stopPropagation
                          disabled={busy || busyCaseId === c.id}
                          className="shrink-0 rounded-lg border-red-400/25 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                          onConfirm={() => handleDeleteCase(c.id)}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : null}

          {!plan ? (
            <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-white/10 px-5 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <ClipboardCheck className="h-6 w-6 text-slate-400" />
              </div>
              <p className="max-w-md text-sm text-slate-400">
                {canOperate
                  ? selectedCase
                    ? 'Este caso aún no tiene plan activo. Pulsa “Crear plan” para elaborarlo.'
                    : 'Sin plan activo.'
                  : 'Aún no hay un plan de atención activo para este estudiante. Cuando DECE lo active, aquí podrás ver las acciones y reportar avances.'}
              </p>
            </div>
          ) : (
            <ActivePlanDocument
              plan={plan}
              caseTitle={selectedCase?.title}
              isProfessional={isProfessional}
              canReport={canReport}
              activeRole={role}
              busyItem={busyItem}
              busyPlan={busy}
              onReport={onReport}
              onValidate={onValidate}
              onAddNote={canOperate ? onAddNote : undefined}
              onEdit={canOperate ? handleEditActivePlan : undefined}
              onDelete={canOperate ? handleDeleteActivePlan : undefined}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
