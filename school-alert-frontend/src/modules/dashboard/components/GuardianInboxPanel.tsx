import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  HeartHandshake,
  Info,
  Mail,
  UserRound,
} from 'lucide-react'
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
import type { StudentAcademicProfile } from '@/modules/academic/types'
import { parseScore } from '@/modules/academic/utils/formatScore'
import type { TimelineEntry } from '@/modules/behavioral/types'
import type { Student } from '@/modules/students/types'

export type GuardianInboxKind = 'academic' | 'attendance' | 'dece' | 'tutor' | 'urgent' | 'info'

export interface GuardianInboxItem {
  id: string
  kind: GuardianInboxKind
  title: string
  text: string
  author: string
  when: string
  sortAt: number
  highlight?: boolean
}

const kindConfig: Record<
  GuardianInboxKind,
  { icon: typeof Mail; bg: string; color: string; label: string }
> = {
  academic: {
    icon: BookOpen,
    bg: 'bg-primary/20 border border-primary/25',
    color: 'text-sky-300',
    label: 'Académico',
  },
  attendance: {
    icon: Calendar,
    bg: 'bg-amber-500/15 border border-amber-400/25',
    color: 'text-amber-300',
    label: 'Asistencia',
  },
  dece: {
    icon: HeartHandshake,
    bg: 'bg-sky-500/15 border border-sky-400/25',
    color: 'text-sky-300',
    label: 'DECE',
  },
  tutor: {
    icon: UserRound,
    bg: 'bg-emerald-500/15 border border-emerald-400/25',
    color: 'text-emerald-300',
    label: 'Tutor',
  },
  urgent: {
    icon: AlertTriangle,
    bg: 'bg-rose-500/15 border border-rose-400/30',
    color: 'text-rose-300',
    label: 'Importante',
  },
  info: {
    icon: Info,
    bg: 'bg-white/8 border border-white/15',
    color: 'text-slate-300',
    label: 'Información',
  },
}

