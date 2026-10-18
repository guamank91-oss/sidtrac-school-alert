import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, ClipboardList, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getGradeRoster, saveGrades } from '../api'
import type { Assignment, GradeRosterRow } from '../types'
import { AssignmentPicker } from './AssignmentPicker'
import { UnsavedChangesDialog, useUnsavedChangesGuard } from './UnsavedChangesGuard'

const LOW_GRADE = 7

interface TeacherGradesPanelProps {
  assignments: Assignment[]
  /** Asignación seleccionada (compartida con la pestaña de asistencia). */
  assignmentId: string
  onAssignmentChange: (assignmentId: string) => void
  /** Notifica a la página si existen ediciones sin guardar. */
  onDirtyChange?: (dirty: boolean) => void
}

function hasValidScore(score: number | null | undefined): score is number {
  return score !== null && score !== undefined && !Number.isNaN(score)
}

export function TeacherGradesPanel({
  assignments,
  assignmentId,
  onAssignmentChange,
  onDirtyChange,
}: TeacherGradesPanelProps) {
  const [quarter, setQuarter] = useState('1')
  const [partial, setPartial] = useState('1')
  const [rows, setRows] = useState<GradeRosterRow[]>([])
  const [baseline, setBaseline] = useState<GradeRosterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const scoreRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const requestRef = useRef(0)

  const loadRoster = useCallback(async () => {
    if (!assignmentId) return
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const data = await getGradeRoster({
        course_subject_id: Number(assignmentId),
        quarter: Number(quarter),
        partial: Number(partial),
      })
      if (requestId !== requestRef.current) return
      setRows(data)
      setBaseline(data)
    } catch {
      if (requestId !== requestRef.current) return
      setRows([])
      setBaseline([])
      setError('No se pudo cargar el listado de calificaciones')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [assignmentId, quarter, partial])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  const filledCount = useMemo(() => rows.filter((r) => hasValidScore(r.score)).length, [rows])

  const dirty = useMemo(() => {
    if (rows.length !== baseline.length) return true
    return rows.some((row, i) => {
      const b = baseline[i]
      return row.score !== b?.score || (row.notes ?? '') !== (b?.notes ?? '')
    })
  }, [rows, baseline])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const { guard, dialogProps } = useUnsavedChangesGuard(dirty)

  const focusScore = (index: number) => {
    const id = rows[index]?.student_id
    if (id == null) return
    const el = scoreRefs.current.get(id)
    el?.focus()
    el?.select()
  }

  const updateRow = (studentId: number, patch: Partial<GradeRosterRow>) => {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)))
    setSuccess(null)
  }

  const updateScore = (studentId: number, raw: string) => {
    if (raw === '') {
      updateRow(studentId, { score: null })
      return
    }
    const value = Number(raw)
    if (Number.isNaN(value) || value < 0 || value > 10) return
    updateRow(studentId, { score: value })
  }

  const onScoreKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusScore(Math.min(index + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusScore(Math.max(index - 1, 0))
    }
  }

  const handleSave = async () => {
    if (!assignmentId) return
    const grades = rows
      .filter((r) => hasValidScore(r.score))
      .map((r) => ({ student_id: r.student_id, score: r.score as number, notes: r.notes }))
    if (grades.length === 0) {
      setError('Ingrese al menos una nota')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await saveGrades({
        course_subject_id: Number(assignmentId),
        quarter: Number(quarter),
        partial: Number(partial),
        grades,
      })
      setRows(updated)
      setBaseline(updated)
      setSuccess('Calificaciones guardadas')
    } catch {
      setError('No se pudieron guardar las calificaciones')
    } finally {
      setSaving(false)
    }
  }

  const controlsDisabled = saving

  return (
    <div className="glass-panel overflow-clip rounded-3xl border border-white/10 shadow-2xl">
      <div className="sticky top-0 z-10 space-y-3 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <AssignmentPicker
              assignments={assignments}
              value={assignmentId}
              onChange={onAssignmentChange}
              editableOnly
              disabled={controlsDisabled}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Quimestre</p>
              <Select
                value={quarter}
                onValueChange={(v) => guard(() => setQuarter(v))}
                disabled={controlsDisabled}
              >
                <SelectTrigger className="h-9 w-[7.5rem] rounded-xl border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1° Q</SelectItem>
                  <SelectItem value="2">2° Q</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Parcial</p>
              <Select
                value={partial}
                onValueChange={(v) => guard(() => setPartial(v))}
                disabled={controlsDisabled}
              >
                <SelectTrigger className="h-9 w-[7.5rem] rounded-xl border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1° P</SelectItem>
                  <SelectItem value="2">2° P</SelectItem>
                  <SelectItem value="3">3° P</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-9 min-w-[9.5rem] rounded-xl border-0 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500"
              onClick={() => void handleSave()}
              disabled={saving || loading || !dirty || filledCount === 0}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="tabular-nums text-slate-300">
            <span className="font-semibold text-white">{filledCount}</span>
            <span className="text-slate-500"> / {rows.length}</span>
            <span className="ml-1.5 text-slate-400">con nota</span>
          </span>
          {dirty && (
            <span className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
              Sin guardar
            </span>
          )}
          {success && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
              <Check className="h-3.5 w-3.5" />
              {success}
            </span>
          )}
          <span className="ml-auto hidden text-xs text-slate-500 sm:inline">Enter o ↓ pasa al siguiente</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 sm:px-5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <ClipboardList className="h-7 w-7 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400">No hay estudiantes en este paralelo.</p>
        </div>
      ) : (
        <ul>
          <li className="hidden grid-cols-[2rem_minmax(0,1fr)_6.5rem_minmax(8rem,1fr)] gap-4 border-b border-white/10 bg-black/20 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid">
            <span>#</span>
            <span>Estudiante</span>
            <span className="text-center">Nota</span>
            <span>Observación</span>
          </li>
          {rows.map((row, index) => {
            const low = hasValidScore(row.score) && row.score < LOW_GRADE
            return (
              <li
                key={row.student_id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_6.5rem] items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/5 sm:grid-cols-[2rem_minmax(0,1fr)_6.5rem_minmax(8rem,1fr)] sm:gap-4 sm:px-5"
              >
                <span className="text-xs font-medium tabular-nums text-slate-500">{index + 1}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 text-xs font-semibold text-sky-300 sm:flex">
                    {row.first_name.charAt(0)}
                    {row.last_name.charAt(0)}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-100">
                    {row.last_name} {row.first_name}
                  </span>
                  {low && (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-label="Nota bajo el umbral" />
                  )}
                </div>
                <Input
                  ref={(el) => {
                    if (el) scoreRefs.current.set(row.student_id, el)
                    else scoreRefs.current.delete(row.student_id)
                  }}
                  type="number"
                  min={0}
                  max={10}
                  step={0.01}
                  inputMode="decimal"
                  disabled={controlsDisabled}
                  aria-label={`Nota de ${row.first_name} ${row.last_name}`}
                  className={cn(
                    'h-12 w-[6.5rem] rounded-xl border-white/10 bg-black/20 px-2 text-center text-lg font-bold tabular-nums text-white transition-all focus-visible:border-sky-400 focus-visible:bg-black/40 md:h-10 md:text-base',
                    low &&
                      'border-amber-400/50 bg-amber-500/10 text-amber-200 focus-visible:border-amber-400 focus-visible:ring-amber-400/30',
                  )}
                  value={row.score ?? ''}
                  onChange={(e) => updateScore(row.student_id, e.target.value)}
                  onKeyDown={(e) => onScoreKeyDown(index, e)}
                />
                <Input
                  placeholder="Observación opcional"
                  disabled={controlsDisabled}
                  className="col-span-3 h-10 rounded-xl border-white/10 bg-white/5 text-white transition-all focus-visible:bg-white/10 sm:col-span-1"
                  value={row.notes ?? ''}
                  onChange={(e) => updateRow(row.student_id, { notes: e.target.value })}
                />
              </li>
            )
          })}
        </ul>
      )}

      <UnsavedChangesDialog {...dialogProps} />
    </div>
  )
}
