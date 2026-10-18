import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Download,
  Flame,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Users,
  BookOpen,
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getUser } from '@/modules/auth/lib/session'
import { listCourses, listSubjects, listCourseSubjects } from '@/modules/institution/api'
import { listStudents } from '@/modules/students/api'
import { listAlerts } from '@/modules/alerts/api'
import { RISK_LEVEL_LABELS, ALERT_TYPE_LABELS } from '@/modules/alerts/labels'
import type { Course, Subject, CourseSubject } from '@/modules/institution/types'
import type { Alert } from '@/modules/alerts/types'
import type { StudentRecord } from '@/modules/students/types'
import type { RiskLevel } from '@/shared/types/roles'
import { usePeriod } from '@/shared/context/PeriodContext'

const ALL = 'all'
const RISK_LEVELS: RiskLevel[] = ['bajo', 'medio', 'alto', 'critico']

const RISK_COLORS: Record<RiskLevel, string> = {
  bajo:    'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  medio:   'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  alto:    'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  critico: 'bg-rose-500/15 text-rose-400 ring-rose-500/40 animate-pulse',
}

// Use ALERT_TYPE_LABELS from labels.ts (keys: academica, asistencia, conductual, emocional, disciplinaria, desercion, combinada)

export function RectorDashboard() {
  const user = getUser()
  const institutionId = user?.institution_id
  const { selectedTermId, terms: allTerms } = usePeriod()

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterTermId, setFilterTermId]   = useState<string>(ALL)
  const [filterCourseId, setFilterCourseId] = useState<string>(ALL)
  const [filterRisk, setFilterRisk]         = useState<string>(ALL)
  const [filterType, setFilterType]         = useState<string>(ALL)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')

  // ── Data ─────────────────────────────────────────────────────────────────
  const [courses, setCourses]               = useState<Course[]>([])
  const [subjects, setSubjects]             = useState<Subject[]>([])
  const [courseSubjects, setCourseSubjects] = useState<CourseSubject[]>([])
  const [students, setStudents]             = useState<StudentRecord[]>([])
  const [alerts, setAlerts]                 = useState<Alert[]>([])
  const [loading, setLoading]               = useState(true)

  const effectiveTermId = filterTermId !== ALL ? Number(filterTermId) : (selectedTermId ?? undefined)

  const load = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    try {
      const [courseList, subjectList, courseSubjList, studentList, alertList] = await Promise.all([
        listCourses(institutionId, effectiveTermId),
        listSubjects(institutionId),
        listCourseSubjects(institutionId),
        listStudents({ term_id: effectiveTermId }),
        listAlerts({
          term_id: effectiveTermId,
        }),
      ])
      setCourses(courseList)
      setSubjects(subjectList)
      setCourseSubjects(courseSubjList)
      setStudents(studentList)
      setAlerts(alertList)
    } catch {
      toast.error('Error al cargar datos del Panel Directivo')
    } finally {
      setLoading(false)
    }
  }, [institutionId, effectiveTermId])

  useEffect(() => { void load() }, [load])

  // ── Filtered Data (Local & Instant) ──────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterCourseId !== ALL && s.course_id !== Number(filterCourseId)) return false
      return true
    })
  }, [students, filterCourseId])

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filterDateFrom && a.created_at < filterDateFrom) return false
      if (filterDateTo   && a.created_at > filterDateTo + 'T23:59:59') return false
      if (filterRisk !== ALL && a.level !== filterRisk) return false
      if (filterType !== ALL && a.alert_type !== filterType) return false
      
      // Filtrar por curso cruzando con students
      if (filterCourseId !== ALL) {
        const student = students.find(s => s.id === a.student_id)
        if (!student || student.course_id !== Number(filterCourseId)) return false
      }
      return true
    })
  }, [alerts, filterDateFrom, filterDateTo, filterRisk, filterType, filterCourseId, students])

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalStudents  = filteredStudents.length
  const totalAlerts    = filteredAlerts.length
  const criticalAlerts = filteredAlerts.filter((a) => a.level === 'critico').length
  const highAlerts     = filteredAlerts.filter((a) => a.level === 'alto').length

  // ── Heatmap: real courses vs risk levels ─────────────────────────────────
  const heatmapRows = useMemo(() => {
    const filtered = filterCourseId !== ALL
      ? courses.filter((c) => c.id === Number(filterCourseId))
      : courses

    return filtered.map((course) => {
      const courseStudentIds = students
        .filter((s) => s.course_id === course.id)
        .map((s) => s.id)

      const courseAlerts = filteredAlerts.filter((a) =>
        courseStudentIds.includes(a.student_id)
      )

      const counts = RISK_LEVELS.reduce((acc, lvl) => {
        acc[lvl] = courseAlerts.filter((a) => a.level === lvl).length
        return acc
      }, {} as Record<RiskLevel, number>)

      return { course, ...counts }
    })
  }, [courses, students, filteredAlerts, filterCourseId])

  // ── Alerts by type ────────────────────────────────────────────────────────
  const alertsByType = useMemo(() => {
    const map: Record<string, number> = {}
    filteredAlerts.forEach((a) => {
      map[a.alert_type] = (map[a.alert_type] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredAlerts])

  const maxTypeCount = Math.max(...alertsByType.map((t) => t.count), 1)

  // ── Alerts by risk distribution ───────────────────────────────────────────
  const alertsByRisk = useMemo(() => {
    return RISK_LEVELS.map((lvl) => ({
      level: lvl,
      count: filteredAlerts.filter((a) => a.level === lvl).length,
    }))
  }, [filteredAlerts])

  const alertTypes  = useMemo(() => [...new Set(alerts.map((a) => a.alert_type))], [alerts])

  // ── Problematic Subjects Breakdown by Course ─────────────────────────────
  const subjectDifficultyByCourse = useMemo(() => {
    const targetCourses = filterCourseId !== ALL
      ? courses.filter((c) => c.id === Number(filterCourseId))
      : courses

    return targetCourses.map((course) => {
      // Find subjects assigned SPECIFICALLY to this course in course_materias
      const assignedSubjIds = courseSubjects
        .filter((cs) => cs.course_id === course.id)
        .map((cs) => cs.subject_id)

      const assignedSubjects = subjects.filter((s) => assignedSubjIds.includes(s.id))

      const courseStudentIds = students
        .filter((s) => s.course_id === course.id)
        .map((s) => s.id)

      const courseAlerts = filteredAlerts.filter((a) =>
        courseStudentIds.includes(a.student_id)
      )

      const subjectMap: Record<string, { count: number; criticalCount: number }> = {}
      
      assignedSubjects.forEach(subj => {
        subjectMap[subj.name] = { count: 0, criticalCount: 0 }
      })

      courseAlerts.forEach((alert) => {
        let matched = false
        // Check ONLY assigned subjects for this course
        for (const subj of assignedSubjects) {
          if (alert.description.toLowerCase().includes(subj.name.toLowerCase())) {
            if (!subjectMap[subj.name]) subjectMap[subj.name] = { count: 0, criticalCount: 0 }
            subjectMap[subj.name].count += 1
            if (alert.level === 'critico' || alert.level === 'alto') {
              subjectMap[subj.name].criticalCount += 1
            }
            matched = true
            break
          }
        }
        // If alert is academic but does NOT mention a specific subject name, group as "Rendimiento Académico General"
        if (!matched && (alert.alert_type === 'academica' || alert.alert_type === 'combinada')) {
          const catName = 'Rendimiento Académico General'
          if (!subjectMap[catName]) subjectMap[catName] = { count: 0, criticalCount: 0 }
          subjectMap[catName].count += 1
          if (alert.level === 'critico' || alert.level === 'alto') {
            subjectMap[catName].criticalCount += 1
          }
        }
      })

      const sortedSubjects = Object.entries(subjectMap)
        .map(([name, data]) => ({
          subjectName: name,
          alertCount: data.count,
          criticalCount: data.criticalCount,
          percentage: courseAlerts.length > 0 ? Math.round((data.count / courseAlerts.length) * 100) : 0,
          severity: data.criticalCount > 1 ? 'high' : data.count > 0 ? 'medium' : 'low',
        }))
        .sort((a, b) => b.alertCount - a.alertCount || b.criticalCount - a.criticalCount)

      return {
        course,
        totalCourseAlerts: courseAlerts.length,
        topSubjects: sortedSubjects.slice(0, 5),
        assignedSubjects,
      }
    })
  }, [courses, subjects, courseSubjects, students, filteredAlerts, filterCourseId])

  const resetFilters = () => {
    setFilterTermId(ALL)
    setFilterCourseId(ALL)
    setFilterRisk(ALL)
    setFilterType(ALL)
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden p-6 rounded-3xl bg-background/60 border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 opacity-50" />
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl opacity-50 mix-blend-screen" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl shadow-lg shadow-sky-500/20">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Panel Ejecutivo Directivo
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Analítica en tiempo real sincronizada con los cursos, estudiantes y alertas del sistema.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 relative z-10">
          <Button variant="outline" onClick={() => void load()} className="gap-2 font-semibold bg-background/50 backdrop-blur border-white/10 hover:bg-background/80 transition-all hover:scale-[1.02]">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button
            onClick={() => window.print()}
            className="gap-2 font-bold shadow-lg shadow-indigo-500/20 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl transition-all hover:scale-[1.02] border-0"
          >
            <Download className="h-4 w-4" />
            Exportar Informe
          </Button>
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────────── */}
      <Card className="glass-panel border-white/5 bg-background/40 backdrop-blur-xl shadow-xl overflow-visible">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-sky-400" />
            Filtros del Panel Directivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            {/* Period / Term */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Período Lectivo</Label>
              <Select value={filterTermId} onValueChange={setFilterTermId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los períodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los períodos</SelectItem>
                  {allTerms.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} {t.is_active ? '(activo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Course */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Curso</Label>
              <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los cursos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los cursos</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `${c.grade_level} ${c.section}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Risk Level */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nivel de Riesgo</Label>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los niveles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los niveles</SelectItem>
                  {RISK_LEVELS.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {RISK_LEVEL_LABELS[lvl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alert Type */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Alerta</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los tipos</SelectItem>
                  {alertTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ALERT_TYPE_LABELS[t as keyof typeof ALERT_TYPE_LABELS] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fecha Desde</Label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fecha Hasta</Label>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                />
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 shrink-0 text-xs text-muted-foreground hover:text-foreground">
                  ✕
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI BENTO GRID ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Estudiantes */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-sky-500/30 bg-sky-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-sky-500/15 rounded-full blur-2xl group-hover:bg-sky-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 mb-4 shadow-[0_0_15px_rgba(14,165,233,0.2)] group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5 text-sky-400" />
          </div>
          <p className="text-3xl font-display font-black text-sky-400 relative z-10">{totalStudents}</p>
          <p className="text-[11px] font-bold text-sky-300/80 mt-1 uppercase tracking-wider relative z-10">Estudiantes</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 relative z-10">
            <TrendingUp className="h-3 w-3" />
            <span>{courses.length} curso(s)</span>
          </div>
        </div>

        {/* Alertas */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-amber-500/30 bg-amber-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-amber-500/15 rounded-full blur-2xl group-hover:bg-amber-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-display font-black text-amber-400 relative z-10">{totalAlerts}</p>
          <p className="text-[11px] font-bold text-amber-300/80 mt-1 uppercase tracking-wider relative z-10">Alertas Totales</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-400 relative z-10">
            <Flame className="h-3 w-3" />
            <span>{criticalAlerts} críticas · {highAlerts} altas</span>
          </div>
        </div>

        {/* Materias Activas */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-violet-500/30 bg-violet-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-violet-500/15 rounded-full blur-2xl group-hover:bg-violet-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30 mb-4 shadow-[0_0_15px_rgba(139,92,246,0.2)] group-hover:scale-110 transition-transform">
            <BookOpen className="h-5 w-5 text-violet-400" />
          </div>
          <p className="text-3xl font-display font-black text-violet-400 relative z-10">{subjects.length}</p>
          <p className="text-[11px] font-bold text-violet-300/80 mt-1 uppercase tracking-wider relative z-10">Materias Activas</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-violet-400 relative z-10">
            <CheckCircle2 className="h-3 w-3" />
            <span>En seguimiento DECE</span>
          </div>
        </div>

        {/* Tasa Atención */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-emerald-500/30 bg-emerald-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl group-hover:bg-emerald-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform">
            <CalendarCheck2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-display font-black text-emerald-400 relative z-10">
            {totalAlerts > 0
              ? `${Math.round((filteredAlerts.filter(a => a.status === 'atendida').length / totalAlerts) * 100)}%`
              : '—'}
          </p>
          <p className="text-[11px] font-bold text-emerald-300/80 mt-1 uppercase tracking-wider relative z-10">Tasa Atención</p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 relative z-10">
            <Award className="h-3 w-3" />
            <span>Gestión DECE</span>
          </div>
        </div>
      </div>

      {/* ── Heatmap + Type Chart ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Real Course Heatmap */}
        <Card className="lg:col-span-2 glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="h-5 w-5 text-rose-400" />
              Mapa de Calor de Riesgo por Curso
            </CardTitle>
            <CardDescription>
              Cursos reales del sistema. Identifica concentraciones de riesgo crítico en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : heatmapRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No hay cursos creados en este período.</p>
                <p className="text-xs mt-1">Crea cursos en <strong>Configuración → Cursos</strong>.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border/60 text-xs font-bold uppercase text-muted-foreground">
                      <th className="py-2.5 px-3 min-w-[180px]">Curso / Nivel</th>
                      <th className="py-2.5 px-3 text-center">Bajo</th>
                      <th className="py-2.5 px-3 text-center">Medio</th>
                      <th className="py-2.5 px-3 text-center">Alto</th>
                      <th className="py-2.5 px-3 text-center">Crítico</th>
                      <th className="py-2.5 px-3 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {heatmapRows.map(({ course, bajo, medio, alto, critico }) => {
                      const total = bajo + medio + alto + critico
                      return (
                        <tr key={course.id} className="hover:bg-muted/20">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-foreground">
                              {course.name || `${course.grade_level} ${course.section}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{course.grade_level}</p>
                          </td>
                          {([['bajo', bajo], ['medio', medio], ['alto', alto], ['critico', critico]] as [RiskLevel, number][]).map(([lvl, cnt]) => (
                            <td key={lvl} className="py-3 px-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${cnt > 0 ? RISK_COLORS[lvl] : 'text-muted-foreground'}`}>
                                {cnt}
                              </span>
                            </td>
                          ))}
                          <td className="py-3 px-3 text-center">
                            <Badge variant="outline" className="text-xs font-bold">{total}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Alerts by Type using Recharts */}
        <Card className="glass-panel border-white/5 bg-background/40 backdrop-blur-xl shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="h-5 w-5 text-amber-400" />
              Alertas por Tipo
            </CardTitle>
            <CardDescription>Distribución porcentual de las incidencias.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : alertsByType.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-10">Sin alertas registradas.</p>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: any, name: any) => [`${value} alertas`, ALERT_TYPE_LABELS[name as keyof typeof ALERT_TYPE_LABELS] ?? name]}
                    />
                    <Pie
                      data={alertsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="type"
                    >
                      {alertsByType.map((entry, index) => {
                        const colors = ['#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#64748b']
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Custom Legend */}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {alertsByType.slice(0, 4).map((entry, index) => {
                    const colors = ['bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-blue-500']
                    return (
                      <div key={entry.type} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${colors[index % colors.length]}`} />
                        <span>{ALERT_TYPE_LABELS[entry.type as keyof typeof ALERT_TYPE_LABELS] ?? entry.type} ({entry.count})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Distribución de Riesgos (Bar Chart) ────────────────────────── */}
      <Card className="glass-panel border-white/5 bg-background/40 backdrop-blur-xl shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-t from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            Evolución del Nivel de Riesgo General
          </CardTitle>
          <CardDescription>Visualización cuantitativa de estudiantes en cada nivel de alerta.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          {loading ? (
             <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-[200px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={alertsByRisk} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis 
                    dataKey="level" 
                    tickFormatter={(val) => RISK_LEVEL_LABELS[val as RiskLevel]} 
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                    axisLine={{ stroke: 'currentColor', opacity: 0.1 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    labelFormatter={(val) => RISK_LEVEL_LABELS[val as RiskLevel]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {alertsByRisk.map((entry, index) => {
                      const fills: Record<string, string> = {
                        bajo: '#10b981',
                        medio: '#f59e0b',
                        alto: '#f97316',
                        critico: '#f43f5e',
                      }
                      return <Cell key={`cell-${index}`} fill={fills[entry.level] || '#64748b'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Indicador de Materias con Mayor Dificultad por Curso ────────────────────────── */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-amber-400" />
            Materias Críticas con Mayor Dificultad por Curso
          </CardTitle>
          <CardDescription>
            Identificación de las asignaturas que generan mayor número de alertas e inciden en el rendimiento por cada curso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : subjectDifficultyByCourse.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay información de materias para los cursos seleccionados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectDifficultyByCourse.map(({ course, totalCourseAlerts, topSubjects }) => {
                return (
                  <div
                    key={course.id}
                    className="p-5 rounded-2xl bg-background/40 backdrop-blur-sm border border-white/5 hover:border-sky-500/30 hover:shadow-lg transition-all duration-300 space-y-4 group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-sky-500/10 transition-colors" />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                          {course.name || `${course.grade_level} ${course.section}`}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-semibold mt-1 ml-3.5 uppercase">{course.grade_level}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold ${
                          totalCourseAlerts > 0
                            ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                            : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                        }`}
                      >
                        {totalCourseAlerts} alerta(s)
                      </Badge>
                    </div>

                    <div className="space-y-2 pt-1">
                      {topSubjects.length === 0 ? (
                        <div className="py-3 text-center">
                          <p className="text-xs text-muted-foreground italic">Sin materias asignadas al curso.</p>
                        </div>
                      ) : (
                        topSubjects.map(({ subjectName, alertCount, percentage, severity }) => (
                          <div key={subjectName} className="space-y-1 group/item">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-foreground font-medium flex items-center gap-1.5">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    severity === 'high'
                                      ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                                      : severity === 'medium'
                                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                                {subjectName}
                              </span>
                              <span className="text-muted-foreground font-mono text-[11px] bg-background/50 px-1.5 py-0.5 rounded-md border border-white/5">
                                {alertCount > 0 ? `${alertCount} alerta(s)` : 'Sin alertas 🟢'}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  severity === 'high'
                                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                                    : severity === 'medium'
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                    : 'bg-emerald-500/60'
                                }`}
                                style={{ width: `${alertCount > 0 ? Math.max(8, percentage) : 100}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Distribución Cards (Replaced by BarChart) ──────────────────── */}
    </div>
  )
}

