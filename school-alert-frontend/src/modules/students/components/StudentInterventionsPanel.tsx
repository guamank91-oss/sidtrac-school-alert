import { CheckCircle2, ClipboardList, Loader2, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { listAlerts } from '@/modules/alerts/api'
import { ALERT_STATUS_LABELS, ALERT_TYPE_LABELS, RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import type { Alert } from '@/modules/alerts/types'
import { BehavioralTimeline } from '@/modules/behavioral/components/BehavioralTimeline'
import type { TimelineEntry } from '@/modules/behavioral/types'

interface StudentInterventionsPanelProps {
  timeline: TimelineEntry[]
  attendedAlerts: Alert[]
  loading?: boolean
}

const RISK_PILL: Record<string, string> = {
  critico: 'bg-red-500/20 text-red-300 border-red-500/30',
  alto:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medio:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  bajo:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export function StudentInterventionsPanel({
  timeline,
  attendedAlerts,
  loading = false,
}: StudentInterventionsPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border border-sky-500/30 bg-sky-500/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-sky-500/15 animate-ping" />
        </div>
        <p className="text-sm">Cargando intervenciones...</p>
      </div>
    )
  }

  const deceActions = timeline.filter((e) => e.source === 'dece' && e.actions_taken)
  const hasData     = attendedAlerts.length > 0 || deceActions.length > 0

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 leading-relaxed">
        Registro consolidado de acciones e intervenciones documentadas para este estudiante.
        Esta información alimenta la base de conocimiento del asistente IA.
      </p>

      {/* Attended Alerts */}
      {attendedAlerts.length > 0 && (
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-lg">
          <div className="px-5 py-3 bg-black/20 border-b border-white/8 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Alertas Atendidas
            </span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              {attendedAlerts.length}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {attendedAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/8 bg-white/5 hover:bg-white/8 transition-colors p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${RISK_PILL[alert.level] ?? 'bg-white/10 text-slate-300 border-white/10'}`}>
                    {RISK_LEVEL_LABELS[alert.level]}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {ALERT_TYPE_LABELS[alert.alert_type]}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {ALERT_STATUS_LABELS[alert.status]}
                  </span>
                </div>
                {alert.actions_taken && (
                  <p className="text-sm text-slate-200 leading-relaxed mb-1.5">
                    <span className="font-semibold text-white">Acciones: </span>
                    {alert.actions_taken}
                  </p>
                )}
                <p className="text-[10px] text-slate-500 font-medium">
                  Creada: {new Date(alert.created_at).toLocaleDateString('es-EC')}
                  {alert.attended_at
                    ? ` · Atendida: ${new Date(alert.attended_at).toLocaleDateString('es-EC')}`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DECE Actions */}
      {deceActions.length > 0 && (
        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-lg">
          <div className="px-5 py-3 bg-black/20 border-b border-white/8 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Acciones en Reportes DECE
            </span>
            <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30">
              {deceActions.length}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {deceActions.map((entry) => (
              <div
                key={`dece-action-${entry.id}`}
                className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 hover:bg-white/8 transition-colors"
              >
                <p className="text-sm text-white font-semibold">{entry.type_label}</p>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{entry.actions_taken}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <MessageSquare className="h-7 w-7 text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Sin intervenciones registradas</p>
            <p className="text-xs text-slate-400 mt-1">No hay alertas atendidas ni acciones DECE para este estudiante.</p>
          </div>
        </div>
      )}

      {/* Full behavioral timeline */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-lg">
        <div className="px-5 py-3 bg-black/20 border-b border-white/8 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
            Historial Conductual Completo
          </span>
          {timeline.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-500/30">
              {timeline.length}
            </span>
          )}
        </div>
        <div className="p-4">
          <BehavioralTimeline entries={timeline} maxHeight="380px" />
        </div>
      </div>
    </div>
  )
}

/** Fetch attended alerts for profile interventions tab. */
export async function fetchAttendedAlertsForStudent(studentId: number) {
  return listAlerts({ student_id: studentId, status: 'atendida' })
}
