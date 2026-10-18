import { useEffect, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  TrendingDown,
  User,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getStudentAcademicProfile } from '@/modules/academic/api'
import { StudentAcademicCharts } from '@/modules/academic/components/StudentAcademicCharts'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import type { Alert } from '@/modules/alerts/types'
import { getStudentTimeline } from '@/modules/behavioral/api'
import { BehavioralTimeline } from '@/modules/behavioral/components/BehavioralTimeline'
import type { TimelineEntry } from '@/modules/behavioral/types'
import { getUser } from '@/modules/auth/lib/session'
import { AttentionPlanPanel } from '@/modules/action-plans/components/AttentionPlanPanel'
import type { Student } from '../types'
import { getRiskBadge, getRiskIcon } from '../utils/risk'
import { fetchAttendedAlertsForStudent, StudentInterventionsPanel } from './StudentInterventionsPanel'
import { generateStudentPDF } from '../utils/generateStudentReport'
import { listAlerts } from '@/modules/alerts/api'

interface StudentProfileDialogProps {
  student: Student
  defaultOpen?: boolean
  defaultTab?: 'overview' | 'interventions' | 'attention-plan'
}

const RISK_ACCENT: Record<string, string> = {
  green:  'from-emerald-500/20 to-teal-500/10',
  yellow: 'from-amber-500/20 to-yellow-500/10',
  red:    'from-rose-500/20 to-red-500/10',
  purple: 'from-violet-500/20 to-purple-500/10',
}

const RISK_BORDER: Record<string, string> = {
  green:  'border-emerald-500/30',
  yellow: 'border-amber-500/30',
  red:    'border-rose-500/30',
  purple: 'border-violet-500/30',
}

