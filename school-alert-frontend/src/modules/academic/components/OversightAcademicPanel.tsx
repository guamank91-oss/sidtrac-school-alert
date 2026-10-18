import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BarChart3, ClipboardList, Eye, Loader2, UserCheck, Users } from 'lucide-react'
import { getUser } from '@/modules/auth/lib/session'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ROLE_LABELS } from '@/shared/types/roles'
import { useTermId } from '@/shared/context/PeriodContext'
import { localDateIso } from '@/shared/lib/date'
import { getAcademicOverview, getAttendanceRoster, getGradeRoster, listAssignments } from '../api'
import type { Assignment, AttendanceRosterRow, GradeRosterRow, StudentAcademicSummary } from '../types'
import { ATTENDANCE_COLORS, ATTENDANCE_LABELS } from '../types'
import { formatScore, isLowScore } from '../utils/formatScore'
import { AssignmentPicker } from './AssignmentPicker'
import { StudentAcademicDetailDialog } from './StudentAcademicDetailDialog'

const ALL_COURSES = '__all__'

type OversightTab = 'overview' | 'grades' | 'attendance'

interface OversightAcademicPanelProps {
  readOnlyMessage: string
}

const SELECT_TRIGGER = 'h-9 w-full rounded-xl border-white/10 bg-black/20 text-white'
const FIELD_LABEL = 'text-[11px] font-medium uppercase tracking-wide text-slate-400'

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`
}

function PanelSpinner() {
  return (
    <div className="flex justify-center py-14">
      <Loader2 className="h-7 w-7 animate-spin text-sky-400" />
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: typeof Users; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <Icon className="h-7 w-7 text-slate-500" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm text-red-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  )
}

export function OversightAcademicPanel({ readOnlyMessage }: OversightAcademicPanelProps) {
  const role = getUser()?.active_role
  const termId = useTermId()

  const [tab, setTab] = useState<OversightTab>('overview')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)

  const [courseFilter, setCourseFilter] = useState(ALL_COURSES)
  const [overview, setOverview] = useState<StudentAcademicSummary[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState(false)

  const [assignmentId, setAssignmentId] = useState('')
  const [quarter, setQuarter] = useState('1')
  const [partial, setPartial] = useState('1')
  const [date, setDate] = useState(localDateIso)

  const [grades, setGrades] = useState<GradeRosterRow[]>([])
  const [gradesLoading, setGradesLoading] = useState(false)
  const [gradesError, setGradesError] = useState(false)
  const [attendance, setAttendance] = useState<AttendanceRosterRow[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState(false)

  const [detailStudent, setDetailStudent] = useState<StudentAcademicSummary | null>(null)

  const gradesRequest = useRef(0)
  const attendanceRequest = useRef(0)

  // Asignaciones del periodo (independientes del filtro de curso).
  useEffect(() => {
    let cancelled = false
    setAssignmentsLoading(true)
    listAssignments(termId)
      .then((data) => {
        if (!cancelled) setAssignments(data)
      })
      .catch(() => {
        if (!cancelled) setAssignments([])
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [termId])

  // Resumen por estudiante (se recarga sólo al cambiar curso o periodo).
  useEffect(() => {
    let cancelled = false
    setOverviewLoading(true)
    setOverviewError(false)
    getAcademicOverview(courseFilter !== ALL_COURSES ? Number(courseFilter) : undefined, termId)
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch(() => {
        if (cancelled) return
        setOverview([])
        setOverviewError(true)
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [courseFilter, termId])

  // Mantiene una asignación válida al cambiar de periodo.
  useEffect(() => {
    if (assignments.length === 0) {
      setAssignmentId('')
      return
    }
    if (!assignments.some((a) => String(a.id) === assignmentId)) {
      setAssignmentId(String(assignments[0].id))
    }
  }, [assignments, assignmentId])

  useEffect(() => {
    if (!assignmentId) {
      setGrades([])
      return
    }
    const requestId = ++gradesRequest.current
    setGradesLoading(true)
    setGradesError(false)
    getGradeRoster({ course_subject_id: Number(assignmentId), quarter: Number(quarter), partial: Number(partial) })
      .then((data) => {
        if (requestId === gradesRequest.current) setGrades(data)
      })
      .catch(() => {
        if (requestId !== gradesRequest.current) return
        setGrades([])
        setGradesError(true)
      })
      .finally(() => {
        if (requestId === gradesRequest.current) setGradesLoading(false)
      })
  }, [assignmentId, quarter, partial])

  useEffect(() => {
    if (!assignmentId || !date) {
      setAttendance([])
      return
    }
    const requestId = ++attendanceRequest.current
    setAttendanceLoading(true)
    setAttendanceError(false)
    getAttendanceRoster({ course_subject_id: Number(assignmentId), attendance_date: date })
      .then((data) => {
        if (requestId === attendanceRequest.current) setAttendance(data)
      })
      .catch(() => {
        if (requestId !== attendanceRequest.current) return
        setAttendance([])
        setAttendanceError(true)
      })
      .finally(() => {
        if (requestId === attendanceRequest.current) setAttendanceLoading(false)
      })
  }, [assignmentId, date])

  const courses = useMemo(() => {
    const map = new Map<number, string>()
    for (const a of assignments) map.set(a.course_id, a.course_name)
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [assignments])

  const gradeStats = useMemo(() => {
    const scored = grades.filter((g) => g.score !== null)
    return { scored: scored.length, low: scored.filter((g) => isLowScore(g.score)).length }
  }, [grades])

  const attendanceCounts = useMemo(() => {
    const base = { recorded: 0, ausente: 0, tardanza: 0 }
    for (const a of attendance) {
      if (!a.status) continue
      base.recorded += 1
      if (a.status === 'ausente') base.ausente += 1
      if (a.status === 'tardanza') base.tardanza += 1
    }
    return base
  }, [attendance])

  if (assignmentsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div>
          <p className="text-sm font-semibold text-white">
            Vista de consulta{role ? ` — ${ROLE_LABELS[role]}` : ''}
          </p>
          <p className="text-sm text-slate-400">{readOnlyMessage}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as OversightTab)} className="gap-4">
        <TabsList className="h-12 w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-1.5 shadow-inner sm:w-auto">
          <TabsTrigger value="overview" className="h-full flex-none gap-2 rounded-xl px-4 data-[state=active]:bg-white/10 data-[state=active]:text-violet-300">
            <BarChart3 className="h-4 w-4" />
            Resumen por estudiante
          </TabsTrigger>
          <TabsTrigger value="grades" className="h-full flex-none gap-2 rounded-xl px-4 data-[state=active]:bg-white/10 data-[state=active]:text-sky-400">
            <ClipboardList className="h-4 w-4" />
            Calificaciones
          </TabsTrigger>
          <TabsTrigger value="attendance" className="h-full flex-none gap-2 rounded-xl px-4 data-[state=active]:bg-white/10 data-[state=active]:text-emerald-400">
            <UserCheck className="h-4 w-4" />
            Asistencia
          </TabsTrigger>
        </TabsList>

        {/* ── RESUMEN ── */}
        <TabsContent value="overview">
          <div className="glass-panel overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">Seguimiento académico</h3>
                <p className="mt-0.5 text-sm text-slate-400">
                  Clic en un estudiante para ver todas sus materias de un vistazo
                </p>
              </div>
              {courses.length > 0 && (
                <div className="w-full shrink-0 sm:w-60">
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className={SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_COURSES}>Todos los cursos</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {overviewError && <ErrorBanner message="No se pudo cargar el resumen académico." />}

            {overviewLoading ? (
              <PanelSpinner />
            ) : overview.length === 0 ? (
              !overviewError && <EmptyState icon={BarChart3} message="Sin datos académicos registrados." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/30 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3">Estudiante</th>
                      <th className="px-3 py-3">Curso</th>
                      <th className="px-3 py-3 text-center">Promedio</th>
                      <th className="px-3 py-3 text-center">Ausencias</th>
                      <th className="px-5 py-3 text-center">Tardanzas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.map((s) => {
                      const low = isLowScore(s.average_score)
                      return (
                        <tr
                          key={s.student_id}
                          tabIndex={0}
                          className="group cursor-pointer border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/5 focus-visible:bg-white/10 focus-visible:outline-none"
                          onClick={() => setDetailStudent(s)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setDetailStudent(s)
                            }
                          }}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 text-xs font-semibold text-sky-300">
                                {initials(s.first_name, s.last_name)}
                              </div>
                              <span className="font-medium text-white transition-colors group-hover:text-sky-300">
                                {s.first_name} {s.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-400">{s.course_name}</td>
                          <td className="px-3 py-3 text-center">
                            {s.average_score !== null && s.average_score !== '' ? (
                              <span
                                className={cn(
                                  'inline-flex min-w-[3.5rem] justify-center rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums',
                                  low
                                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                                )}
                              >
                                {formatScore(s.average_score)}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className={cn('px-3 py-3 text-center tabular-nums', s.absence_count > 0 ? 'text-rose-300' : 'text-slate-500')}>
                            {s.absence_count}
                          </td>
                          <td className={cn('px-5 py-3 text-center tabular-nums', s.tardy_count > 0 ? 'text-amber-300' : 'text-slate-500')}>
                            {s.tardy_count}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── CALIFICACIONES ── */}
        <TabsContent value="grades">
          <div className="glass-panel overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-white/10 bg-black/20 px-5 py-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <AssignmentPicker assignments={assignments} value={assignmentId} onChange={setAssignmentId} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-64">
                <div className="space-y-1.5">
                  <p className={FIELD_LABEL}>Quimestre</p>
                  <Select value={quarter} onValueChange={setQuarter}>
                    <SelectTrigger className={SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1° Q</SelectItem>
                      <SelectItem value="2">2° Q</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className={FIELD_LABEL}>Parcial</p>
                  <Select value={partial} onValueChange={setPartial}>
                    <SelectTrigger className={SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1° P</SelectItem>
                      <SelectItem value="2">2° P</SelectItem>
                      <SelectItem value="3">3° P</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {grades.length > 0 && !gradesLoading && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-white/5 px-5 py-2 text-xs text-slate-400">
                <span>
                  <span className="font-semibold text-white tabular-nums">{gradeStats.scored}</span> / {grades.length} con nota
                </span>
                {gradeStats.low > 0 && (
                  <span className="text-amber-300">
                    <span className="font-semibold tabular-nums">{gradeStats.low}</span> bajo 7
                  </span>
                )}
              </div>
            )}

            {gradesError && <ErrorBanner message="No se pudieron cargar las calificaciones." />}

            {!assignmentId ? (
              <EmptyState icon={ClipboardList} message="No hay asignaciones disponibles en este periodo." />
            ) : gradesLoading ? (
              <PanelSpinner />
            ) : grades.length === 0 ? (
              !gradesError && <EmptyState icon={Users} message="No hay estudiantes en este paralelo." />
            ) : (
              <ul>
                {grades.map((g) => {
                  const low = isLowScore(g.score)
                  return (
                    <li
                      key={g.student_id}
                      className="flex items-center gap-3 border-b border-white/5 px-5 py-3 transition-colors last:border-b-0 hover:bg-white/5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 text-xs font-semibold text-sky-300">
                        {initials(g.first_name, g.last_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {g.last_name} {g.first_name}
                        </p>
                        {g.notes && <p className="truncate text-xs text-slate-500">{g.notes}</p>}
                      </div>
                      {low && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-label="Nota bajo el umbral" />}
                      <span
                        className={cn(
                          'inline-flex min-w-[3.5rem] justify-center rounded-md border px-2 py-0.5 text-sm font-bold tabular-nums',
                          g.score === null
                            ? 'border-white/10 bg-white/5 text-slate-500'
                            : low
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                              : 'border-white/10 bg-black/20 text-white',
                        )}
                      >
                        {formatScore(g.score)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ── ASISTENCIA ── */}
        <TabsContent value="attendance">
          <div className="glass-panel overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <AssignmentPicker assignments={assignments} value={assignmentId} onChange={setAssignmentId} />
              </div>
              <div className="w-full shrink-0 space-y-1.5 sm:w-48">
                <p className={FIELD_LABEL}>Fecha</p>
                <Input
                  type="date"
                  value={date}
                  max={localDateIso()}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="h-9 rounded-xl border-white/10 bg-black/20 text-white [color-scheme:dark]"
                />
              </div>
            </div>

            {attendance.length > 0 && !attendanceLoading && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-white/5 px-5 py-2 text-xs text-slate-400">
                <span>
                  <span className="font-semibold text-white tabular-nums">{attendanceCounts.recorded}</span> / {attendance.length} registrados
                </span>
                {attendanceCounts.ausente > 0 && (
                  <span className="text-rose-300">
                    <span className="font-semibold tabular-nums">{attendanceCounts.ausente}</span> ausentes
                  </span>
                )}
                {attendanceCounts.tardanza > 0 && (
                  <span className="text-amber-300">
                    <span className="font-semibold tabular-nums">{attendanceCounts.tardanza}</span> tardanzas
                  </span>
                )}
              </div>
            )}

            {attendanceError && <ErrorBanner message="No se pudo cargar la asistencia." />}

            {!assignmentId ? (
              <EmptyState icon={UserCheck} message="No hay asignaciones disponibles en este periodo." />
            ) : attendanceLoading ? (
              <PanelSpinner />
            ) : attendance.length === 0 ? (
              !attendanceError && <EmptyState icon={Users} message="No hay estudiantes en este paralelo." />
            ) : (
              <ul>
                {attendance.map((a) => (
                  <li
                    key={a.student_id}
                    className="flex items-center gap-3 border-b border-white/5 px-5 py-3 transition-colors last:border-b-0 hover:bg-white/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/10 text-xs font-semibold text-sky-300">
                      {initials(a.first_name, a.last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {a.last_name} {a.first_name}
                      </p>
                      {a.notes && <p className="truncate text-xs text-slate-500">{a.notes}</p>}
                    </div>
                    <span
                      className={cn(
                        'rounded-md border px-2.5 py-0.5 text-xs font-semibold',
                        a.status ? ATTENDANCE_COLORS[a.status] : 'border-white/10 bg-white/5 text-slate-500',
                      )}
                    >
                      {a.status ? ATTENDANCE_LABELS[a.status] : 'Sin registro'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <StudentAcademicDetailDialog
        studentId={detailStudent?.student_id ?? null}
        studentName={detailStudent ? `${detailStudent.first_name} ${detailStudent.last_name}` : ''}
        courseName={detailStudent?.course_name}
        open={detailStudent !== null}
        onOpenChange={(open) => !open && setDetailStudent(null)}
      />
    </div>
  )
}
