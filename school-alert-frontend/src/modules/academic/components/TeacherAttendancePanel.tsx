import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Save, UserCheck, Users, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { localDateIso } from '@/shared/lib/date'
import { getAttendanceRoster, saveAttendance } from '../api'
import type { Assignment, AttendanceRosterRow, AttendanceStatus } from '../types'
import { ATTENDANCE_COLORS, ATTENDANCE_LABELS } from '../types'
import { AssignmentPicker } from './AssignmentPicker'
import { UnsavedChangesDialog, useUnsavedChangesGuard } from './UnsavedChangesGuard'

const STATUSES: AttendanceStatus[] = ['presente', 'ausente', 'tardanza', 'justificado']

const STATUS_SHORT: Record<AttendanceStatus, string> = {
  presente: 'P',
  ausente: 'A',
  tardanza: 'T',
  justificado: 'J',
}

function withDefaultPresent(rows: AttendanceRosterRow[]): AttendanceRosterRow[] {
  return rows.map((r) => ({ ...r, status: r.status ?? 'presente' }))
}

interface TeacherAttendancePanelProps {
  assignments: Assignment[]
  /** Asignación seleccionada (compartida con la pestaña de calificaciones). */
  assignmentId: string
  onAssignmentChange: (assignmentId: string) => void
  /** Notifica a la página si existen ediciones sin guardar. */
  onDirtyChange?: (dirty: boolean) => void
}

