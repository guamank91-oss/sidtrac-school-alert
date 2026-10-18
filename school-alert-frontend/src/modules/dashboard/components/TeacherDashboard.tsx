import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Loader2,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '@/modules/auth/lib/session'
import {
  getAttendanceRoster,
  getGradeRoster,
  listAssignments,
} from '@/modules/academic/api'
import type { Assignment, GradeRosterRow } from '@/modules/academic/types'
import { isLowScore, parseScore } from '@/modules/academic/utils/formatScore'
import { localDateIso } from '@/shared/lib/date'
import { StudentProfileDialog } from '@/modules/students/components/StudentProfileDialog'
import type { Student } from '@/modules/students/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTermId } from '@/shared/context/PeriodContext'

interface AssignmentInsight {
  assignment: Assignment
  students: GradeRosterRow[]
  gradedCount: number
  lowGradeCount: number
  attendanceToday: number
  absentToday: number
}

function todayLabel() {
  return new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function rosterToStudent(row: GradeRosterRow, courseName: string, courseId: number): Student {
  return {
    id: String(row.student_id),
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: `${row.first_name} ${row.last_name}`.trim(),
    nationalId: row.national_id ?? undefined,
    course: courseName,
    courseId,
    average: 0,
    absences: 0,
    risk: 'green',
    riskLevel: 'bajo',
    status: 'activo',
  }
}

export function TeacherDashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const termId = useTermId()
  const [insights, setInsights] = useState<AssignmentInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [studentDialog, setStudentDialog] = useState<AssignmentInsight | null>(null)

  const loadInsights = useCallback(async () => {
    setLoading(true)
    try {
      const assignments = (await listAssignments(termId)).filter((a) => a.can_edit)
      const today = localDateIso()

      const results = await Promise.all(
        assignments.map(async (assignment) => {
          const [grades, attendance] = await Promise.all([
            getGradeRoster({
              course_subject_id: assignment.id,
              quarter: 1,
              partial: 1,
            }),
            getAttendanceRoster({
              course_subject_id: assignment.id,
              attendance_date: today,
            }),
          ])

          const gradedCount = grades.filter((g) => g.score !== null && g.score !== undefined).length
          const lowGradeCount = grades.filter((g) => isLowScore(g.score)).length
          const attendanceToday = attendance.filter((a) => a.status).length
          const absentToday = attendance.filter((a) => a.status === 'ausente').length

          return {
            assignment,
            students: grades,
            gradedCount,
            lowGradeCount,
            attendanceToday,
            absentToday,
          }
        })
      )
      setInsights(results)
    } catch {
      setInsights([])
    } finally {
      setLoading(false)
    }
  }, [termId])

  useEffect(() => {
    void loadInsights()
  }, [loadInsights])

  const stats = useMemo(() => {
    const studentIds = new Set<number>()
    let graded = 0
    let pending = 0
    let low = 0
    let absent = 0

    for (const item of insights) {
      for (const s of item.students) studentIds.add(s.student_id)
      graded += item.gradedCount
      pending += item.students.length - item.gradedCount
      low += item.lowGradeCount
      absent += item.absentToday
    }

    return {
      subjects: insights.length,
      students: studentIds.size,
      graded,
      pending,
      low,
      absent,
    }
  }, [insights])

  const goAcademic = (assignmentId: number, tab: 'grades' | 'attendance') => {
    navigate(`/academic?tab=${tab}&assignment=${assignmentId}`)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent" aria-hidden />
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Hola, <span className="text-blue-400">{user?.first_name ?? 'docente'}</span>
          </h1>
          <p className="text-slate-300 mt-2 capitalize">{todayLabel()}</p>
        </div>
        <Button variant="outline" className="relative z-10 rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white shadow-lg backdrop-blur-sm transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]" onClick={() => void loadInsights()} disabled={loading}>
          <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : 'hidden'}`} />
          Actualizar datos
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
            <Loader2 className="relative h-10 w-10 animate-spin text-blue-500" />
          </div>
        </div>
      ) : insights.length === 0 ? (
        <Card className="glass-panel border-white/10 shadow-2xl rounded-3xl text-center p-12">
          <CardContent className="flex flex-col items-center justify-center text-slate-400 space-y-4">
            <BookOpen className="h-12 w-12 text-slate-500/50" />
            <p className="text-lg">Aún no tiene materias asignadas.</p>
            <p className="text-sm">El administrador debe vincularlas en Configuración.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="glass-panel border-blue-500/30 bg-blue-500/5 shadow-xl overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-display font-bold text-white">{stats.subjects}</p>
                  <p className="text-sm font-medium text-slate-400 mt-1">Materias</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-purple-500/30 bg-purple-500/5 shadow-xl overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-2xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-display font-bold text-white">{stats.students}</p>
                  <p className="text-sm font-medium text-slate-400 mt-1">Estudiantes</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel border-emerald-500/30 bg-emerald-500/5 shadow-xl overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <ClipboardList className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-display font-bold text-white">
                    {stats.graded}
                    <span className="text-base font-normal text-slate-400 ml-2">
                      / {stats.pending} pend.
                    </span>
                  </p>
                  <p className="text-sm font-medium text-emerald-400 mt-1">Notas Q1-P1</p>
                </div>
              </CardContent>
            </Card>

            <Card className={`glass-panel border-white/10 shadow-xl overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300 ${
              stats.low > 0 || stats.absent > 0 ? 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative group' : 'bg-white/5'
            }`}>
              {stats.low > 0 || stats.absent > 0 ? <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" /> : null}
              <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${
                    stats.low > 0 || stats.absent > 0 
                      ? 'bg-amber-500/20 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                      : 'bg-white/10 border-white/20'
                  }`}>
                    <AlertTriangle className={`h-5 w-5 ${stats.low > 0 || stats.absent > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
                </div>
                <div>
                  <p className={`text-3xl font-display font-bold ${stats.low > 0 || stats.absent > 0 ? 'text-amber-400' : 'text-white'}`}>
                    {stats.low + stats.absent}
                  </p>
                  <p className="text-sm font-medium text-slate-400 mt-1 flex gap-2">
                    {stats.low} bajas · {stats.absent} ausencias
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {insights.map((item) => {
              const total = item.students.length
              const progress = total > 0 ? Math.round((item.gradedCount / total) * 100) : 0
              return (
                <Card key={item.assignment.id} className="glass-panel border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col hover:border-blue-500/30 transition-colors duration-300 group">
                  <CardHeader className="bg-black/20 border-b border-white/5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-display text-white truncate group-hover:text-blue-400 transition-colors">
                          {item.assignment.subject_name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1 text-slate-400">
                          <GraduationCap className="h-4 w-4 shrink-0 text-blue-400" />
                          {item.assignment.course_name}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300 backdrop-blur-md">{total} alumnos</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Avance notas (Q1 · P1)</span>
                        <span className="font-bold text-white">{progress}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-3 hover:bg-white/10 transition-colors">
                        <p className="font-bold text-lg text-white">{item.gradedCount}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Con nota</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-3 hover:bg-white/10 transition-colors">
                        <p className="font-bold text-lg text-white">{item.attendanceToday}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Asist. hoy</p>
                      </div>
                      <div className={`rounded-2xl border px-3 py-3 transition-colors ${
                        item.lowGradeCount > 0 
                          ? 'border-amber-500/20 bg-amber-500/10 shadow-[inset_0_0_15px_rgba(245,158,11,0.05)]' 
                          : 'border-white/5 bg-white/5 hover:bg-white/10'
                      }`}>
                        <p className={`font-bold text-lg ${item.lowGradeCount > 0 ? 'text-amber-400' : 'text-white'}`}>{item.lowGradeCount}</p>
                        <p className={`text-xs mt-0.5 ${item.lowGradeCount > 0 ? 'text-amber-400/70' : 'text-slate-400'}`}>Bajo 7</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                      <Button
                        className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 flex-1 sm:flex-none transition-all"
                        onClick={() => goAcademic(item.assignment.id, 'grades')}
                      >
                        Calificaciones
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white flex-1 sm:flex-none transition-all"
                        onClick={() => goAcademic(item.assignment.id, 'attendance')}
                      >
                        <CalendarCheck className="mr-2 h-4 w-4 text-emerald-400" />
                        Asistencia
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex-1 sm:flex-none transition-all"
                        onClick={() => setStudentDialog(item)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Estudiantes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <Dialog open={!!studentDialog} onOpenChange={(open) => !open && setStudentDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {studentDialog?.assignment.subject_name} — {studentDialog?.assignment.course_name}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Nota Q1-P1</TableHead>
                <TableHead className="text-right">Plan / perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentDialog?.students.map((s) => {
                const score = parseScore(s.score)
                const uiStudent = rosterToStudent(
                  s,
                  studentDialog.assignment.course_name,
                  studentDialog.assignment.course_id,
                )
                return (
                  <TableRow key={s.student_id}>
                    <TableCell>
                      {s.first_name} {s.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.national_id ?? '—'}
                    </TableCell>
                    <TableCell>
                      {score !== null ? (
                        <Badge variant={score < 7 ? 'destructive' : 'secondary'}>
                          {score.toFixed(2)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin nota</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <StudentProfileDialog student={uiStudent} defaultTab="attention-plan" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => studentDialog && goAcademic(studentDialog.assignment.id, 'grades')}
            >
              Registrar notas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