function formatWhen(isoOrLabel: string): string {
  if (isoOrLabel === 'Reciente' || isoOrLabel === 'Pendiente' || isoOrLabel === 'Institucional') {
    return isoOrLabel
  }
  const d = new Date(isoOrLabel)
  if (Number.isNaN(d.getTime())) return isoOrLabel
  return d.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildGuardianInbox(
  student: Student,
  profile: StudentAcademicProfile | null,
  timeline: TimelineEntry[]
): GuardianInboxItem[] {
  const items: GuardianInboxItem[] = []
  const firstName = student.firstName

  timeline.slice(0, 6).forEach((entry) => {
    const sortAt = new Date(entry.date).getTime()
    if (entry.source === 'dece') {
      items.push({
        id: `tl-dece-${entry.id}`,
        kind: entry.requires_follow_up ? 'urgent' : 'dece',
        title: entry.requires_follow_up
          ? 'Seguimiento DECE requerido'
          : 'Actualización del departamento DECE',
        text: `${entry.type_label}: ${entry.description}`,
        author: entry.author_name || 'Equipo DECE',
        when: entry.date,
        sortAt,
        highlight: Boolean(entry.requires_follow_up),
      })
    } else if (entry.source === 'tutor') {
      items.push({
        id: `tl-tutor-${entry.id}`,
        kind: 'tutor',
        title: 'Observación del tutor de curso',
        text: entry.description,
        author: entry.author_name || 'Tutor',
        when: entry.date,
        sortAt,
      })
    }
  })

  if ((profile?.absence_count ?? 0) >= 2) {
    items.push({
      id: 'abs',
      kind: profile!.absence_count >= 5 ? 'urgent' : 'attendance',
      title: 'Registro de ausencias',
      text: `${firstName} acumula ${profile?.absence_count} ausencia(s) en el período. Le sugerimos coordinar con el tutor para regularizar la asistencia.`,
      author: 'Control de asistencia',
      when: 'Reciente',
      sortAt: Date.now(),
      highlight: (profile?.absence_count ?? 0) >= 5,
    })
  }

  if ((profile?.tardy_count ?? 0) >= 2) {
    items.push({
      id: 'tardy',
      kind: 'attendance',
      title: 'Tardanzas registradas',
      text: `Se han contabilizado ${profile?.tardy_count} tardanza(s). Revise horarios de salida y transporte.`,
      author: 'Control de asistencia',
      when: 'Reciente',
      sortAt: Date.now() - 1,
    })
  }

  const average =
    profile?.average_score !== null && profile?.average_score !== undefined
      ? parseScore(profile.average_score)
      : null
  if (average !== null && average < 7) {
    items.push({
      id: 'avg',
      kind: 'academic',
      title: 'Promedio por debajo del umbral',
      text: `El promedio general de ${firstName} es ${average.toFixed(2)}. Se recomienda reforzar hábitos de estudio en casa y solicitar una cita con el tutor.`,
      author: 'Seguimiento académico',
      when: 'Pendiente',
      sortAt: Date.now() - 2,
      highlight: average < 6,
    })
  }

  if (student.risk === 'red' || student.risk === 'purple') {
    items.push({
      id: 'risk',
      kind: 'urgent',
      title: 'Seguimiento institucional activo',
      text: `El plantel mantiene seguimiento cercano del bienestar de ${firstName}. El DECE puede contactarlo si requiere una entrevista.`,
      author: 'DECE',
      when: 'Institucional',
      sortAt: Date.now() - 3,
      highlight: true,
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'ok',
      kind: 'info',
      title: 'Sin novedades urgentes',
      text: `${firstName} no tiene alertas pendientes. Continúe apoyando su rutina escolar y manténgase atento a futuras comunicaciones.`,
      author: 'SIDTRAC',
      when: 'Hoy',
      sortAt: Date.now(),
    })
  }

  return items.sort((a, b) => {
    if (a.highlight !== b.highlight) return a.highlight ? -1 : 1
    return b.sortAt - a.sortAt
  })
}

interface GuardianInboxPanelProps {
  items: GuardianInboxItem[]
  onViewAll?: () => void
}

export function GuardianInboxPanel({ items, onViewAll }: GuardianInboxPanelProps) {
  const [selected, setSelected] = useState<GuardianInboxItem | null>(null)
  const highlightCount = items.filter((i) => i.highlight).length
  const preview = items.slice(0, 4)

  return (
    <>
      <Card className="overflow-hidden border-white/15">
        <CardHeader className="border-b border-white/10 bg-gradient-to-r from-primary/15 to-transparent pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-primary/25">
                <Mail className="h-5 w-5 text-sky-200" />
              </div>
              <div>
                <CardTitle className="text-base text-white">Buzón de Novedades</CardTitle>
                <p className="text-xs text-slate-400">Comunicaciones sobre su hijo/a</p>
              </div>
            </div>
            {items.length > 0 && (
              <Badge variant={highlightCount > 0 ? 'default' : 'secondary'} className="gap-1">
                {highlightCount > 0 && <Bell className="h-3 w-3" />}
                {highlightCount > 0 ? `${highlightCount} importante${highlightCount > 1 ? 's' : ''}` : items.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {preview.map((item) => {
            const cfg = kindConfig[item.kind]
            const Icon = cfg.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
                  item.highlight
                    ? 'border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/15'
                    : 'border-white/12 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-50">{item.title}</p>
                    <Badge variant="outline" className="border-white/20 bg-white/5 text-[10px] px-1.5 py-0 text-slate-300">
                      {cfg.label}
                    </Badge>
                    {item.highlight && (
                      <Badge className="border-amber-400/30 bg-amber-500/25 text-[10px] px-1.5 py-0 text-amber-100 hover:bg-amber-500/30">
                        Requiere atención
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.text}</p>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {item.author} · {formatWhen(item.when)}
                  </p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-500" />
              </button>
            )
          })}
          {items.length > 4 && onViewAll && (
            <Button variant="outline" size="sm" className="mt-1 w-full border-white/15 bg-white/5" onClick={onViewAll}>
              Ver historial completo ({items.length})
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = kindConfig[selected.kind]
                    const Icon = cfg.icon
                    return (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bg}`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                    )
                  })()}
                  <div>
                    <DialogTitle className="text-left text-base">{selected.title}</DialogTitle>
                    <DialogDescription className="text-left">
                      {selected.author} · {formatWhen(selected.when)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm leading-relaxed text-slate-200">
                {selected.text}
              </div>
              {onViewAll && (selected.kind === 'dece' || selected.kind === 'tutor') && (
                <Button className="w-full" onClick={() => { setSelected(null); onViewAll() }}>
                  Ver seguimiento escolar completo
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
