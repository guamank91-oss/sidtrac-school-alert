import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/shared/lib/api'
import { getUser } from '@/modules/auth/lib/session'
import { AlertConfigPanel } from '@/modules/alerts/components/AlertConfigPanel'
import { AuditLogPanel } from '@/modules/audit/components/AuditLogPanel'
import { EmailAdminPanel } from '@/modules/notifications/components/EmailAdminPanel'
import { WebhookConfigPanel } from '@/modules/institution/components/WebhookConfigPanel'
import { RagMetricsPanel } from '@/modules/rag/components/RagMetricsPanel'
import { ConfirmButton } from '@/modules/action-plans/components/ConfirmButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { usePeriod } from '@/shared/context/PeriodContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  activateTerm,
  createCourse,
  createCourseSubject,
  createSubject,
  createTerm,
  deleteCourse,
  deleteCourseSubject,
  deleteSubject,
  getInstitution,
  listCourseSubjects,
  listCourses,
  listSubjects,
  listTerms,
  listUsersByRole,
  updateCourse,
  updateCourseSubject,
  updateInstitution,
  updateSubject,
  updateTerm,
} from '../api'
import type { AcademicTerm, BasicUser, Course, CourseSubject, Institution, Subject } from '../types'

export function SettingsPage() {
  const user = getUser()
  const institutionId = user?.institution_id
  const { refreshTerms, setSelectedTermId } = usePeriod()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [assignments, setAssignments] = useState<CourseSubject[]>([])
  const [tutors, setTutors] = useState<BasicUser[]>([])
  const [teachers, setTeachers] = useState<BasicUser[]>([])
  const [activeTermId, setActiveTermId] = useState<number | null>(null)
  const [detailsGroupKey, setDetailsGroupKey] = useState<string | null>(null)

  const [institutionForm, setInstitutionForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
  })

  const [newTerm, setNewTerm] = useState({ name: '', start_date: '', end_date: '' })
  const [newCourse, setNewCourse] = useState({
    grade_level: '',
    section: '',
    name: '',
    tutor_id: '',
  })
  const [newSubject, setNewSubject] = useState({ name: '', code: '', weekly_hours: '' })
  const [newAssignment, setNewAssignment] = useState({
    course_id: '',
    subject_id: '',
    teacher_id: '',
  })

  const [editingTerm, setEditingTerm] = useState<AcademicTerm | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<CourseSubject | null>(null)
  const [termForm, setTermForm] = useState({ name: '', start_date: '', end_date: '' })
  const [courseForm, setCourseForm] = useState({ grade_level: '', section: '', name: '', tutor_id: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', weekly_hours: '' })
  const [assignmentTeacherId, setAssignmentTeacherId] = useState('')

  const loadData = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    setError(null)
    try {
      const [inst, termList, subjectList, tutorList, teacherList] = await Promise.all([
        getInstitution(institutionId),
        listTerms(institutionId),
        listSubjects(institutionId),
        listUsersByRole('tutor'),
        listUsersByRole('docente'),
      ])
      setInstitution(inst)
      setInstitutionForm({
        name: inst.name,
        code: inst.code,
        address: inst.address ?? '',
        phone: inst.phone ?? '',
        email: inst.email ?? '',
      })
      setTerms(termList)
      const active = termList.find((t) => t.is_active)
      setActiveTermId(active?.id ?? termList[0]?.id ?? null)
      setSubjects(subjectList)
      setTutors(tutorList)
      setTeachers(teacherList)
    } catch {
      setError('No se pudo cargar la configuración institucional')
    } finally {
      setLoading(false)
    }
  }, [institutionId])

  const loadCoursesAndAssignments = useCallback(async () => {
    if (!institutionId) return
    try {
      const [courseList, allCourseList, assignmentList] = await Promise.all([
        listCourses(institutionId, activeTermId ?? undefined),
        listCourses(institutionId),
        listCourseSubjects(institutionId),
      ])
      setCourses(courseList)
      setAllCourses(allCourseList)
      setAssignments(assignmentList)
    } catch {
      setError('Error al cargar cursos o asignaciones')
    }
  }, [institutionId, activeTermId])

  const assignmentGroups = useMemo(() => {
    const courseById = new Map(allCourses.map((c) => [c.id, c]))
    const termById = new Map(terms.map((t) => [t.id, t]))
    const groups = new Map<
      string,
      {
        key: string
        termId: number
        termName: string
        courseId: number
        courseName: string
        items: CourseSubject[]
      }
    >()

    for (const assignment of assignments) {
      const course = courseById.get(assignment.course_id)
      const termId = course?.academic_term_id ?? 0
      const termName = termById.get(termId)?.name ?? 'Periodo desconocido'
      const courseName = course?.name ?? assignment.course_name ?? 'Curso'
      const key = `${termId}:${assignment.course_id}`
      const existing = groups.get(key)
      if (existing) {
        existing.items.push(assignment)
      } else {
        groups.set(key, {
          key,
          termId,
          termName,
          courseId: assignment.course_id,
          courseName,
          items: [assignment],
        })
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const byTerm = a.termName.localeCompare(b.termName, 'es')
      if (byTerm !== 0) return byTerm
      return a.courseName.localeCompare(b.courseName, 'es')
    })
  }, [allCourses, assignments, terms])

  const detailsGroup = useMemo(
    () => assignmentGroups.find((g) => g.key === detailsGroupKey) ?? null,
    [assignmentGroups, detailsGroupKey],
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (activeTermId) void loadCoursesAndAssignments()
  }, [activeTermId, loadCoursesAndAssignments])

  useEffect(() => {
    if (detailsGroupKey && !assignmentGroups.some((g) => g.key === detailsGroupKey)) {
      setDetailsGroupKey(null)
    }
  }, [assignmentGroups, detailsGroupKey])

  const saveInstitution = async () => {
    if (!institution) return
    try {
      const updated = await updateInstitution(institution.id, {
        name: institutionForm.name,
        code: institutionForm.code,
        address: institutionForm.address || null,
        phone: institutionForm.phone || null,
        email: institutionForm.email || null,
      })
      setInstitution(updated)
    } catch {
      setError('No se pudo guardar la institución')
    }
  }

  const addTerm = async () => {
    if (!institutionId || !newTerm.name || !newTerm.start_date || !newTerm.end_date) return
    try {
      await createTerm({
        institution_id: institutionId,
        name: newTerm.name,
        start_date: newTerm.start_date,
        end_date: newTerm.end_date,
        is_active: terms.length === 0,
      })
      setNewTerm({ name: '', start_date: '', end_date: '' })
      await loadData()
    } catch {
      setError('No se pudo crear el periodo')
    }
  }

  const handleActivateTerm = async (termId: number) => {
    try {
      await activateTerm(termId)
      await loadData()
      refreshTerms()
    } catch {
      setError('No se pudo activar el periodo')
    }
  }

  const handleCloseTerm = async (termId: number) => {
    if (
      !window.confirm(
        '¿Está seguro de ejecutar el Cierre de Año Lectivo? Esto archivará las alertas activas del año y restablecerá los semáforos de riesgo para el nuevo periodo lectivo conservando todo el historial.'
      )
    )
      return
    try {
      await apiPost(`/institution/terms/${termId}/close`)
      toast.success('Año Lectivo cerrado exitosamente')
      await loadData()
      refreshTerms()
    } catch {
      setError('No se pudo cerrar el año lectivo')
    }
  }

  const addCourse = async () => {
    if (!institutionId || !activeTermId || !newCourse.name) return
    try {
      await createCourse({
        institution_id: institutionId,
        academic_term_id: activeTermId,
        grade_level: newCourse.grade_level,
        section: newCourse.section,
        name: newCourse.name,
        tutor_id: newCourse.tutor_id ? Number(newCourse.tutor_id) : null,
      })
      setNewCourse({ grade_level: '', section: '', name: '', tutor_id: '' })
      await loadCoursesAndAssignments()
    } catch {
      setError('No se pudo crear el curso')
    }
  }

  const addSubject = async () => {
    if (!institutionId || !newSubject.name) return
    try {
      await createSubject({
        institution_id: institutionId,
        name: newSubject.name,
        code: newSubject.code || null,
        weekly_hours: newSubject.weekly_hours ? Number(newSubject.weekly_hours) : null,
      })
      setNewSubject({ name: '', code: '', weekly_hours: '' })
      const list = await listSubjects(institutionId)
      setSubjects(list)
    } catch {
      setError('No se pudo crear la materia')
    }
  }

  const openEditTerm = (term: AcademicTerm) => {
    setEditingTerm(term)
    setTermForm({ name: term.name, start_date: term.start_date, end_date: term.end_date })
  }

  const saveTerm = async () => {
    if (!editingTerm) return
    try {
      await updateTerm(editingTerm.id, termForm)
      setEditingTerm(null)
      await loadData()
    } catch {
      setError('No se pudo actualizar el periodo')
    }
  }

  const openEditCourse = (course: Course) => {
    setEditingCourse(course)
    setCourseForm({
      grade_level: course.grade_level,
      section: course.section,
      name: course.name,
      tutor_id: course.tutor_id?.toString() ?? '',
    })
  }

  const saveCourse = async () => {
    if (!editingCourse) return
    try {
      await updateCourse(editingCourse.id, {
        grade_level: courseForm.grade_level,
        section: courseForm.section,
        name: courseForm.name,
        tutor_id: courseForm.tutor_id && courseForm.tutor_id !== 'none' ? Number(courseForm.tutor_id) : null,
      })
      setEditingCourse(null)
      await loadCoursesAndAssignments()
      const tutorList = await listUsersByRole('tutor')
      setTutors(tutorList)
    } catch {
      setError('No se pudo actualizar el curso')
    }
  }

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setSubjectForm({
      name: subject.name,
      code: subject.code ?? '',
      weekly_hours: subject.weekly_hours?.toString() ?? '',
    })
  }

  const saveSubject = async () => {
    if (!editingSubject || !institutionId) return
    try {
      await updateSubject(editingSubject.id, {
        name: subjectForm.name,
        code: subjectForm.code || null,
        weekly_hours: subjectForm.weekly_hours ? Number(subjectForm.weekly_hours) : null,
      })
      setEditingSubject(null)
      const list = await listSubjects(institutionId)
      setSubjects(list)
    } catch {
      setError('No se pudo actualizar la materia')
    }
  }

  const openEditAssignment = (assignment: CourseSubject) => {
    setEditingAssignment(assignment)
    setAssignmentTeacherId(assignment.teacher_id.toString())
  }

  const saveAssignment = async () => {
    if (!editingAssignment || !assignmentTeacherId) return
    try {
      await updateCourseSubject(editingAssignment.id, { teacher_id: Number(assignmentTeacherId) })
      setEditingAssignment(null)
      await loadCoursesAndAssignments()
    } catch {
      setError('No se pudo actualizar la asignación')
    }
  }

  const addAssignment = async () => {
    if (!newAssignment.course_id || !newAssignment.subject_id || !newAssignment.teacher_id) return
    try {
      await createCourseSubject({
        course_id: Number(newAssignment.course_id),
        subject_id: Number(newAssignment.subject_id),
        teacher_id: Number(newAssignment.teacher_id),
      })
      setNewAssignment({ course_id: '', subject_id: '', teacher_id: '' })
      await loadCoursesAndAssignments()
    } catch {
      setError('No se pudo crear la asignación')
    }
  }

  if (!institutionId) {
    return <p className="text-muted-foreground">Sesión sin institución asociada.</p>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración institucional</h1>
        <p className="text-muted-foreground">Administra periodos, cursos, materias y asignaciones docentes.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="terms">Periodos</TabsTrigger>
          <TabsTrigger value="courses">Cursos</TabsTrigger>
          <TabsTrigger value="subjects">Materias</TabsTrigger>
          <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
          <TabsTrigger value="alert-config">Umbrales</TabsTrigger>
          <TabsTrigger value="email font-semibold">Email & WhatsApp</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks ERP</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
          <TabsTrigger value="rag-metrics">Métricas RAG</TabsTrigger>
        </TabsList>

        <TabsContent value="alert-config" className="mt-4">
          <AlertConfigPanel />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <EmailAdminPanel />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4">
          <WebhookConfigPanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogPanel />
        </TabsContent>

        <TabsContent value="rag-metrics" className="mt-4">
          <RagMetricsPanel />
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la institución</CardTitle>
              <CardDescription>Información general registrada en el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={institutionForm.name} onChange={(e) => setInstitutionForm({ ...institutionForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={institutionForm.code} onChange={(e) => setInstitutionForm({ ...institutionForm, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={institutionForm.address} onChange={(e) => setInstitutionForm({ ...institutionForm, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={institutionForm.phone} onChange={(e) => setInstitutionForm({ ...institutionForm, phone: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Correo institucional</Label>
                <Input value={institutionForm.email} onChange={(e) => setInstitutionForm({ ...institutionForm, email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={() => void saveInstitution()}>Guardar cambios</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Nuevo periodo lectivo</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Input placeholder="Nombre (ej. 2025-2026)" value={newTerm.name} onChange={(e) => setNewTerm({ ...newTerm, name: e.target.value })} />
              <Input type="date" value={newTerm.start_date} onChange={(e) => setNewTerm({ ...newTerm, start_date: e.target.value })} />
              <Input type="date" value={newTerm.end_date} onChange={(e) => setNewTerm({ ...newTerm, end_date: e.target.value })} />
              <Button onClick={() => void addTerm()}><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.start_date}</TableCell>
                      <TableCell>{t.end_date}</TableCell>
                      <TableCell>{t.is_active ? <Badge>Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditTerm(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {t.is_active ? (
                            <Button size="sm" variant="destructive" onClick={() => void handleCloseTerm(t.id)} className="gap-1 font-semibold">
                              🔒 Cerrar Año
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => void handleActivateTerm(t.id)}>
                              Activar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <Label>Periodo:</Label>
            <Select value={activeTermId?.toString() ?? ''} onValueChange={(v) => setActiveTermId(Number(v))}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Seleccionar periodo" /></SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name} {t.is_active ? '(activo)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader><CardTitle>Nuevo curso</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-5">
              <Input placeholder="Nivel" value={newCourse.grade_level} onChange={(e) => setNewCourse({ ...newCourse, grade_level: e.target.value })} />
              <Input placeholder="Paralelo" value={newCourse.section} onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })} />
              <Input placeholder="Nombre" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} />
              <Select value={newCourse.tutor_id} onValueChange={(v) => setNewCourse({ ...newCourse, tutor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Tutor (opcional)" /></SelectTrigger>
                <SelectContent>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void addCourse()}><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Paralelo</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.grade_level}</TableCell>
                      <TableCell>{c.section}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditCourse(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmButton
                            size="icon"
                            variant="ghost"
                            triggerLabel={`Eliminar curso ${c.name}`}
                            title="¿Eliminar curso?"
                            description={`Se eliminará el curso «${c.name}» y sus asignaciones asociadas. Esta acción no se puede deshacer.`}
                            confirmLabel="Eliminar"
                            cancelLabel="Cancelar"
                            className="text-destructive hover:text-destructive"
                            onConfirm={async () => {
                              await deleteCourse(c.id)
                              await loadCoursesAndAssignments()
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Nueva materia</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Input placeholder="Nombre" value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} />
              <Input placeholder="Código" value={newSubject.code} onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })} />
              <Input placeholder="Horas/semana" type="number" value={newSubject.weekly_hours} onChange={(e) => setNewSubject({ ...newSubject, weekly_hours: e.target.value })} />
              <Button onClick={() => void addSubject()}><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.code ?? '—'}</TableCell>
                      <TableCell>{s.weekly_hours ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditSubject(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmButton
                            size="icon"
                            variant="ghost"
                            triggerLabel={`Eliminar materia ${s.name}`}
                            title="¿Eliminar materia?"
                            description={`Se eliminará la materia «${s.name}». Esta acción no se puede deshacer.`}
                            confirmLabel="Eliminar"
                            cancelLabel="Cancelar"
                            className="text-destructive hover:text-destructive"
                            onConfirm={async () => {
                              await deleteSubject(s.id)
                              const list = await listSubjects(institutionId!)
                              setSubjects(list)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Nueva asignación curso-materia-docente</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Select value={newAssignment.course_id} onValueChange={(v) => setNewAssignment({ ...newAssignment, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newAssignment.subject_id} onValueChange={(v) => setNewAssignment({ ...newAssignment, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Materia" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newAssignment.teacher_id} onValueChange={(v) => setNewAssignment({ ...newAssignment, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Docente" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.first_name} {d.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void addAssignment()}><Plus className="mr-2 h-4 w-4" /> Asignar</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Asignaciones por periodo y curso</CardTitle>
              <CardDescription>
                Cada fila agrupa todas las materias de un curso en un periodo. Usa Detalles para editar o eliminar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Materias</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center">
                        No hay asignaciones registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignmentGroups.map((group) => (
                      <TableRow key={group.key}>
                        <TableCell>{group.termName}</TableCell>
                        <TableCell>{group.courseName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{group.items.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setDetailsGroupKey(group.key)}>
                            Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailsGroup} onOpenChange={(open) => !open && setDetailsGroupKey(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailsGroup ? `${detailsGroup.courseName} · ${detailsGroup.termName}` : 'Detalles'}
            </DialogTitle>
            <DialogDescription>
              Materias y docentes asignados a este curso en el periodo.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Materia</TableHead>
                <TableHead>Docente</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detailsGroup?.items ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.subject_name}</TableCell>
                  <TableCell>{a.teacher_name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditAssignment(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmButton
                        size="icon"
                        variant="ghost"
                        triggerLabel={`Eliminar asignación ${a.subject_name}`}
                        title="¿Eliminar asignación?"
                        description={`Se quitará «${a.subject_name}» del curso «${detailsGroup?.courseName ?? ''}» con el docente «${a.teacher_name ?? ''}».`}
                        confirmLabel="Eliminar"
                        cancelLabel="Cancelar"
                        className="text-destructive hover:text-destructive"
                        onConfirm={async () => {
                          await deleteCourseSubject(a.id)
                          await loadCoursesAndAssignments()
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsGroupKey(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTerm} onOpenChange={(open) => !open && setEditingTerm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar periodo</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Nombre</Label><Input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Inicio</Label><Input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fin</Label><Input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTerm(null)}>Cancelar</Button>
            <Button onClick={() => void saveTerm()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar curso</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Nivel</Label><Input value={courseForm.grade_level} onChange={(e) => setCourseForm({ ...courseForm, grade_level: e.target.value })} /></div>
            <div className="space-y-2"><Label>Paralelo</Label><Input value={courseForm.section} onChange={(e) => setCourseForm({ ...courseForm, section: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nombre</Label><Input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Tutor</Label>
              <Select value={courseForm.tutor_id} onValueChange={(v) => setCourseForm({ ...courseForm, tutor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sin tutor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tutor</SelectItem>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>Cancelar</Button>
            <Button onClick={() => void saveCourse()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSubject} onOpenChange={(open) => !open && setEditingSubject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar materia</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Nombre</Label><Input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Código</Label><Input value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} /></div>
            <div className="space-y-2"><Label>Horas/semana</Label><Input type="number" value={subjectForm.weekly_hours} onChange={(e) => setSubjectForm({ ...subjectForm, weekly_hours: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubject(null)}>Cancelar</Button>
            <Button onClick={() => void saveSubject()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAssignment} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar asignación</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Docente</Label>
            <Select value={assignmentTeacherId} onValueChange={setAssignmentTeacherId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar docente" /></SelectTrigger>
              <SelectContent>
                {teachers.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.first_name} {d.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAssignment(null)}>Cancelar</Button>
            <Button onClick={() => void saveAssignment()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
