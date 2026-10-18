import { useEffect, useState } from 'react'
import { ClipboardList, GraduationCap, HeartHandshake, Loader2, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentAcademicCharts } from '@/modules/academic/components/StudentAcademicCharts'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import {
  getActivePlanForStudent,
  getSharedPlanSummary,
  type SharedPlanSummary,
} from '@/modules/action-plans/api'
import { BehavioralTimeline } from '@/modules/behavioral/components/BehavioralTimeline'
import type { TimelineEntry } from '@/modules/behavioral/types'
import type { Student } from '@/modules/students/types'
import { getRiskBadge, getRiskIcon } from '@/modules/students/utils/risk'

export type GuardianDetailTab = 'academic' | 'updates' | 'tips' | 'plan'

interface GuardianChildDetailDialogProps {
  student: Student | null
  profile: StudentAcademicProfile | null
  timeline: TimelineEntry[]
  recommendations: { title: string; text: string; tone: 'rose' | 'amber' | 'emerald' }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: GuardianDetailTab
  loading?: boolean
}

const toneCard = {
  rose: 'border-rose-400/30 bg-rose-500/10',
  amber: 'border-amber-400/30 bg-amber-500/10',
  emerald: 'border-emerald-400/30 bg-emerald-500/10',
}

const toneTitle = {
  rose: 'text-rose-100',
  amber: 'text-amber-100',
  emerald: 'text-emerald-100',
}

const toneBody = {
  rose: 'text-rose-100/80',
  amber: 'text-amber-100/80',
  emerald: 'text-emerald-100/80',
}

const COMMITMENT_STATUS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  reported_completed: 'En revisión',
  validated: 'Cumplido',
}

export function GuardianChildDetailDialog({
  student,
  profile,
  timeline,
  recommendations,
  open,
  onOpenChange,
  defaultTab = 'academic',
  loading = false,
}: GuardianChildDetailDialogProps) {
  const [tab, setTab] = useState(defaultTab)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SharedPlanSummary | null>(null)
  const [summaryLoadedFor, setSummaryLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  useEffect(() => {
    if (!open || !student) {
      setSummary(null)
      setSummaryLoadedFor(null)
      setPlanError(null)
      return
    }
    if (tab !== 'plan') return
    if (summaryLoadedFor === student.id) return

    let cancelled = false
    async function loadPlan() {
      setPlanLoading(true)
      setPlanError(null)
      try {
        const studentId = Number(student!.id)
        const active = await getActivePlanForStudent(studentId)
        if (cancelled) return
        if (!active) {
          setSummary(null)
          setSummaryLoadedFor(student!.id)
          return
        }
        const shared = await getSharedPlanSummary(active.id)
        if (cancelled) return
        setSummary(shared)
        setSummaryLoadedFor(student!.id)
      } catch {
        if (!cancelled) {
          setSummary(null)
          setPlanError('No se pudo cargar los compromisos compartidos en este momento.')
        }
      } finally {
        if (!cancelled) setPlanLoading(false)
      }
    }
    void loadPlan()
    return () => {
      cancelled = true
    }
  }, [open, student, tab, summaryLoadedFor])

  if (!student) return null

  const initials = student.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="shrink-0 border-b border-white/10 bg-gradient-to-br from-primary/20 via-transparent to-cyan-500/10 px-6 pb-4 pt-6 pr-12">
          <DialogHeader className="space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300/90">
              Seguimiento de su hijo/a
            </p>
            <DialogTitle className="flex items-center gap-3 text-white">
              <Avatar className="h-12 w-12 shrink-0 border-2 border-white/20">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate text-lg">{student.displayName}</span>
                <p className="truncate text-sm font-normal text-slate-400">{student.course}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-0 text-slate-300">
              {getRiskIcon(student.risk)}
              <span className="inline-flex items-center gap-2">Estado: {getRiskBadge(student.risk)}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as GuardianDetailTab)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger value="academic" className="gap-1 text-xs sm:text-sm">
                <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                Académico
              </TabsTrigger>
              <TabsTrigger value="updates" className="gap-1 text-xs sm:text-sm">
                <HeartHandshake className="h-3.5 w-3.5 shrink-0" />
                Novedades
              </TabsTrigger>
              <TabsTrigger value="tips" className="gap-1 text-xs sm:text-sm">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                Consejos
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-1 text-xs sm:text-sm">
                <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                Compromisos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="academic" className="mt-4 focus-visible:outline-none">
              {loading ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Cargando rendimiento...
                </div>
              ) : (
                <StudentAcademicCharts
                  profile={profile}
                  subjectScores={profile?.subject_scores ?? []}
                  attendanceTrend={profile?.attendance_trend ?? []}
                  subjectsView="radar"
                />
              )}
            </TabsContent>

            <TabsContent value="updates" className="mt-4 focus-visible:outline-none">
              {loading ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Cargando novedades...
                </div>
              ) : (
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <p className="mb-3 text-sm text-slate-400">
                    Registro institucional de seguimiento DECE y tutoría visible para usted como
                    representante.
                  </p>
                  <BehavioralTimeline entries={timeline} maxHeight="420px" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="tips" className="mt-4 space-y-3 focus-visible:outline-none">
              {recommendations.map((item) => (
                <div
                  key={item.title}
                  className={`rounded-xl border p-4 ${toneCard[item.tone]}`}
                >
                  <p className={`text-sm font-semibold ${toneTitle[item.tone]}`}>{item.title}</p>
                  <p className={`mt-1 text-sm ${toneBody[item.tone]}`}>{item.text}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="plan" className="mt-4 focus-visible:outline-none">
              {planLoading ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Cargando compromisos...
                </div>
              ) : planError ? (
                <p className="text-sm text-destructive">{planError}</p>
              ) : !summary ? (
                <div className="rounded-xl border border-white/15 bg-white/5 p-5 text-sm text-slate-400">
                  Aún no hay un plan de atención activo compartido para este estudiante.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Objetivo del acompañamiento
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">
                      {summary.general_objective || 'Objetivo no disponible mientras el plan no esté activo.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-100">Avance validado</p>
                      <span className="text-sm font-semibold text-sky-300">
                        {summary.validated_progress_pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, summary.validated_progress_pct))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-100">Compromisos</p>
                    {!summary.commitments.length ? (
                      <p className="text-sm text-slate-400">Sin compromisos visibles por ahora.</p>
                    ) : (
                      summary.commitments.map((item, idx) => (
                        <div
                          key={`${item.title}-${idx}`}
                          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-100">{item.title}</p>
                            <Badge variant="secondary">
                              {COMMITMENT_STATUS[item.status] || item.status}
                            </Badge>
                          </div>
                          {item.due_hint ? (
                            <p className="mt-1 text-xs text-slate-400">
                              Plazo orientativo: {item.due_hint}
                            </p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
