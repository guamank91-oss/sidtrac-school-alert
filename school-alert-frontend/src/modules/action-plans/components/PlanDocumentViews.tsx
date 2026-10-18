import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ActionPlan, ActionPlanGeneration, GeneratedAction, PlanNote } from '../api'
import { ConfirmButton } from './ConfirmButton'

const ROLE_LABEL: Record<string, string> = {
  dece: 'DECE',
  tutor: 'Tutor',
  docente: 'Docente',
  representante: 'Representante',
}

const SOURCE_LABEL: Record<string, string> = {
  student_risk: 'Semáforo institucional',
  enrollment: 'Matrícula / curso',
  case_opening: 'Apertura del caso',
  grades: 'Calificaciones',
  grades_by_subject: 'Calificaciones por materia',
  attendance: 'Asistencia',
  attendance_by_subject: 'Asistencia por materia',
  alert_activa: 'Alerta activa',
  alert: 'Alerta',
}

function roleLabel(role: string) {
  return ROLE_LABEL[role] || role
}

function sourceLabel(source: string) {
  return SOURCE_LABEL[source] || 'Registro institucional'
}

function urgencyLabel(value: string) {
  const map: Record<string, string> = {
    normal: 'Normal',
    high: 'Alta',
    critical: 'Crítica',
    bajo: 'Baja',
    medio: 'Media',
    alto: 'Alta',
    critico: 'Crítica',
  }
  return map[value] || value
}

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  reported_completed: 'Reportada',
  validated: 'Validada',
}

const ITEM_STATUS_CLASSES: Record<string, string> = {
  pending: 'border-white/15 bg-white/5 text-slate-300',
  in_progress: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  reported_completed: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  validated: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  dece: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
  tutor: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  docente: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  representante: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
}

function itemStatusLabel(status: string) {
  return ITEM_STATUS_LABEL[status] || status
}

function itemStatusClasses(status: string) {
  return ITEM_STATUS_CLASSES[status] || 'border-white/15 bg-white/5 text-slate-300'
}

function roleBadgeClasses(role: string) {
  return ROLE_BADGE_CLASSES[role] || 'border-white/20 bg-white/5 text-slate-200'
}

function formatNoteDate(value?: string) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString('es-EC', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

/** Valor YYYY-MM-DD para <input type="date"> desde ISO/UTC. */
function toDateInputValue(iso?: string | null): string {
  if (!iso) return ''
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (match) return match[1]
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

/** Fin del día UTC para comparar vencimientos de forma estable. */
function toDueAtIso(dateStr?: string | null): string | null {
  if (!dateStr?.trim()) return null
  const day = dateStr.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return `${day}T23:59:59.999Z`
}

function formatDueDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-EC', { dateStyle: 'medium', timeZone: 'UTC' })
  } catch {
    return iso.slice(0, 10)
  }
}

/** Solo alerta visual: nunca cambia estado. */
function isActionOverdue(dueAt?: string | null, status?: string): boolean {
  if (!dueAt) return false
  if (status === 'reported_completed' || status === 'validated') return false
  const dueMs = Date.parse(dueAt)
  if (Number.isNaN(dueMs)) return false
  return Date.now() > dueMs
}

/** Quita el listado "Principales: ..." para no duplicar hechos ya mostrados abajo. */
function cleanSituationSummary(summary?: string | null): string {
  if (!summary?.trim()) return ''
  const cleaned = summary.replace(/\s*Principales:\s*.+$/i, '').trim()
  if (!cleaned) return summary.trim()
  if (/hechos en el expediente\.?$/i.test(cleaned)) {
    return `${cleaned} Se requieren entrevistas para precisar causas.`
  }
  return cleaned.endsWith('.') ? cleaned : `${cleaned}.`
}

function noteKindLabel(kind?: string | null): string {
  switch (kind) {
    case 'progress_report':
      return 'Reporte de avance'
    case 'validation_approved':
      return 'Validación aprobada'
    case 'validation_rejected':
      return 'Validación rechazada'
    case 'manual':
      return 'Nota'
    default:
      return 'Nota'
  }
}

