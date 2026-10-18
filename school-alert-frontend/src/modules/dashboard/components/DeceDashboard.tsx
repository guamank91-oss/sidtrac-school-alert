import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  ExternalLink,
  Loader2,
  Mic,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VoiceDictationModal } from '@/modules/behavioral/components/VoiceDictationModal'
import { getAlertStats, listAlerts } from '@/modules/alerts/api'
import { RISK_BADGE_CLASSES, RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import type { Alert, AlertStats } from '@/modules/alerts/types'
import { getAcademicOverview } from '@/modules/academic/api'
import { parseScore } from '@/modules/academic/utils/formatScore'
import { getBehavioralSummary, listDeceReports } from '@/modules/behavioral/api'
import { DECE_TYPE_LABELS, URGENCY_LABELS } from '@/modules/behavioral/labels'
import type { BehavioralSummary, DeceReport } from '@/modules/behavioral/types'
import { listStudents } from '@/modules/students/api'
import { StudentListTable } from '@/modules/students/components/StudentListTable'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import type { Student } from '@/modules/students/types'
import { RagChatPanel } from '@/modules/rag/components/RagChatPanel'
import { PeriodComparisonPanel } from '@/modules/reports/components/PeriodComparisonPanel'
import { useTermId } from '@/shared/context/PeriodContext'

const URGENCY_GLOW: Record<string, string> = {
  critico: 'shadow-[0_0_20px_rgba(239,68,68,0.25)] border-red-500/40 bg-red-500/10',
  alto:    'shadow-[0_0_20px_rgba(249,115,22,0.25)] border-orange-500/40 bg-orange-500/10',
  medio:   'shadow-[0_0_20px_rgba(245,158,11,0.15)] border-amber-500/40 bg-amber-500/5',
  bajo:    'shadow-[0_0_20px_rgba(16,185,129,0.15)] border-emerald-500/40 bg-emerald-500/5',
}

const URGENCY_DOT: Record<string, string> = {
  critico: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  alto:    'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]',
  medio:   'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
  bajo:    'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
}

export function DeceDashboard() {
  const navigate = useNavigate()
  const termId = useTermId()
  const [students, setStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<DeceReport[]>([])
  const [summary, setSummary] = useState<BehavioralSummary | null>(null)
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [dictationModalOpen, setDictationModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentRows, reportRows, summaryData, overview, stats, alerts] = await Promise.all([
        listStudents({ term_id: termId }),
        listDeceReports({ term_id: termId }),
        getBehavioralSummary(termId),
        getAcademicOverview(undefined, termId),
        getAlertStats(termId),
        listAlerts({ status: 'activa', term_id: termId }),
      ])

      const overviewMap = new Map(overview.map((o) => [o.student_id, o]))

      const enriched = studentRows.map((row) => {
        const ui = studentRecordToUi(row)
        const academic = overviewMap.get(row.id)
        if (academic) {
          const avg = parseScore(academic.average_score)
          ui.average = avg ?? 0
          const total = academic.absence_count + academic.tardy_count
          ui.absences = total > 0 ? Math.min(100, Math.round((total / 20) * 100)) : 0
        }
        return ui
      })

      setStudents(enriched)
      setReports(reportRows.slice(0, 6))
      setSummary(summaryData)
      setAlertStats(stats)
      setRecentAlerts(alerts.slice(0, 5))
    } finally {
      setLoading(false)
    }
  }, [termId])

  useEffect(() => { void load() }, [load])

  const criticalAlerts = alertStats?.active_critical ?? 0
  const warningAlerts  = alertStats?.active_high     ?? 0
  const mediumAlerts   = alertStats?.active_medium   ?? 0
  const stablePct      = alertStats?.low_pct         ?? 0
  const totalAlerts    = criticalAlerts + warningAlerts + mediumAlerts

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-400">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border border-sky-500/30 bg-sky-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-sky-500/20 animate-ping" />
        </div>
        <p className="text-sm font-medium">Cargando Panel DECE...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8 glass-panel">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600/20 via-blue-600/15 to-purple-600/20" />
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  Panel DECE
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">Vista integral del sistema de alerta temprana</p>
              </div>
            </div>
            {totalAlerts > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''} activa{totalAlerts !== 1 ? 's' : ''} requieren atención
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Button
              onClick={() => setDictationModalOpen(true)}
              className="gap-2 flex-1 sm:flex-none h-10 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-semibold shadow-[0_0_20px_rgba(14,165,233,0.2)] hover:shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all duration-300"
            >
              <Mic className="h-4 w-4" />
              Dictado Voz
            </Button>
            <Button
              onClick={() => navigate('/rag')}
              className="gap-2 flex-1 sm:flex-none h-10 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-semibold shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.35)] transition-all duration-300"
            >
              <Sparkles className="h-4 w-4" />
              Consulta IA
            </Button>
            <Button
              onClick={() => navigate('/alerts')}
              className="gap-2 flex-1 sm:flex-none h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold transition-all duration-300"
            >
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI BENTO GRID ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">

        {/* Total Estudiantes */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-white/10 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="h-10 w-10 rounded-2xl bg-blue-500/15 flex items-center justify-center border border-blue-500/25 mb-4 group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-display font-black text-white">{students.length}</p>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">Total Estudiantes</p>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-blue-400">
            <TrendingUp className="h-3 w-3" />
            Matriculados
          </div>
        </div>

        {/* Alertas Críticas */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-red-500/30 bg-red-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(239,68,68,0.25)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-red-500/20 rounded-full blur-2xl group-hover:bg-red-500/30 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30 mb-4 shadow-[0_0_15px_rgba(239,68,68,0.3)] group-hover:scale-110 transition-transform">
            <XCircle className="h-5 w-5 text-red-400" />
          </div>
          <p className="text-3xl font-display font-black text-red-400 relative z-10">{criticalAlerts}</p>
          <p className="text-xs font-semibold text-red-300/80 mt-1 uppercase tracking-wider relative z-10">Alertas Críticas</p>
          {criticalAlerts > 0 && (
            <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-red-400 relative z-10">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Atención urgente
            </div>
          )}
        </div>

        {/* Alertas Altas */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-orange-500/30 bg-orange-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-orange-500/15 rounded-full blur-2xl group-hover:bg-orange-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 mb-4 shadow-[0_0_15px_rgba(249,115,22,0.3)] group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
          </div>
          <p className="text-3xl font-display font-black text-orange-400 relative z-10">{warningAlerts}</p>
          <p className="text-xs font-semibold text-orange-300/80 mt-1 uppercase tracking-wider relative z-10">Alertas Altas</p>
          {warningAlerts > 0 && (
            <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-orange-400 relative z-10">
              <ArrowRight className="h-3 w-3" />
              Prioridad alta
            </div>
          )}
        </div>

        {/* Alertas Medias */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-amber-500/30 bg-amber-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-display font-black text-amber-400">{mediumAlerts}</p>
          <p className="text-xs font-semibold text-amber-300/80 mt-1 uppercase tracking-wider">Alertas Medias</p>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Monitoreo
          </div>
        </div>

        {/* Estables */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-emerald-500/30 bg-emerald-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl group-hover:bg-emerald-500/25 transition-colors" />
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-display font-black text-emerald-400 relative z-10">{stablePct}%</p>
          <p className="text-xs font-semibold text-emerald-300/80 mt-1 uppercase tracking-wider relative z-10">Estables</p>
          <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden relative z-10">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${stablePct}%` }} />
          </div>
        </div>

        {/* Reportes DECE */}
        <div className="relative overflow-hidden rounded-3xl p-5 glass-panel border border-indigo-500/30 bg-indigo-500/5 group hover:-translate-y-1 transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 mb-4 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:scale-110 transition-transform">
            <ClipboardList className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-display font-black text-indigo-400">{summary?.dece_reports ?? 0}</p>
          <p className="text-xs font-semibold text-indigo-300/80 mt-1 uppercase tracking-wider">Reportes DECE</p>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-indigo-400">
            <ClipboardList className="h-3 w-3" />
            Documentados
          </div>
        </div>
      </div>

      {/* ── STUDENTS TABLE + RECENT ALERTS ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Student List */}
        <div className="lg:col-span-2 glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 bg-black/20 border-b border-white/5">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-400" />
                Listado de Estudiantes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Monitoreo integral con datos académicos reales</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/students')}
              className="gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
            >
              Ver todos
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
          <StudentListTable
            students={students}
            showCourseFilter={true}
            maxHeight="440px"
          />
        </div>

        {/* Recent Alerts */}
        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 bg-black/20 border-b border-white/5">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                Alertas Activas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Priorizadas por nivel de riesgo</p>
            </div>
            {recentAlerts.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                {recentAlerts.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <ShieldCheck className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sin alertas activas</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[180px]">El semáforo institucional está bajo control</p>
                </div>
              </div>
            ) : (
              recentAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer relative overflow-hidden group ${URGENCY_GLOW[a.level] ?? 'border-white/10 bg-white/5'}`}
                  onClick={() => navigate('/alerts')}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-gradient-to-b from-current to-transparent opacity-60" style={{
                    color: a.level === 'critico' ? '#ef4444' : a.level === 'alto' ? '#f97316' : a.level === 'medio' ? '#f59e0b' : '#10b981'
                  }} />
                  <div className="flex items-start justify-between gap-2 pl-2 mb-2">
                    <span className="font-semibold text-white text-sm leading-tight flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${URGENCY_DOT[a.level] ?? 'bg-slate-400'}`} />
                      {a.student_name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold shrink-0 ${RISK_BADGE_CLASSES[a.level] ?? ''} border`}
                    >
                      {RISK_LEVEL_LABELS[a.level]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 pl-2">{a.description}</p>
                  {a.course_name && (
                    <p className="text-[10px] text-slate-500 mt-2 pl-2 font-medium">{a.course_name}</p>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-white/5 bg-black/10">
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all gap-2"
              onClick={() => navigate('/alerts')}
            >
              Ver todas las alertas
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── DECE REPORTS + RAG ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* DECE Reports */}
        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 bg-black/20 border-b border-white/5">
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-400" />
                Reportes recientes DECE
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Últimos registros del departamento</p>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <ClipboardList className="h-7 w-7 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sin reportes aún</p>
                  <p className="text-xs text-slate-400 mt-1">Registre el primero en Seguimiento</p>
                </div>
              </div>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/8 bg-white/5 hover:bg-white/10 p-4 transition-all duration-200 hover:-translate-y-0.5 group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-white text-sm">{r.student_name}</span>
                    <div className="flex gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                        {DECE_TYPE_LABELS[r.report_type]}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.urgency_level === 'critico' ? 'bg-red-500/20 border border-red-500/30 text-red-300' :
                        r.urgency_level === 'alto'    ? 'bg-orange-500/20 border border-orange-500/30 text-orange-300' :
                        r.urgency_level === 'medio'   ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300' :
                        'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                      }`}>
                        {URGENCY_LABELS[r.urgency_level]}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{r.description}</p>
                  {r.reported_at && (
                    <p className="text-[10px] text-slate-500 mt-2 font-medium">
                      {new Date(r.reported_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-white/5 bg-black/10">
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all gap-2"
              onClick={() => navigate('/behavioral')}
            >
              Ver seguimiento conductual
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* RAG Chat */}
        <div className="relative glass-panel border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.12)] rounded-3xl overflow-hidden flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-blue-600/5 to-transparent pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-3 px-5 py-4 bg-black/20 border-b border-purple-500/20 relative z-10">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Asistente RAG</h2>
              <p className="text-xs text-purple-300/70 mt-0.5">Consulta en lenguaje natural sobre cualquier estudiante</p>
            </div>
          </div>
          <div className="flex-1 p-5 relative z-10">
            <RagChatPanel />
          </div>
        </div>
      </div>

      {/* ── PERIOD COMPARISON ───────────────────────────────────────────── */}
      <PeriodComparisonPanel />

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      <VoiceDictationModal
        open={dictationModalOpen}
        onOpenChange={setDictationModalOpen}
      />
    </div>
  )
}
