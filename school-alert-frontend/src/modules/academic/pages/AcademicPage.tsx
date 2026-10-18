import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, ClipboardList, Loader2, Lock, RefreshCw, UserCheck } from 'lucide-react'
import { getUser } from '@/modules/auth/lib/session'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE_LABELS } from '@/shared/types/roles'
import { useTermId } from '@/shared/context/PeriodContext'
import { listAssignments } from '../api'
import type { Assignment } from '../types'
import { OversightAcademicPanel } from '../components/OversightAcademicPanel'
import { TeacherAttendancePanel } from '../components/TeacherAttendancePanel'
import { TeacherGradesPanel } from '../components/TeacherGradesPanel'
import { UnsavedChangesDialog, useUnsavedChangesGuard } from '../components/UnsavedChangesGuard'

type AcademicTab = 'grades' | 'attendance'
type LoadStatus = 'loading' | 'ready' | 'error'

const ROLE_INTRO: Record<string, string> = {
  docente: 'Registre calificaciones y asistencia solo en las materias que tiene asignadas.',
  tutor: 'Consulte el rendimiento académico de los estudiantes de su curso.',
  administrador: 'Supervise calificaciones y asistencia de toda la institución (solo lectura).',
  dece: 'Revise indicadores académicos para el seguimiento integral de cada estudiante.',
}

function parseTab(value: string | null): AcademicTab {
  return value === 'attendance' ? 'attendance' : 'grades'
}

export function AcademicPage() {
  const role = getUser()?.active_role ?? 'docente'

  return (
    <div className="space-y-6">
      <div className="glass-panel relative animate-slide-up overflow-hidden rounded-3xl border border-white/10 p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-sky-500/10" aria-hidden />
        <div className="relative z-10">
          <h1 className="flex items-center gap-3 font-display text-2xl font-bold text-white sm:text-3xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner">
              <BookOpen className="h-6 w-6 text-emerald-400" />
            </div>
            Gestión Académica
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            <span className="mr-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-sky-300">
              {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
            </span>
            {ROLE_INTRO[role] ?? 'Consulta académica institucional.'}
          </p>
        </div>
      </div>

      {role === 'docente' ? (
        <TeacherAcademicWorkspace />
      ) : role === 'tutor' ? (
        <OversightAcademicPanel readOnlyMessage="Como tutor ve el promedio, ausencias y tardanzas de su curso. No puede modificar registros." />
      ) : role === 'administrador' || role === 'dece' ? (
        <OversightAcademicPanel readOnlyMessage="Puede consultar toda la información académica. La edición corresponde a cada docente en sus materias." />
      ) : (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-3xl border border-white/10 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Lock className="h-7 w-7 text-slate-500" />
          </div>
          <p className="text-sm text-slate-400">Su rol no tiene acceso al módulo académico.</p>
        </div>
      )}
    </div>
  )
}

/**
 * Espacio de trabajo del docente.
 * - La pestaña y la materia viven en la URL (?tab=…&assignment=…): se conservan al
 *   cambiar de pestaña, al recargar y al llegar desde el dashboard.
 * - Ambas pestañas permanecen montadas para no perder quimestre/parcial/fecha ni
 *   ediciones sin guardar al alternar entre ellas.
 */
function TeacherAcademicWorkspace() {
  const termId = useTermId()
  const [searchParams, setSearchParams] = useSearchParams()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [reloadToken, setReloadToken] = useState(0)
  const [dirty, setDirty] = useState<Record<AcademicTab, boolean>>({ grades: false, attendance: false })

  const activeTab = parseTab(searchParams.get('tab'))
  const requestedAssignment = searchParams.get('assignment') ?? ''

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    listAssignments(termId)
      .then((data) => {
        if (cancelled) return
        setAssignments(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setAssignments([])
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [termId, reloadToken])

  const editable = useMemo(() => assignments.filter((a) => a.can_edit), [assignments])

  /** Materia efectiva: la de la URL si es válida; si no, la primera editable. */
  const assignmentId = useMemo(() => {
    if (editable.some((a) => String(a.id) === requestedAssignment)) return requestedAssignment
    return editable[0] ? String(editable[0].id) : ''
  }, [editable, requestedAssignment])

  const updateParams = useCallback(
    (patch: Partial<Record<'tab' | 'assignment', string>>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const hasUnsavedChanges = dirty.grades || dirty.attendance
  const { guard, dialogProps } = useUnsavedChangesGuard(hasUnsavedChanges)

  const handleAssignmentChange = useCallback(
    (next: string) => {
      if (next === assignmentId) return
      guard(() => updateParams({ assignment: next }))
    },
    [assignmentId, guard, updateParams],
  )

  const onGradesDirty = useCallback(
    (value: boolean) => setDirty((prev) => (prev.grades === value ? prev : { ...prev, grades: value })),
    [],
  )
  const onAttendanceDirty = useCallback(
    (value: boolean) => setDirty((prev) => (prev.attendance === value ? prev : { ...prev, attendance: value })),
    [],
  )

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="glass-panel flex flex-col items-center gap-4 rounded-3xl border border-red-500/20 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-sm text-slate-300">No se pudieron cargar sus materias asignadas.</p>
        <Button
          variant="outline"
          className="rounded-xl border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          onClick={() => setReloadToken((n) => n + 1)}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  if (editable.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-3xl border border-white/10 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ClipboardList className="h-7 w-7 text-slate-500" />
        </div>
        <p className="max-w-md text-sm text-slate-400">
          No tiene materias asignadas en este periodo. El administrador debe vincularlas en Configuración.
        </p>
      </div>
    )
  }

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(value) => updateParams({ tab: parseTab(value) })}
        className="animate-slide-up gap-4"
        style={{ animationDelay: '100ms' }}
      >
        <TabsList className="h-12 w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-1.5 shadow-inner sm:w-auto">
          <TabsTrigger
            value="grades"
            className="h-full flex-none gap-2 rounded-xl px-5 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-sky-400 data-[state=active]:shadow-lg"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="font-medium">Calificaciones</span>
            {dirty.grades && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Cambios sin guardar" />}
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="h-full flex-none gap-2 rounded-xl px-5 transition-all data-[state=active]:bg-white/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-lg"
          >
            <UserCheck className="h-5 w-5" />
            <span className="font-medium">Asistencia</span>
            {dirty.attendance && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="Cambios sin guardar" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grades" forceMount className="data-[state=inactive]:hidden">
          <TeacherGradesPanel
            assignments={assignments}
            assignmentId={assignmentId}
            onAssignmentChange={handleAssignmentChange}
            onDirtyChange={onGradesDirty}
          />
        </TabsContent>
        <TabsContent value="attendance" forceMount className="data-[state=inactive]:hidden">
          <TeacherAttendancePanel
            assignments={assignments}
            assignmentId={assignmentId}
            onAssignmentChange={handleAssignmentChange}
            onDirtyChange={onAttendanceDirty}
          />
        </TabsContent>
      </Tabs>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  )
}