function ReportProgressDialog({
  itemTitle,
  disabled,
  onSubmit,
}: {
  itemTitle: string
  disabled?: boolean
  onSubmit: (note: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    const text = note.trim()
    if (!text) return
    setBusy(true)
    try {
      await onSubmit(text)
      setNote('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        Reportar cumplimiento
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="glass-panel border-white/15 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Reportar cumplimiento</DialogTitle>
            <DialogDescription className="text-slate-400">
              Acción: <span className="font-medium text-slate-200">{itemTitle}</span>. Describe brevemente cómo cumpliste esta acción.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="rounded-xl border-white/10 bg-black/20 text-white"
            placeholder="Ej.: Conversé con la familia el martes y acordamos seguimiento semanal."
            disabled={busy}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500"
              disabled={busy || !note.trim()}
              onClick={() => void handleSubmit()}
            >
              Enviar reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ValidateItemDialog({
  itemTitle,
  reportNotes,
  disabled,
  onSubmit,
}: {
  itemTitle: string
  reportNotes: PlanNote[]
  disabled?: boolean
  onSubmit: (approved: boolean, comment?: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(approved: boolean) {
    setBusy(true)
    try {
      await onSubmit(approved, comment.trim() || undefined)
      setComment('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="rounded-xl border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        Revisar reporte
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="glass-panel max-h-[90vh] overflow-y-auto border-white/15 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Validar acción</DialogTitle>
            <DialogDescription className="text-slate-400">
              Acción: <span className="font-medium text-slate-200">{itemTitle}</span>. Revise el comentario del reporte, luego apruebe o rechace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Comentario del reporte
            </p>
            {!reportNotes.length ? (
              <p className="text-sm text-slate-400">
                Este reporte no incluye un comentario de avance.
              </p>
            ) : (
              <ul className="space-y-2">
                {reportNotes.map((n) => (
                  <li key={n.id} className="text-sm text-slate-100">
                    <p className="whitespace-pre-wrap">{n.text}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatNoteDate(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Comentarios de retroalimentación</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="rounded-xl border-white/10 bg-black/20 text-white"
              placeholder="Opcional: detalle de la revisión (se guardará en la bitácora de la acción)"
              disabled={busy}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="rounded-xl border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              disabled={busy}
              onClick={() => void handleSubmit(false)}
            >
              Rechazar (regresar a progreso)
            </Button>
            <Button
              className="rounded-xl border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500"
              disabled={busy}
              onClick={() => void handleSubmit(true)}
            >
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddNoteDialog({
  disabled,
  onSubmit,
}: {
  disabled?: boolean
  onSubmit: (text: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    const value = text.trim()
    if (!value) return
    setBusy(true)
    try {
      await onSubmit(value)
      setText('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        Añadir nota
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="glass-panel border-white/15 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva nota de seguimiento</DialogTitle>
            <DialogDescription className="text-slate-400">
              Se guardará en la bitácora profesional del plan (visibilidad institucional DECE).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="rounded-xl border-white/10 bg-black/20 text-white"
            placeholder="Escriba la nota de seguimiento..."
            disabled={busy}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500"
              disabled={busy || !text.trim()}
              onClick={() => void handleSubmit()}
            >
              Guardar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-[0.14em] text-sky-300/90 uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

interface DraftDocumentProps {
  draft: ActionPlanGeneration
  caseId: number
  caseTitle: string
  objective: string
  actions: GeneratedAction[]
  editable: boolean
  onObjectiveChange: (value: string) => void
  onActionsChange: (actions: GeneratedAction[]) => void
  onActivate: () => void
  onDiscard: () => void
  busy?: boolean
}

export function DraftPlanDocument({
  draft,
  caseId,
  caseTitle,
  objective,
  actions,
  editable,
  onObjectiveChange,
  onActionsChange,
  onActivate,
  onDiscard,
  busy,
}: DraftDocumentProps) {
  const triageRows = [
    ['Riesgo inmediato para la integridad', draft.triage.immediate_integrity_risk || '—'],
    ['Presunción de violencia', draft.triage.violence_presumption || '—'],
    ['Riesgo autolítico', draft.triage.self_harm_risk || '—'],
    ['Vulneración de derechos', draft.triage.rights_violation || '—'],
    ['Inasistencias reiteradas', draft.triage.repeated_absences || '—'],
    ['Necesidad de protocolo urgente', draft.triage.urgent_protocol_needed || '—'],
    [
      '¿Un plan de rutina es suficiente (sin protocolo adicional)?',
      draft.triage.routine_plan_allowed
        ? 'Sí'
        : 'No — este plan no debe ser la única actuación; el caso requiere además activar protocolo/derivación',
    ],
  ]

  function updateAction(index: number, patch: Partial<GeneratedAction>) {
    onActionsChange(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeAction(index: number) {
    onActionsChange(actions.filter((_, i) => i !== index))
  }

  function addAction() {
    onActionsChange([
      ...actions,
      {
        title: 'Nueva acción',
        objective: '',
        responsible_role: 'dece',
        supporting_roles: [],
        due_hint: '',
        due_at: '',
        evidence_required: true,
        priority: actions.length + 1,
        confidentiality_level: 'professional',
        case_dimension: 'institucional',
        dece_axis: 'psychosocial_attention',
        expected_result: '',
        success_indicator: '',
        rationale: '',
      },
    ])
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-white/15 text-slate-100 shadow-[var(--shadow-glass)]">
      <header className="space-y-3 border-b border-white/10 bg-[rgba(15,32,64,0.55)] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300/80 uppercase">
              Plan de atención y seguimiento DECE
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-white">
              {caseTitle || 'Borrador profesional'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-amber-400/30 bg-amber-500/20 text-amber-100 hover:bg-amber-500/25">
              Borrador — pendiente de revisión
            </Badge>
            <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-200">
              {draft.draft_origin === 'ai'
                ? 'Asistido por inteligencia artificial'
                : 'Elaborado a partir del expediente'}
            </Badge>
          </div>
        </div>
        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-slate-400">Caso</span>
            <p className="font-medium text-slate-100">DECE-{caseId}</p>
          </div>
          <div>
            <span className="text-slate-400">Curso / riesgo</span>
            <p className="font-medium text-slate-100">
              {draft.context_course || '—'} ·{' '}
              {urgencyLabel(draft.context_risk || draft.triage.urgency)}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Urgencia del triage</span>
            <p className="font-medium text-slate-100">{urgencyLabel(draft.triage.urgency)}</p>
          </div>
          <div>
            <span className="text-slate-400">Revisión sugerida</span>
            <p className="font-medium text-slate-100">
              {draft.plan.review_at_hint || '15 días lectivos'}
            </p>
          </div>
        </div>
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Este borrador corresponde al estudiante del caso seleccionado. Revise los hechos frente al
          expediente, corrija lo necesario y apruebe el plan antes de aplicarlo.
        </p>
      </header>

      <div className="space-y-5 px-5 py-5">
        <Section title="1. Motivo de apertura">
          <p className="text-sm leading-relaxed text-slate-200">
            {draft.assessment.opening_reason ||
              cleanSituationSummary(draft.assessment.situation_summary)}
          </p>
        </Section>

        <Section title="2. Triage inicial">
          <div className="overflow-hidden rounded-lg border border-white/15">
            <table className="w-full text-left text-xs">
              <tbody>
                {triageRows.map(([label, value]) => (
                  <tr key={label} className="border-b border-white/10 last:border-0">
                    <th className="w-[45%] bg-white/5 px-3 py-2 font-medium text-slate-300">
                      {label}
                    </th>
                    <td className="px-3 py-2 text-slate-100">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="3. Síntesis de la situación">
          <p className="text-sm leading-relaxed text-slate-200">
            {cleanSituationSummary(draft.assessment.situation_summary)}
          </p>
        </Section>

        <Section title="4. Hechos registrados">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-200">
            {draft.assessment.facts.map((f) => (
              <li key={f.fact_id}>
                <span className="font-medium">{f.text}</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  Fuente: {sourceLabel(f.source)}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="grid gap-5 md:grid-cols-2">
          <Section title="5. Factores de riesgo">
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
              {draft.assessment.risk_factors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
          <Section title="6. Factores protectores">
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
              {draft.assessment.protective_factors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
        </div>

        <Section title="7. Información pendiente">
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
            {draft.assessment.missing_information.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="8. Objetivo general">
          {editable ? (
            <Textarea
              value={objective}
              onChange={(e) => onObjectiveChange(e.target.value)}
              rows={3}
              className="bg-white/5"
            />
          ) : (
            <p className="text-sm leading-relaxed text-slate-200">{objective}</p>
          )}
        </Section>

        <Section title="9. Acciones priorizadas">
          <div className="space-y-3">
            {actions.map((action, index) => (
              <article
                key={`${action.title}-${index}`}
                className="rounded-xl border border-white/15 bg-white/5 p-4 shadow-[var(--shadow-glass)]"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    Acción {index + 1}
                    {editable ? '' : ` — ${action.title}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={roleBadgeClasses(action.responsible_role)}>
                      {roleLabel(action.responsible_role)}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 bg-black/25 text-slate-300">
                      Prioridad {action.priority}
                    </Badge>
                    {editable ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-lg text-red-400 hover:bg-red-500/15 hover:text-red-300"
                        onClick={() => removeAction(index)}
                      >
                        Eliminar
                      </Button>
                    ) : null}
                  </div>
                </div>
                {editable ? (
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        ¿Qué acción se realizará?
                      </label>
                      <Input
                        value={action.title}
                        onChange={(e) => updateAction(index, { title: e.target.value })}
                        placeholder="Ej.: Convocar al representante"
                        className="border-white/15 bg-black/20 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Objetivo de la acción
                      </label>
                      <Textarea
                        value={action.objective}
                        onChange={(e) => updateAction(index, { objective: e.target.value })}
                        placeholder="Para qué se hace esta acción"
                        rows={2}
                        className="border-white/15 bg-black/20 text-white"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Responsable</label>
                        <select
                          className="flex h-9 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-1 text-sm text-slate-100 shadow-sm"
                          value={action.responsible_role}
                          onChange={(e) =>
                            updateAction(index, { responsible_role: e.target.value })
                          }
                        >
                          <option value="dece" className="bg-slate-900 text-slate-100">DECE</option>
                          <option value="tutor" className="bg-slate-900 text-slate-100">Tutor</option>
                          <option value="docente" className="bg-slate-900 text-slate-100">Docente</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">
                          Plazo (sugerencia)
                        </label>
                        <Input
                          value={action.due_hint || ''}
                          onChange={(e) => updateAction(index, { due_hint: e.target.value })}
                          placeholder="Ej.: 5 días lectivos"
                          className="border-white/15 bg-black/20 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">
                          Fecha límite
                        </label>
                        <Input
                          type="date"
                          value={toDateInputValue(action.due_at)}
                          onChange={(e) => updateAction(index, { due_at: e.target.value })}
                          className="border-white/15 bg-black/20 text-white [color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-300">Ámbito</label>
                        <Input
                          value={action.case_dimension || ''}
                          onChange={(e) =>
                            updateAction(index, { case_dimension: e.target.value })
                          }
                          placeholder="Ej.: familiar, académica, asistencia"
                          className="border-white/15 bg-black/20 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        ¿Por qué es necesaria? (fundamento)
                      </label>
                      <Textarea
                        value={action.rationale || ''}
                        onChange={(e) => updateAction(index, { rationale: e.target.value })}
                        placeholder="Relación con los hechos del expediente"
                        rows={2}
                        className="border-white/15 bg-black/20 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Resultado esperado
                      </label>
                      <Textarea
                        value={action.expected_result || ''}
                        onChange={(e) =>
                          updateAction(index, { expected_result: e.target.value })
                        }
                        placeholder="Qué se espera lograr al completar la acción"
                        rows={2}
                        className="border-white/15 bg-black/20 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Cómo se comprueba (indicador / evidencia)
                      </label>
                      <Textarea
                        value={action.success_indicator || ''}
                        onChange={(e) =>
                          updateAction(index, { success_indicator: e.target.value })
                        }
                        placeholder="Qué registro o documento demuestra el cumplimiento"
                        rows={2}
                        className="border-white/15 bg-black/20 text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-slate-200">
                    <p>
                      <span className="text-slate-400">Dimensión:</span> {action.case_dimension}
                    </p>
                    <p>
                      <span className="text-slate-400">Plazo:</span> {action.due_hint || '—'}
                      {action.due_at
                        ? ` · Fecha: ${formatDueDate(toDueAtIso(action.due_at) || action.due_at)}`
                        : ''}
                    </p>
                    <p>{action.objective}</p>
                    {action.rationale ? (
                      <p>
                        <span className="text-slate-400">Fundamento:</span> {action.rationale}
                      </p>
                    ) : null}
                    {action.expected_result ? (
                      <p>
                        <span className="text-slate-400">Resultado esperado:</span>{' '}
                        {action.expected_result}
                      </p>
                    ) : null}
                    {action.success_indicator ? (
                      <p>
                        <span className="text-slate-400">Indicador:</span>{' '}
                        {action.success_indicator}
                      </p>
                    ) : null}
                    {action.evidence_required ? (
                      <p className="text-xs text-slate-400">Evidencia requerida</p>
                    ) : null}
                    {action.normative_hint ? (
                      <p className="text-xs text-slate-400">Normativa: {action.normative_hint}</p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
            {editable ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                onClick={addAction}
              >
                Añadir acción
              </Button>
            ) : null}
          </div>
        </Section>

        <Section title="10. Criterios de revisión">
          <p className="text-sm text-slate-200">{draft.plan.review_criteria}</p>
          {draft.plan.review_triggers?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
              {draft.plan.review_triggers.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section title="11. Limitaciones del borrador">
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
            {(draft.plan.limitations || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="12. Referencias normativas">
          {draft.normative_references?.length ? (
            <ul className="space-y-2 text-sm text-slate-200">
              {draft.normative_references.map((ref) => (
                <li
                  key={`${ref.document_code}-${ref.article}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <p className="font-medium text-white">
                    {ref.document_code} · Art. {ref.article}
                  </p>
                  <p className="text-xs text-slate-400">{ref.article_title}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Sin referencias cargadas.</p>
          )}
        </Section>

        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <ConfirmButton
            triggerLabel="Activar plan"
            title="¿Activar este plan?"
            description="El plan quedará oficial para seguimiento. Tutor y docentes podrán reportar avances de sus acciones."
            confirmLabel="Sí, activar"
            variant="default"
            size="default"
            className="rounded-xl border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500"
            disabled={busy || actions.length === 0}
            onConfirm={onActivate}
          />
          <ConfirmButton
            triggerLabel="Descartar borrador"
            title="¿Descartar este borrador?"
            description="Se perderán los cambios de esta revisión. No se activará ningún plan."
            confirmLabel="Sí, descartar"
            variant="outline"
            size="default"
            className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
            disabled={busy}
            onConfirm={onDiscard}
          />
        </div>
      </div>
    </div>
  )
}

interface ActiveDocumentProps {
  plan: ActionPlan
  caseTitle?: string
  isProfessional: boolean
  canReport: boolean
  /** Rol activo de sesión: solo ese rol puede reportar sus acciones. */
  activeRole?: string | null
  busyItem: number | null
  busyPlan?: boolean
  onReport: (itemId: number, note: string) => void | Promise<void>
  onValidate: (itemId: number, approved: boolean, comment?: string) => void | Promise<void>
  onAddNote?: (text: string) => void | Promise<void>
  onEdit?: () => void
  onDelete?: () => void
}

function itemAssignedToRole(item: { responsible_role: string; supporting_roles?: string | null }, role?: string | null) {
  if (!role) return false
  if (item.responsible_role === role) return true
  const supports = (item.supporting_roles || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return supports.includes(role)
}

export function ActivePlanDocument({
  plan,
  caseTitle,
  isProfessional,
  canReport,
  activeRole,
  busyItem,
  busyPlan,
  onReport,
  onValidate,
  onAddNote,
  onEdit,
  onDelete,
}: ActiveDocumentProps) {
  let snapshot: ActionPlanGeneration | null = null
  if (plan.document_json) {
    try {
      snapshot = JSON.parse(plan.document_json) as ActionPlanGeneration
    } catch {
      snapshot = null
    }
  }
  const validated = plan.items.filter((i) => i.status === 'validated').length
  const reported = plan.items.filter((i) => i.status === 'reported_completed').length
  const progressPct = Math.max(0, Math.min(100, Number(plan.validated_progress_pct) || 0))
  const notes = plan.notes ?? []

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-white/15 text-slate-100 shadow-[var(--shadow-glass)]">
      <header className="space-y-4 border-b border-white/10 bg-[rgba(15,32,64,0.55)] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300/80 uppercase">
              Plan de atención y seguimiento DECE
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold tracking-tight text-white">
              {caseTitle || `Caso DECE-${plan.case_id}`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-emerald-400/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/25">
              Activo
            </Badge>
            {isProfessional && onEdit ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                disabled={busyPlan}
                onClick={onEdit}
              >
                Editar plan
              </Button>
            ) : null}
            {isProfessional && onDelete ? (
              <ConfirmButton
                triggerLabel="Eliminar plan"
                title="¿Eliminar este plan activo?"
                description="El plan dejará de estar vigente. Esta acción se registra en auditoría. Podrá crear uno nuevo después."
                confirmLabel="Sí, eliminar"
                variant="destructive"
                className="rounded-xl"
                disabled={busyPlan}
                onConfirm={onDelete}
              />
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-slate-400">Caso</span>
            <p className="font-medium text-slate-100">DECE-{plan.case_id}</p>
          </div>
          <div>
            <span className="text-slate-400">Versión</span>
            <p className="font-medium text-slate-100">{plan.version}</p>
          </div>
          <div>
            <span className="text-slate-400">Próxima revisión</span>
            <p className="font-medium text-slate-100">{plan.review_at_hint || '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Progreso validado</span>
            <p className="font-medium text-slate-100">
              {validated} de {plan.items.length} · {progressPct}%
            </p>
          </div>
        </div>
        {plan.items.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-300">Cumplimiento del plan</span>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                <span className="text-emerald-300">
                  <strong className="tabular-nums">{validated}</strong> validadas
                </span>
                {reported > 0 && (
                  <span className="text-sky-300">
                    <strong className="tabular-nums">{reported}</strong> por validar
                  </span>
                )}
                <span>
                  <strong className="tabular-nums text-white">{progressPct}%</strong> completado
                </span>
              </div>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="space-y-5 px-5 py-5">
        {plan.opening_reason || snapshot?.assessment?.opening_reason ? (
          <Section title="Resumen del caso">
            <p className="text-sm leading-relaxed text-slate-200">
              {plan.opening_reason || snapshot?.assessment?.opening_reason}
            </p>
          </Section>
        ) : null}

        <Section title="Objetivo general">
          <p className="text-sm leading-relaxed text-slate-200">{plan.general_objective}</p>
        </Section>

        <Section title="Acciones operativas">
          {isProfessional ? (
            <p className="mb-3 text-xs text-slate-400">
              Como DECE ves todas las acciones del plan. Solo puedes reportar las asignadas a DECE;
              las de tutor/docente se validan cuando ellos reportan cumplimiento.
            </p>
          ) : null}
          <div className="space-y-3">
            {!plan.items.length ? (
              <p className="text-sm text-slate-400">
                {isProfessional
                  ? 'Este plan no tiene acciones operativas registradas. Edítelo para agregar responsables (tutor, docente o DECE).'
                  : 'No hay acciones asignadas a tu rol en este plan. Si esperabas ver alguna, pide a DECE que revise el responsable de cada acción.'}
              </p>
            ) : null}
            {plan.items.map((item, index) => {
              const overdue = isActionOverdue(item.due_at, item.status)
              const itemNotes = notes.filter((n) => n.item_id === item.id)
              const reportNotes = itemNotes.filter((n) => n.note_kind === 'progress_report')
              const canReportThis =
                canReport && itemAssignedToRole(item, activeRole)
              const accentClass = overdue
                ? 'from-red-500'
                : item.status === 'validated'
                  ? 'from-emerald-500'
                  : item.status === 'reported_completed'
                    ? 'from-sky-400'
                    : 'from-slate-500'
              return (
              <article
                key={item.id}
                className={`relative overflow-hidden rounded-xl border p-4 pl-5 transition-colors ${
                  overdue
                    ? 'border-red-400/40 bg-red-500/10'
                    : item.status === 'validated'
                      ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
                      : 'border-white/15 bg-white/5 hover:bg-white/[0.08]'
                }`}
              >
                <div
                  className={`
                    absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b to-transparent opacity-80
                    ${accentClass}
                  `}
                />
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    Acción {index + 1} — {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={roleBadgeClasses(item.responsible_role)}>
                      {roleLabel(item.responsible_role)}
                    </Badge>
                    <Badge variant="outline" className={itemStatusClasses(item.status)}>
                      {itemStatusLabel(item.status)}
                    </Badge>
                    {overdue ? <Badge variant="destructive">Vencida</Badge> : null}
                    {item.due_at ? (
                      <span className="text-xs text-slate-400">
                        Fecha límite: {formatDueDate(item.due_at)}
                      </span>
                    ) : item.due_hint ? (
                      <span className="text-xs text-slate-400">Plazo: {item.due_hint}</span>
                    ) : null}
                  </div>
                </div>
                {isProfessional ? (
                  <div className="space-y-1 text-sm text-slate-200">
                    <p>{item.objective}</p>
                    {item.rationale ? (
                      <p className="text-xs text-slate-400">Fundamento: {item.rationale}</p>
                    ) : null}
                    {item.expected_result ? (
                      <p className="text-xs text-slate-400">
                        Resultado esperado: {item.expected_result}
                      </p>
                    ) : null}
                    {item.success_indicator ? (
                      <p className="text-xs text-slate-400">
                        Indicador: {item.success_indicator}
                      </p>
                    ) : null}
                    {item.evidence_required ? (
                      <p className="text-xs text-slate-400">Evidencia requerida</p>
                    ) : null}
                  </div>
                ) : null}
                {itemNotes.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-white/15 bg-black/25 p-3">
                    <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      Comentarios de la acción
                    </p>
                    <ul className="space-y-2">
                      {itemNotes.map((n) => (
                        <li key={n.id}>
                          <p className="text-[11px] font-medium text-slate-400">
                            {noteKindLabel(n.note_kind)} · {formatNoteDate(n.created_at)}
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-slate-200">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {canReportThis &&
                  item.status !== 'validated' &&
                  item.status !== 'reported_completed' ? (
                    <ReportProgressDialog
                      itemTitle={item.title}
                      disabled={busyItem === item.id}
                      onSubmit={(note) => onReport(item.id, note)}
                    />
                  ) : null}
                  {isProfessional &&
                  !canReportThis &&
                  item.status !== 'validated' &&
                  item.status !== 'reported_completed' ? (
                    <Badge variant="outline" className="border-white/20 text-slate-300">
                      Pendiente de {roleLabel(item.responsible_role)}
                    </Badge>
                  ) : null}
                  {isProfessional && item.status === 'reported_completed' ? (
                    <ValidateItemDialog
                      itemTitle={item.title}
                      reportNotes={reportNotes}
                      disabled={busyItem === item.id}
                      onSubmit={(approved, comment) => onValidate(item.id, approved, comment)}
                    />
                  ) : null}
                  {item.status === 'reported_completed' && !isProfessional ? (
                    <Badge variant="outline" className="border-sky-400/30 bg-sky-500/15 text-sky-200">
                      Pendiente validación DECE
                    </Badge>
                  ) : null}
                </div>
              </article>
              )
            })}
          </div>
        </Section>

        {isProfessional && plan.review_criteria ? (
          <Section title="Criterios de revisión">
            <p className="text-sm text-slate-200">{plan.review_criteria}</p>
          </Section>
        ) : null}

        {isProfessional && plan.limitations ? (
          <Section title="Limitaciones">
            <p className="whitespace-pre-wrap text-sm text-slate-200">{plan.limitations}</p>
          </Section>
        ) : null}

        {isProfessional && plan.normative_references?.length ? (
          <Section title="Referencias normativas">
            <ul className="space-y-2 text-sm">
              {plan.normative_references.map((ref) => (
                <li
                  key={`${ref.document_code}-${ref.article}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-200"
                >
                  <span className="font-medium text-white">
                    {ref.document_code} · Art. {ref.article}
                  </span>{' '}
                  — {ref.article_title}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {isProfessional ? (
          <Section
            title="Bitácora / Notas de seguimiento"
            action={
              onAddNote ? <AddNoteDialog disabled={busyPlan} onSubmit={onAddNote} /> : null
            }
          >
            {!notes.length ? (
              <p className="text-sm text-slate-400">Aún no hay notas registradas en este plan.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((note: PlanNote) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2"
                  >
                    <p className="text-[11px] font-medium text-slate-400">
                      {noteKindLabel(note.note_kind)}
                      {note.item_id
                        ? ` · Acción: ${
                            plan.items.find((i) => i.id === note.item_id)?.title || `#${note.item_id}`
                          }`
                        : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{note.text}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatNoteDate(note.created_at)}
                      {note.visibility_scope === 'professional' ? ' · Profesional' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  )
}