export function TeacherAttendancePanel({
  assignments,
  assignmentId,
  onAssignmentChange,
  onDirtyChange,
}: TeacherAttendancePanelProps) {
  const [date, setDate] = useState(localDateIso)
  const [rows, setRows] = useState<AttendanceRosterRow[]>([])
  const [baseline, setBaseline] = useState<AttendanceRosterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const requestRef = useRef(0)
  const maxDate = localDateIso()

  const loadRoster = useCallback(async () => {
    if (!assignmentId || !date) return
    const requestId = ++requestRef.current
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const data = await getAttendanceRoster({
        course_subject_id: Number(assignmentId),
        attendance_date: date,
      })
      if (requestId !== requestRef.current) return
      const normalized = withDefaultPresent(data)
      setRows(normalized)
      setBaseline(normalized)
    } catch {
      if (requestId !== requestRef.current) return
      setRows([])
      setBaseline([])
      setError('No se pudo cargar la asistencia')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [assignmentId, date])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  const counts = useMemo(() => {
    const base: Record<AttendanceStatus, number> = { presente: 0, ausente: 0, tardanza: 0, justificado: 0 }
    for (const r of rows) {
      if (r.status) base[r.status] += 1
    }
    return base
  }, [rows])

  /** El día aún no tiene registros guardados (se precarga "presente" para agilizar). */
  const unrecorded = useMemo(() => rows.some((r) => r.attendance_id == null), [rows])

  /** Ediciones reales del docente respecto a lo cargado. */
  const edited = useMemo(() => {
    if (rows.length !== baseline.length) return true
    return rows.some((row, i) => {
      const b = baseline[i]
      return row.status !== b?.status || (row.notes ?? '') !== (b?.notes ?? '')
    })
  }, [rows, baseline])

  const canSave = edited || unrecorded

  useEffect(() => {
    onDirtyChange?.(edited)
  }, [edited, onDirtyChange])

  const { guard, dialogProps } = useUnsavedChangesGuard(edited)

  const updateRow = (studentId: number, patch: Partial<AttendanceRosterRow>) => {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)))
    setSuccess(null)
  }

  const markAll = (status: AttendanceStatus) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })))
    setSuccess(null)
  }

  const handleDateChange = (value: string) => {
    if (!value || value === date) return
    guard(() => setDate(value))
  }

  const handleSave = async () => {
    if (!assignmentId) return
    const records = rows
      .filter((r): r is AttendanceRosterRow & { status: AttendanceStatus } => r.status !== null)
      .map((r) => ({ student_id: r.student_id, status: r.status, notes: r.notes }))
    if (records.length === 0) {
      setError('Marque la asistencia de al menos un estudiante')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await saveAttendance({
        course_subject_id: Number(assignmentId),
        attendance_date: date,
        records,
      })
      const normalized = withDefaultPresent(updated)
      setRows(normalized)
      setBaseline(normalized)
      setSuccess('Asistencia guardada')
    } catch {
      setError('No se pudo guardar la asistencia')
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
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Fecha</p>
              <Input
                type="date"
                value={date}
                max={maxDate}
                disabled={controlsDisabled}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-9 w-[11rem] rounded-xl border-white/10 bg-black/20 text-white [color-scheme:dark]"
              />
            </div>
            <Button
              className="h-9 min-w-[9.5rem] rounded-xl border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500"
              onClick={() => void handleSave()}
              disabled={saving || loading || !canSave || rows.length === 0}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
            onClick={() => markAll('presente')}
            disabled={loading || controlsDisabled || rows.length === 0}
          >
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
            Todos presentes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            onClick={() => markAll('ausente')}
            disabled={loading || controlsDisabled || rows.length === 0}
          >
            <UserX className="mr-1.5 h-3.5 w-3.5" />
            Todos ausentes
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
            {STATUSES.map((status) => (
              <span
                key={status}
                title={ATTENDANCE_LABELS[status]}
                className={cn('rounded-md border px-2 py-0.5 tabular-nums', ATTENDANCE_COLORS[status])}
              >
                {STATUS_SHORT[status]} {counts[status]}
              </span>
            ))}
            {edited ? (
              <span className="rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                Sin guardar
              </span>
            ) : unrecorded && rows.length > 0 ? (
              <span className="rounded-md border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-sky-200">
                Día sin registrar
              </span>
            ) : null}
            {success && !edited && (
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                {success}
              </span>
            )}
          </div>
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
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Users className="h-7 w-7 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400">No hay estudiantes en este paralelo.</p>
        </div>
      ) : (
        <ul>
          {rows.map((row, index) => {
            const needsNote = row.status === 'ausente' || row.status === 'justificado'
            return (
              <li
                key={row.student_id}
                className="flex flex-col gap-2.5 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3 sm:w-64 sm:shrink-0">
                  <span className="w-5 text-xs font-medium tabular-nums text-slate-500">{index + 1}</span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 text-xs font-semibold text-sky-300">
                    {row.first_name.charAt(0)}
                    {row.last_name.charAt(0)}
                  </div>
                  <span className="truncate text-sm font-medium text-slate-100">
                    {row.last_name} {row.first_name}
                  </span>
                </div>

                <div className="grid flex-1 grid-cols-4 gap-2 sm:max-w-md" role="radiogroup" aria-label={`Asistencia de ${row.first_name} ${row.last_name}`}>
                  {STATUSES.map((status) => {
                    const active = row.status === status
                    return (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={controlsDisabled}
                        onClick={() => updateRow(row.student_id, { status })}
                        className={cn(
                          'flex h-12 items-center justify-center rounded-xl border text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-60 sm:h-10',
                          active
                            ? cn(ATTENDANCE_COLORS[status], 'ring-2 ring-white/20 shadow-[0_0_15px_rgba(255,255,255,0.12)]')
                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/15 hover:text-slate-200',
                        )}
                        title={ATTENDANCE_LABELS[status]}
                      >
                        <span className="sm:hidden">{STATUS_SHORT[status]}</span>
                        <span className="hidden sm:inline">{ATTENDANCE_LABELS[status]}</span>
                      </button>
                    )
                  })}
                </div>

                {(needsNote || (row.notes ?? '').length > 0) && (
                  <Input
                    placeholder={row.status === 'ausente' ? 'Motivo (opcional)' : 'Nota opcional'}
                    disabled={controlsDisabled}
                    className="h-9 w-full rounded-xl border-white/10 bg-white/5 text-white sm:max-w-[14rem]"
                    value={row.notes ?? ''}
                    onChange={(e) => updateRow(row.student_id, { notes: e.target.value })}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <UnsavedChangesDialog {...dialogProps} />
    </div>
  )
}
