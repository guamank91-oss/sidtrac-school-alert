import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStudentAcademicProfile } from '@/modules/academic/api'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import { formatScore, parseScore } from '@/modules/academic/utils/formatScore'
import { getStudentTimeline } from '@/modules/behavioral/api'
import type { TimelineEntry } from '@/modules/behavioral/types'
import { listStudents } from '@/modules/students/api'
import { useTermId } from '@/shared/context/PeriodContext'
import type { Student } from '@/modules/students/types'
import { buildRecommendations } from '@/modules/dashboard/utils/buildRecommendations'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import { getRiskBadge } from '@/modules/students/utils/risk'
import type { RiskLevelUI } from '@/shared/types/roles'
import {
  GuardianChildDetailDialog,
  type GuardianDetailTab,
} from './GuardianChildDetailDialog'
import { buildGuardianInbox, GuardianInboxPanel } from './GuardianInboxPanel'

function statusConfig(risk: RiskLevelUI) {
  switch (risk) {
    case 'green':
      return {
        card: 'border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)] glass-panel',
        iconBg: 'bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        icon: CheckCircle,
        iconColor: 'text-emerald-400',
        title: 'Estable',
        titleColor: 'text-emerald-400',
        textColor: 'text-emerald-200/90 font-medium',
        message: 'Su hijo/a mantiene un desempeño adecuado en el plantel',
      }
    case 'yellow':
      return {
        card: 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.15)] glass-panel',
        iconBg: 'bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        icon: AlertTriangle,
        iconColor: 'text-amber-400',
        title: 'Requiere Atención',
        titleColor: 'text-amber-400',
        textColor: 'text-amber-200/90 font-medium',
        message: 'Hemos detectado áreas de mejora que necesitan su apoyo en casa',
      }
    case 'red':
      return {
        card: 'border-orange-500/30 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.15)] glass-panel',
        iconBg: 'bg-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.3)]',
        icon: AlertTriangle,
        iconColor: 'text-orange-400',
        title: 'Atención Urgente',
        titleColor: 'text-orange-400',
        textColor: 'text-orange-200/90 font-medium',
        message: 'Existen indicadores que requieren seguimiento inmediato desde el hogar',
      }
    case 'purple':
      return {
        card: 'border-red-500/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)] glass-panel',
        iconBg: 'bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
        icon: AlertTriangle,
        iconColor: 'text-red-400',
        title: 'Atención Muy Urgente',
        titleColor: 'text-red-400',
        textColor: 'text-red-200/90 font-medium',
        message: 'Existen indicadores críticos que requieren intervención prioritaria',
      }
  }
}



const toneIcon = {
  rose: { bg: 'bg-rose-500/15 border border-rose-400/25', icon: TrendingDown, color: 'text-rose-300' },
  amber: { bg: 'bg-amber-500/15 border border-amber-400/25', icon: Clock, color: 'text-amber-300' },
  emerald: { bg: 'bg-emerald-500/15 border border-emerald-400/25', icon: TrendingUp, color: 'text-emerald-300' },
}

function childInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function GuardianDashboard() {
  const termId = useTermId()
  const [children, setChildren] = useState<Student[]>([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<GuardianDetailTab>('academic')
  const [contactOpen, setContactOpen] = useState(false)

  const loadChildren = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listStudents({ term_id: termId })
      const mapped = rows.map(studentRecordToUi)
      setChildren(mapped)
      if (mapped.length > 0) {
        setSelectedChildId((prev) => prev || mapped[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [termId])

  useEffect(() => {
    loadChildren()
  }, [loadChildren])

  const student = useMemo(
    () => children.find((c) => c.id === selectedChildId) ?? children[0],
    [children, selectedChildId]
  )

  useEffect(() => {
    if (!student) return
    setLoadingProfile(true)
    Promise.all([
      getStudentAcademicProfile(Number(student.id)),
      getStudentTimeline(Number(student.id)),
    ])
      .then(([academicProfile, entries]) => {
        setProfile(academicProfile)
        setTimeline(entries)
      })
      .catch(() => {
        setProfile(null)
        setTimeline([])
      })
      .finally(() => setLoadingProfile(false))
  }, [student])

  const openDetail = (tab: GuardianDetailTab) => {
    setDetailTab(tab)
    setDetailOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Cargando información...
      </div>
    )
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-muted-foreground">
        <UserRound className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p>No hay estudiantes vinculados a su cuenta de representante.</p>
      </div>
    )
  }

  const status = statusConfig(student.risk)
  const StatusIcon = status.icon
  const average =
    profile?.average_score !== null && profile?.average_score !== undefined
      ? parseScore(profile.average_score)
      : null
  const attendance =
    profile?.attendance_rate ??
    (profile ? Math.max(0, 100 - profile.absence_count * 5) : null)
  const recommendations = buildRecommendations(student, profile)
  const inboxItems = buildGuardianInbox(student, profile, timeline)

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4 glass-panel p-5 rounded-3xl border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent" aria-hidden />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Portal familiar</p>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">Seguimiento de mi hijo/a</h1>
        </div>
        {children.length > 1 && (
          <Select value={selectedChildId} onValueChange={setSelectedChildId}>
            <SelectTrigger className="w-48 rounded-full border-white/10 bg-white/5 backdrop-blur-md text-white relative z-10">
              <SelectValue placeholder="Seleccionar hijo" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.firstName} {child.lastName.split(' ')[0]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((child) => {
            const active = child.id === student.id
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedChildId(child.id)}
                className={`flex shrink-0 items-center gap-3 rounded-full border px-4 py-2 text-left transition-all duration-300 ${
                  active
                    ? 'border-blue-500/30 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Avatar className="h-9 w-9 border-2 border-white/10 shadow-sm">
                  <AvatarFallback className={active ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-bold text-xs' : 'bg-black/40 text-slate-300 text-xs'}>
                    {childInitials(child.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pr-2">
                  <p className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}>{child.firstName}</p>
                  <p className={`truncate text-xs ${active ? 'text-blue-200' : 'text-slate-500'}`}>{child.course}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Card className={`overflow-hidden rounded-3xl transition-all duration-500 ${status.card}`}>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <Avatar className="h-24 w-24 border-[3px] border-white/20 shadow-xl shadow-black/20">
              <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-2xl font-display font-bold text-white">
                {childInitials(student.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <h2 className="text-2xl font-display font-bold text-white">{student.displayName}</h2>
                <div className="scale-110 origin-left">{getRiskBadge(student.risk)}</div>
              </div>
              <p className="text-sm font-medium text-slate-300 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/10 mx-auto sm:mx-0">{student.course}</p>
              <div className={`flex items-center justify-center gap-3 sm:justify-start mt-2 ${status.titleColor}`}>
                <div className={`rounded-full p-2.5 ${status.iconBg}`}>
                  <StatusIcon className={`h-6 w-6 ${status.iconColor}`} />
                </div>
                <div>
                  <p className="font-bold text-lg">{status.title}</p>
                  <p className={`text-sm mt-0.5 ${status.textColor}`}>{status.message}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Promedio',
            value: average !== null ? formatScore(average) : '—',
            icon: BookOpen,
            warn: average !== null && average < 7,
          },
          {
            label: 'Asistencia',
            value: attendance !== null ? `${Math.round(attendance)}%` : '—',
            icon: Calendar,
            warn: attendance !== null && attendance < 80,
          },
          {
            label: 'Ausencias',
            value: profile?.absence_count ?? '—',
            icon: AlertTriangle,
            warn: (profile?.absence_count ?? 0) > 5,
          },
          {
            label: 'Tardanzas',
            value: profile?.tardy_count ?? '—',
            icon: Clock,
            warn: (profile?.tardy_count ?? 0) > 3,
          },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card
              key={kpi.label}
              className={`cursor-pointer glass-panel border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg rounded-3xl ${kpi.warn ? 'bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'hover:bg-white/10 hover:border-blue-500/30'}`}
              onClick={() => openDetail('academic')}
            >
              <CardContent className="p-4 text-center flex flex-col justify-between h-full">
                <div className={`mx-auto mb-3 h-10 w-10 rounded-2xl flex items-center justify-center ${kpi.warn ? 'bg-red-500/20 border border-red-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                  <Icon className={`h-5 w-5 ${kpi.warn ? 'text-red-400' : 'text-blue-400'}`} />
                </div>
                {loadingProfile ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-500" />
                ) : (
                  <p className={`text-2xl font-display font-bold tabular-nums ${kpi.warn ? 'text-red-400' : 'text-white'}`}>
                    {kpi.value}
                  </p>
                )}
                <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">{kpi.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Explorar en detalle</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => openDetail('academic')}
            className="group rounded-3xl border border-white/10 glass-panel p-5 text-left transition-all duration-300 hover:border-blue-500/30 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col h-full"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
            <p className="font-display font-bold text-white text-lg">Rendimiento académico</p>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
              Radar por materia, notas y tendencia de asistencia
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Ver gráfico <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => openDetail('updates')}
            className="group rounded-3xl border border-white/10 glass-panel p-5 text-left transition-all duration-300 hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col h-full"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <HeartHandshake className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="font-display font-bold text-white text-lg">Novedades escolares</p>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
              Seguimiento DECE, tutoría e intervenciones
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {timeline.length} registro{timeline.length !== 1 ? 's' : ''}{' '}
              <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => openDetail('tips')}
            className="group rounded-3xl border border-white/10 glass-panel p-5 text-left transition-all duration-300 hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-col h-full"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Sparkles className="h-6 w-6 text-amber-400" />
            </div>
            <p className="font-display font-bold text-white text-lg">Consejos para el hogar</p>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed flex-1">
              Recomendaciones personalizadas según el perfil
            </p>
            <span className="mt-4 inline-flex items-center text-xs font-semibold text-amber-400 uppercase tracking-wider">
              {recommendations.length} consejo{recommendations.length !== 1 ? 's' : ''}{' '}
              <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </div>

      <Card className="glass-panel border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] rounded-3xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent pointer-events-none" />
        <CardHeader className="pb-4 relative z-10 border-b border-purple-500/20 bg-black/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
              <CardTitle className="text-lg font-display text-white">Recomendaciones para usted</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full hover:bg-white/10 text-purple-300 hover:text-white transition-colors" onClick={() => openDetail('tips')}>
              Ver todas <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5 relative z-10">
          {recommendations.slice(0, 2).map((item) => {
            const cfg = toneIcon[item.tone]
            const Icon = cfg.icon
            return (
              <div
                key={item.title}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] group"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${cfg.bg} shadow-lg transition-transform group-hover:scale-110`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">{item.text}</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="glass-panel border-white/10 rounded-3xl overflow-hidden">
        <GuardianInboxPanel
          items={inboxItems}
          onViewAll={() => openDetail('updates')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button className="gap-2 rounded-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all text-sm font-semibold" onClick={() => openDetail('academic')}>
          <GraduationCap className="h-5 w-5" />
          Ver perfil académico
        </Button>
        <Button className="gap-2 rounded-full h-12 border-white/20 bg-white/5 hover:bg-white/10 text-white shadow-lg transition-all text-sm font-semibold" variant="outline" onClick={() => setContactOpen(true)}>
          <MessageSquare className="h-5 w-5 text-emerald-400" />
          Contactar al Tutor
        </Button>
      </div>

      <GuardianChildDetailDialog
        student={student}
        profile={profile}
        timeline={timeline}
        recommendations={recommendations}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        defaultTab={detailTab}
        loading={loadingProfile}
      />

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contactar al tutor</DialogTitle>
            <DialogDescription>
              Coordinación institucional para {student.firstName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="font-medium">Curso: {student.course}</p>
              <p className="mt-2 text-muted-foreground">
                Para citas, entrevistas o consultas sobre el rendimiento de su hijo/a, comuníquese
                con la institución a través de los canales oficiales o acérquese al departamento de
                convivencia / DECE.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              SIDTRAC notificará por correo y buzón interno cuando existan alertas que requieran su
              participación.
            </p>
            <Button className="w-full" onClick={() => setContactOpen(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
