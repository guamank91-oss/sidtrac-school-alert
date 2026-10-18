import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { getUser } from '@/modules/auth/lib/session'
import { listStudents } from '@/modules/students/api'
import type { StudentRecord } from '@/modules/students/types'
import { useTermId, usePeriod } from '@/shared/context/PeriodContext'
import type { RiskLevel } from '@/shared/types/roles'
import {
  attendAlert,
  createManualAlert,
  getAlertStats,
  listAlerts,
  runEvaluation,
} from '../api'
import {
  ALERT_STATUS_LABELS,
  ALERT_TYPE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_DOT_CLASSES,
  RISK_LEVEL_LABELS,
} from '../labels'
import type { Alert, AlertStats, AlertStatus, AlertType } from '../types'

const ALL = 'todos'

export function AlertsPage() {
  const user = getUser()
  const termId = useTermId()
  const { isViewingActiveTerm } = usePeriod()
  const canManage =
    (user?.active_role === 'administrador' || user?.active_role === 'dece') && isViewingActiveTerm
  const [searchParams] = useSearchParams()

  const studentParam = searchParams.get('student')
  const statusParam = searchParams.get('status')

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>(statusParam ?? 'activa')
  const [levelFilter, setLevelFilter] = useState<string>(ALL)
  const [typeFilter, setTypeFilter] = useState<string>(ALL)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const [attendTarget, setAttendTarget] = useState<Alert | null>(null)
  const [actionsTaken, setActionsTaken] = useState('')
  const [attending, setAttending] = useState(false)

  const [manualOpen, setManualOpen] = useState(false)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [manualStudent, setManualStudent] = useState('')
  const [manualType, setManualType] = useState<AlertType>('academica')
  const [manualLevel, setManualLevel] = useState<RiskLevel>('medio')
  const [manualDescription, setManualDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [alertList, alertStats] = await Promise.all([
        listAlerts({
          status: statusFilter !== ALL ? (statusFilter as AlertStatus) : undefined,
          level: levelFilter !== ALL ? (levelFilter as RiskLevel) : undefined,
          alert_type: typeFilter !== ALL ? (typeFilter as AlertType) : undefined,
          student_id: studentParam ? Number(studentParam) : undefined,
          term_id: termId,
        }),
        getAlertStats(termId),
      ])
      setAlerts(alertList)
      setStats(alertStats)
    } catch {
      toast.error('No se pudieron cargar las alertas')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, levelFilter, typeFilter, studentParam, termId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (statusParam) {
      setStatusFilter(statusParam)
    }
  }, [statusParam])

  useEffect(() => {
    if (manualOpen && students.length === 0) {
      listStudents({ term_id: termId })
        .then(setStudents)
        .catch(() => toast.error('No se pudieron cargar los estudiantes'))
    }
  }, [manualOpen, students.length, termId])

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      const result = await runEvaluation()
      toast.success(
        `Evaluación completada: ${result.students_evaluated} estudiantes, ` +
          `${result.alerts_created} alertas nuevas, ${result.emails_sent} correos enviados`
      )
      await load()
    } catch {
      toast.error('La evaluación falló')
    } finally {
      setEvaluating(false)
    }
  }

  const handleAttend = async () => {
    if (!attendTarget || actionsTaken.trim().length < 5) {
      toast.error('Describe las acciones realizadas (mínimo 5 caracteres)')
      return
    }
    setAttending(true)
    try {
      await attendAlert(attendTarget.id, actionsTaken.trim())
      toast.success('Alerta atendida y archivada')
      setAttendTarget(null)
      setActionsTaken('')
      await load()
    } catch {
      toast.error('No se pudo atender la alerta')
    } finally {
      setAttending(false)
    }
  }

  const handleCreateManual = async () => {
    if (!manualStudent || manualDescription.trim().length < 5) {
      toast.error('Selecciona un estudiante y describe la alerta')
      return
    }
    setCreating(true)
    try {
      await createManualAlert({
        student_id: Number(manualStudent),
        alert_type: manualType,
        level: manualLevel,
        description: manualDescription.trim(),
      })
      toast.success('Alerta manual registrada')
      setManualOpen(false)
      setManualStudent('')
      setManualDescription('')
      await load()
    } catch {
      toast.error('No se pudo crear la alerta')
    } finally {
      setCreating(false)
    }
  }

  const statCards = useMemo(
    () => [
      {
        label: 'Alertas críticas',
        value: stats?.active_critical ?? 0,
        icon: ShieldAlert,
        accent: 'text-red-600 bg-red-100',
      },
      {
        label: 'Alertas altas',
        value: stats?.active_high ?? 0,
        icon: AlertTriangle,
        accent: 'text-orange-600 bg-orange-100',
      },
      {
        label: 'Alertas medias',
        value: stats?.active_medium ?? 0,
        icon: BellRing,
        accent: 'text-amber-600 bg-amber-100',
      },
      {
        label: 'Estudiantes sin riesgo',
        value: `${stats?.low_pct ?? 100}%`,
        icon: ShieldCheck,
        accent: 'text-emerald-600 bg-emerald-100',
      },
    ],
    [stats]
  )

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10" aria-hidden />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                <BellRing className="h-6 w-6 text-red-400" />
              </div>
              Alertas Tempranas
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl">
              Semáforo de riesgo institucional y gestión de alertas
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleEvaluate} disabled={evaluating} className="border-white/20 bg-black/20 hover:bg-white/10">
                <RefreshCw className={`h-4 w-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
                Evaluar ahora
              </Button>
              <Button onClick={() => setManualOpen(true)} className="bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/25">
                <Plus className="h-4 w-4 mr-2" />
                Alerta manual
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {statCards.map((card) => (
          <Card key={card.label} className="glass-panel group card-hover relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-tr ${card.label.includes('críticas') ? 'from-red-500/5' : card.label.includes('altas') ? 'from-orange-500/5' : card.label.includes('medias') ? 'from-amber-500/5' : 'from-emerald-500/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <CardContent className="p-6 flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <p className="text-3xl font-display font-bold mt-1 text-white">{card.value}</p>
              </div>
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border group-hover:scale-110 transition-transform ${card.accent}`}>
                <card.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-panel border-white/10 shadow-xl overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
        <CardHeader className="pb-4 bg-black/20 border-b border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-display">Listado de alertas</CardTitle>
              <CardDescription className="mt-1">
                Ordenadas por urgencia (críticas primero)
                {studentParam && ' · Filtrado por estudiante desde enlace externo'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {Object.entries(ALERT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-32 border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todo nivel</SelectItem>
                  {Object.entries(RISK_LEVEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todo tipo</SelectItem>
                  {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">Sin alertas para los filtros seleccionados</p>
              <p className="text-sm max-w-md mx-auto">
                {canManage
                  ? 'Si hay reportes DECE o anotaciones de tutor recientes, pulsa «Evaluar ahora» para recalcular el semáforo institucional.'
                  : 'El semáforo institucional está bajo control.'}
              </p>
              {canManage && statusFilter === 'activa' && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleEvaluate}
                  disabled={evaluating}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
                  Evaluar ahora
                </Button>
              )}
            </div>
          ) : (
            alerts.map((alert) => {
              const expanded = expandedId === alert.id
              return (
                  <div
                  key={alert.id}
                  className="rounded-2xl p-4 transition-all duration-300 border border-white/5 bg-white/5 hover:bg-white/10 hover:shadow-lg relative overflow-hidden group"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    alert.level === 'critico' ? 'bg-red-500' :
                    alert.level === 'alto' ? 'bg-orange-500' :
                    alert.level === 'medio' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex items-start justify-between gap-4 pl-2">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white text-lg tracking-tight">{alert.student_name}</p>
                          <Badge variant="outline" className={`${RISK_BADGE_CLASSES[alert.level]} border`}>
                            {RISK_LEVEL_LABELS[alert.level]}
                          </Badge>
                          <Badge variant="secondary" className="bg-sky-500/20 text-sky-200 hover:bg-sky-500/30">{ALERT_TYPE_LABELS[alert.alert_type]}</Badge>
                          {alert.is_manual && <Badge variant="outline" className="border-violet-500/50 text-violet-300">Manual</Badge>}
                          {alert.email_sent && (
                            <Badge variant="outline" className="gap-1 border-white/20 text-slate-300">
                              <Mail className="h-3 w-3 text-sky-400" /> Email enviado
                            </Badge>
                          )}
                          {alert.status !== 'activa' && (
                            <Badge variant="outline" className="gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" />
                              {ALERT_STATUS_LABELS[alert.status]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-2">
                          <span>{alert.course_name}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-600" />
                          <span>
                            {new Date(alert.created_at).toLocaleDateString('es-EC', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </p>
                        <p className={`text-sm mt-3 text-slate-200 leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-2'}`}>
                          {alert.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                      {canManage && alert.status === 'activa' && (
                        <Button size="sm" onClick={() => setAttendTarget(alert)} className="bg-sky-500 hover:bg-sky-400 text-white shadow-md">
                          Atender
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
                        onClick={() => setExpandedId(expanded ? null : alert.id)}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-5 pl-2 space-y-4 border-t border-white/10 pt-4 animate-slide-up">
                      {alert.recommendations && (
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                          <p className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-2 flex items-center gap-2">
                            Recomendaciones de intervención
                          </p>
                          <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{alert.recommendations}</p>
                        </div>
                      )}
                      {alert.status === 'atendida' && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                          <p className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Atendida por {alert.attended_by_name ?? '—'}
                            {alert.attended_at
                              ? ` el ${new Date(alert.attended_at).toLocaleDateString('es-EC')}`
                              : ''}
                          </p>
                          <p className="text-sm text-emerald-100 whitespace-pre-line leading-relaxed">
                            {alert.actions_taken}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!attendTarget} onOpenChange={(open) => !open && setAttendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atender alerta</DialogTitle>
            <DialogDescription>
              {attendTarget?.student_name} — registra las acciones realizadas. La alerta se
              archivará y no volverá al estado activo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="actions">Acciones realizadas</Label>
            <Textarea
              id="actions"
              rows={4}
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              placeholder="Ej. Se citó al representante, se programó entrevista con el DECE..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAttend} disabled={attending}>
              {attending ? 'Guardando...' : 'Marcar como atendida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva alerta manual</DialogTitle>
            <DialogDescription>
              Para casos que el sistema no detectó automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Estudiante</Label>
              <Select value={manualStudent} onValueChange={setManualStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.first_name} {s.last_name} — {s.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={manualType} onValueChange={(v) => setManualType(v as AlertType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nivel</Label>
                <Select value={manualLevel} onValueChange={(v) => setManualLevel(v as RiskLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RISK_LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                rows={4}
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Describe la situación detectada..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateManual} disabled={creating}>
              {creating ? 'Creando...' : 'Crear alerta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