export function StudentProfileDialog({
  student,
  defaultOpen = false,
  defaultTab = 'overview',
}: StudentProfileDialogProps) {
  const role = getUser()?.active_role
  const planOnly = role === 'docente'
  const showFull  = !planOnly
  const initialTab = planOnly ? 'attention-plan' : defaultTab

  const [open, setOpen]               = useState(defaultOpen)
  const [activeTab, setActiveTab]     = useState(initialTab)
  const [timeline, setTimeline]       = useState<TimelineEntry[]>([])
  const [attendedAlerts, setAttended] = useState<Alert[]>([])
  const [activeAlerts, setActive]     = useState<Alert[]>([])
  const [profile, setProfile]         = useState<StudentAcademicProfile | null>(null)
  const [loading, setLoading]         = useState(false)
  const [generatingPdf, setPdf]       = useState(false)

  const inits = student.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => { if (defaultOpen) setOpen(true) }, [defaultOpen])

  useEffect(() => {
    if (planOnly) { setActiveTab('attention-plan'); return }
    if (defaultTab) setActiveTab(defaultTab)
  }, [defaultTab, planOnly])

  useEffect(() => {
    if (!open || !showFull) return
    setLoading(true)
    Promise.all([
      getStudentTimeline(Number(student.id)),
      getStudentAcademicProfile(Number(student.id)),
      fetchAttendedAlertsForStudent(Number(student.id)),
      listAlerts({ student_id: Number(student.id), status: 'activa' }),
    ])
      .then(([entries, acad, attended, active]) => {
        setTimeline(entries)
        setProfile(acad)
        setAttended(attended)
        setActive(active)
      })
      .catch(() => {
        setTimeline([])
        setProfile(null)
        setAttended([])
        setActive([])
      })
      .finally(() => setLoading(false))
  }, [open, student.id, showFull])

  const handleExportPdf = async () => {
    setPdf(true)
    try {
      generateStudentPDF({
        student,
        profile,
        timeline,
        alerts: [...activeAlerts, ...attendedAlerts],
      })
      toast.success('Reporte PDF generado — se abrirá el diálogo de impresión')
    } catch {
      toast.error('No se pudo generar el reporte')
    } finally {
      setPdf(false)
    }
  }

  const accentGradient = RISK_ACCENT[student.risk] ?? 'from-sky-500/20 to-indigo-500/10'
  const accentBorder   = RISK_BORDER[student.risk]  ?? 'border-sky-500/30'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs h-8"
        >
          {planOnly ? 'Plan de atención' : 'Perfil 360°'}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl border border-white/10 bg-[#080e1f] rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)]">

        {/* ── HEADER ── */}
        <div className="relative shrink-0 overflow-hidden border-b border-white/8">
          {/* Background gradient based on risk */}
          <div className={`absolute inset-0 bg-gradient-to-br ${accentGradient}`} />
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-3xl" />

          <div className="relative z-10 px-6 pt-6 pb-5 pr-14">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-start justify-between gap-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar className={`h-16 w-16 border-2 ${accentBorder} shadow-xl`}>
                      <AvatarFallback className="bg-gradient-to-br from-sky-500 to-violet-600 text-white text-xl font-bold">
                        {inits}
                      </AvatarFallback>
                    </Avatar>
                    {/* Risk dot */}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#080e1f] ${
                      student.risk === 'green'  ? 'bg-emerald-500' :
                      student.risk === 'yellow' ? 'bg-amber-500'   :
                      student.risk === 'red'    ? 'bg-red-500'     : 'bg-violet-500'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-2xl font-display font-bold text-white truncate">
                      {student.displayName}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-400 mt-0.5 truncate">
                      {student.course}
                      {student.nationalId ? ` · C.I. ${student.nationalId}` : ''}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-2.5 py-0.5 text-xs text-slate-200 font-medium">
                        {getRiskIcon(student.risk)}
                        {getRiskBadge(student.risk)}
                      </span>
                      {student.guardianName && (
                        <span className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-2.5 py-0.5 text-xs text-slate-400">
                          <User className="h-3 w-3" />
                          {student.guardianName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Export PDF button */}
                {showFull && (
                  <Button
                    size="sm"
                    onClick={() => void handleExportPdf()}
                    disabled={generatingPdf || loading}
                    className="shrink-0 gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold h-9 transition-all"
                  >
                    {generatingPdf ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
                    ) : (
                      <><Download className="h-3.5 w-3.5" /> Exportar PDF</>
                    )}
                  </Button>
                )}
              </div>
            </DialogHeader>

            {/* ── Quick KPI strip ── */}
            {showFull && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                <div className="flex items-center gap-2.5 bg-black/30 rounded-2xl px-3 py-2.5 border border-white/8">
                  <BookOpen className="h-4 w-4 text-sky-400 shrink-0" />
                  <div>
                    <p className={`text-lg font-black leading-none ${
                      student.average > 0 && student.average < 7 ? 'text-rose-400' : 'text-white'
                    }`}>
                      {student.average > 0 ? student.average.toFixed(1) : '—'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Promedio</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-black/30 rounded-2xl px-3 py-2.5 border border-white/8">
                  <CalendarDays className="h-4 w-4 text-amber-400 shrink-0" />
                  <div>
                    <p className={`text-lg font-black leading-none ${student.absences > 15 ? 'text-rose-400' : 'text-white'}`}>
                      {profile?.absence_count ?? student.absences}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Faltas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-black/30 rounded-2xl px-3 py-2.5 border border-white/8">
                  <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />
                  <div>
                    <p className={`text-lg font-black leading-none ${activeAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {activeAlerts.length}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Alertas activas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-black/30 rounded-2xl px-3 py-2.5 border border-white/8">
                  <FileText className="h-4 w-4 text-violet-400 shrink-0" />
                  <div>
                    <p className="text-lg font-black leading-none text-white">{timeline.length}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Registros</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {planOnly ? (
            <AttentionPlanPanel studentId={Number(student.id)} />
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'overview' | 'interventions' | 'attention-plan')}
            >
              <TabsList className="grid h-11 w-full grid-cols-3 bg-black/30 border border-white/10 rounded-2xl p-1 mb-5">
                <TabsTrigger
                  value="overview"
                  className="text-xs sm:text-sm rounded-xl font-medium text-slate-400 data-[state=active]:bg-white/10 data-[state=active]:text-sky-400 data-[state=active]:shadow-sm transition-all"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                  Resumen 360
                </TabsTrigger>
                <TabsTrigger
                  value="interventions"
                  className="text-xs sm:text-sm rounded-xl font-medium text-slate-400 data-[state=active]:bg-white/10 data-[state=active]:text-sky-400 data-[state=active]:shadow-sm transition-all"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                  <span className="hidden sm:inline">Intervenciones</span>
                  <span className="sm:hidden">Interv.</span>
                </TabsTrigger>
                <TabsTrigger
                  value="attention-plan"
                  className="text-xs sm:text-sm rounded-xl font-medium text-slate-400 data-[state=active]:bg-white/10 data-[state=active]:text-sky-400 data-[state=active]:shadow-sm transition-all"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                  Plan de Acción
                </TabsTrigger>
              </TabsList>

              {/* ── Overview Tab ── */}
              <TabsContent value="overview" className="focus-visible:outline-none">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border border-sky-500/30 bg-sky-500/10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-sky-500/15 animate-ping" />
                    </div>
                    <p className="text-sm">Cargando perfil integral...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Academic charts */}
                    <div className="glass-panel rounded-2xl border border-white/10 p-4 shadow-lg">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Rendimiento Académico
                      </p>
                      <StudentAcademicCharts
                        profile={profile}
                        subjectScores={profile?.subject_scores ?? []}
                        attendanceTrend={profile?.attendance_trend ?? []}
                        compact
                        subjectsView="radar"
                      />
                    </div>

                    {/* Behavioral timeline */}
                    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                      <div className="px-4 py-3 bg-black/20 border-b border-white/8 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Historial Conductual
                        </p>
                        {timeline.length > 0 && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30">
                            {timeline.length}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <BehavioralTimeline entries={timeline} maxHeight="320px" />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Interventions Tab ── */}
              <TabsContent value="interventions" className="focus-visible:outline-none">
                <StudentInterventionsPanel
                  timeline={timeline}
                  attendedAlerts={attendedAlerts}
                  loading={loading}
                />
              </TabsContent>

              {/* ── Attention Plan Tab ── */}
              <TabsContent value="attention-plan" className="focus-visible:outline-none">
                <AttentionPlanPanel studentId={Number(student.id)} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
