import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GraduationCap, Loader2, Pencil, Plus, Search, Users, FileSpreadsheet } from 'lucide-react'
import { getUser, canManageStudents } from '@/modules/auth/lib/session'
import { BulkImportModal } from '@/modules/students/components/BulkImportModal'
import { listCourses, listUsersByRole } from '@/modules/institution/api'
import type { BasicUser, Course } from '@/modules/institution/types'
import { usePeriod } from '@/shared/context/PeriodContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listStudents, updateStudent } from '../api'
import { EMPTY_STUDENT_FORM, StudentFormDialog } from '../components/StudentFormDialog'
import { StudentProfileDialog } from '../components/StudentProfileDialog'
import type { StudentRecord } from '../types'
import { RISK_LABELS, toUiStudent } from '../utils/mapStudent'
import { getRiskBadge } from '../utils/risk'
import type { RiskLevel } from '@/shared/types/roles'

const EMPTY_FORM = EMPTY_STUDENT_FORM

const ALL_RISK = '__all__' as const
const ALL_COURSES = '__all__' as const
type StatusFilter = 'activo' | 'inactivo'

export function StudentsPage() {
  const sessionUser = getUser()
  const { selectedTermId, isViewingActiveTerm } = usePeriod()
  const institutionId = sessionUser?.institution_id
  const canManage = canManageStudents()
  const [searchParams] = useSearchParams()

  const profileStudentId = searchParams.get('profile') === '1' ? searchParams.get('student') : null
  const profileTab =
    searchParams.get('tab') === 'interventions' ? 'interventions' : 'overview'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const [students, setStudents] = useState<StudentRecord[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [tutors, setTutors] = useState<BasicUser[]>([])
  const [guardians, setGuardians] = useState<BasicUser[]>([])

  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState<string>(ALL_COURSES)
  const [filterRisk, setFilterRisk] = useState<string>(ALL_RISK)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('activo')
  const [editing, setEditing] = useState<StudentRecord | null>(null)
  const [deactivating, setDeactivating] = useState<StudentRecord | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM, status: 'activo' as 'activo' | 'inactivo' })

  const loadReferenceData = useCallback(async () => {
    if (!institutionId || !selectedTermId) return
    const [courseList, tutorList, guardianList] = await Promise.all([
      listCourses(institutionId, selectedTermId),
      listUsersByRole('tutor', institutionId),
      listUsersByRole('representante', institutionId),
    ])
    setCourses(courseList)
    setTutors(tutorList)
    setGuardians(guardianList)
  }, [institutionId, selectedTermId])

  const loadStudents = useCallback(async () => {
    if (!institutionId || !selectedTermId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listStudents({
        institution_id: institutionId,
        term_id: selectedTermId,
        search: search.trim() || undefined,
        course_id: filterCourse !== ALL_COURSES ? Number(filterCourse) : undefined,
        risk_level: filterRisk !== ALL_RISK ? (filterRisk as RiskLevel) : undefined,
        status: filterStatus,
      })
      setStudents(data)
    } catch {
      setError('No se pudo cargar los estudiantes')
    } finally {
      setLoading(false)
    }
  }, [institutionId, selectedTermId, search, filterCourse, filterRisk, filterStatus])

  useEffect(() => {
    setFilterCourse(ALL_COURSES)
  }, [selectedTermId])

  useEffect(() => {
    void loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    const timer = setTimeout(() => void loadStudents(), 250)
    return () => clearTimeout(timer)
  }, [loadStudents])

  const openEdit = (student: StudentRecord) => {
    setEditing(student)
    setEditForm({
      first_name: student.first_name,
      last_name: student.last_name,
      national_id: student.national_id ?? '',
      birth_date: student.birth_date ?? '',
      gender: student.gender ?? '',
      course_id: String(student.course_id),
      guardian_id: student.guardian_id ? String(student.guardian_id) : '',
      status: student.status === 'retirado' ? 'inactivo' : student.status,
    })
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!editForm.guardian_id) {
      setError('Debe seleccionar un representante para el estudiante')
      setSuccess(null)
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateStudent(editing.id, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        national_id: editForm.national_id || null,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        course_id: Number(editForm.course_id),
        guardian_id: editForm.guardian_id ? Number(editForm.guardian_id) : null,
        status: editForm.status,
      })
      setEditing(null)
      setSuccess('Estudiante actualizado')
      await loadStudents()
    } catch {
      setError('No se pudo actualizar el estudiante')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivating) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateStudent(deactivating.id, { status: 'inactivo' })
      setDeactivating(null)
      setSuccess(`${deactivating.first_name} ${deactivating.last_name} fue desactivado`)
      await loadStudents()
    } catch {
      setError('No se pudo desactivar el estudiante')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (student: StudentRecord) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateStudent(student.id, { status: 'activo' })
      setSuccess(`${student.first_name} ${student.last_name} fue activado`)
      await loadStudents()
    } catch {
      setError('No se pudo activar el estudiante')
    } finally {
      setSaving(false)
    }
  }

  const riskStats = useMemo(() => {
    const counts = { bajo: 0, medio: 0, alto: 0, critico: 0 }
    for (const s of students) counts[s.current_risk_level] += 1
    return counts
  }, [students])

  if (!institutionId) {
    return <p className="text-muted-foreground">Sesión sin institución asociada.</p>
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-indigo-500/10" aria-hidden />
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Users className="h-6 w-6 text-sky-400" />
            </div>
            Gestión de Estudiantes
          </h1>
          <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-2xl">
            Registro y seguimiento del plantel. Filtre por curso o riesgo en tiempo real.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <Card className="glass-panel group card-hover relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {filterStatus === 'activo' ? 'Estudiantes Activos' : 'Estudiantes Inactivos'}
              </p>
              <p className="text-3xl font-display font-bold mt-1 text-sky-400">{students.length}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-500/10 flex items-center justify-center border border-sky-500/20 group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6 text-sky-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel group card-hover relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Riesgo Medio/Alto</p>
              <p className="text-3xl font-display font-bold mt-1 text-rose-400">
                {riskStats.medio + riskStats.alto + riskStats.critico}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="h-6 w-6 text-rose-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel group card-hover relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cursos Activos</p>
              <p className="text-3xl font-display font-bold mt-1 text-violet-400">
                {new Set(students.map((s) => s.course_id)).size}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-6 w-6 text-violet-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel group card-hover relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-6 flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Cursos</p>
              <p className="text-3xl font-display font-bold mt-1 text-emerald-400">{courses.length}</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <GraduationCap className="h-6 w-6 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {canManage && isViewingActiveTerm && (
        <StudentFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          institutionId={institutionId}
          courses={courses}
          tutors={tutors}
          guardians={guardians}
          onSuccess={(msg) => {
            setSuccess(msg)
            setError(null)
            void loadStudents()
          }}
          onGuardiansChanged={loadReferenceData}
        />
      )}

      <Card className="glass-panel border-white/10 shadow-xl overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 bg-black/20 pb-4">
          <CardTitle className="text-lg font-display">Directorio de Estudiantes</CardTitle>
          {canManage && isViewingActiveTerm && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2 font-semibold border-white/20 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
                <FileSpreadsheet className="h-4 w-4" />
                Importar Excel
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/25">
                <Plus className="h-4 w-4" />
                Nuevo estudiante
              </Button>
            </div>
          )}
        </CardHeader>

        <BulkImportModal
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          onSuccess={() => void loadStudents()}
        />
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center p-4 bg-black/10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9 border-white/10 bg-white/5 focus-visible:ring-sky-400/50"
                placeholder="Buscar por nombre o cédula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-[140px] border-white/10 bg-white/5"><SelectValue placeholder="Curso" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_COURSES}>Todos</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-[130px] border-white/10 bg-white/5"><SelectValue placeholder="Riesgo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RISK}>Riesgos</SelectItem>
                  {(Object.keys(RISK_LABELS) as RiskLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>{RISK_LABELS[level]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as StatusFilter)}>
                <SelectTrigger className="w-[120px] border-white/10 bg-white/5"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-b border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-medium">Estudiante</TableHead>
                  <TableHead className="text-slate-300 font-medium">Curso</TableHead>
                  <TableHead className="text-slate-300 font-medium hidden md:table-cell">Cédula</TableHead>
                  <TableHead className="text-slate-300 font-medium hidden lg:table-cell">Representante</TableHead>
                  <TableHead className="text-slate-300 font-medium">Riesgo</TableHead>
                  <TableHead className="text-right text-slate-300 font-medium">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-16">
                      <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                        <Search className="h-8 w-8 mb-2" />
                        <p>No hay estudiantes que coincidan con los filtros</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => {
                    const ui = toUiStudent(student)
                    const initials = `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`
                    return (
                      <TableRow key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => {
                        // Opcional: abrir perfil al clickear la fila
                      }}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-white/10 shadow-sm transition-transform group-hover:scale-105">
                              <AvatarFallback className="bg-sky-500/20 text-sky-300 text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-foreground">{student.first_name} {student.last_name}</span>
                              <span className="text-[10px] text-muted-foreground md:hidden">{student.course_name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{student.course_name}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell font-mono text-xs">{student.national_id ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                          {student.guardian
                            ? `${student.guardian.first_name} ${student.guardian.last_name}`
                            : <span className="italic opacity-50">Sin asignar</span>}
                        </TableCell>
                        <TableCell>
                          <div className="transition-transform group-hover:scale-105 origin-left">
                            {getRiskBadge(ui.risk)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <StudentProfileDialog
                              student={ui}
                              defaultOpen={profileStudentId === String(student.id)}
                              defaultTab={profileTab}
                            />
                            {canManage && isViewingActiveTerm && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => openEdit(student)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {student.status === 'activo' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeactivating(student)}
                                  >
                                    Desactivar
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-600 hover:text-emerald-600"
                                    disabled={saving}
                                    onClick={() => void handleActivate(student)}
                                  >
                                    Activar
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar estudiante</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nombres</Label>
              <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Apellidos</Label>
              <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cédula</Label>
              <Input value={editForm.national_id} onChange={(e) => setEditForm({ ...editForm, national_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Curso</Label>
              <Select value={editForm.course_id} onValueChange={(v) => setEditForm({ ...editForm, course_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Representante *</Label>
              <Select value={editForm.guardian_id || undefined} onValueChange={(v) => setEditForm({ ...editForm, guardian_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar representante" /></SelectTrigger>
                <SelectContent>
                  {guardians.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.first_name} {g.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={editForm.status}
                onValueChange={(v: 'activo' | 'inactivo') => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => void handleUpdate()} disabled={saving || !editForm.guardian_id}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar estudiante?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating && (
                <>
                  <span className="font-medium text-foreground">
                    {deactivating.first_name} {deactivating.last_name}
                  </span>{' '}
                  dejará de aparecer en el listado de activos. Puede reactivarlo desde Editar.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDeactivate()
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
