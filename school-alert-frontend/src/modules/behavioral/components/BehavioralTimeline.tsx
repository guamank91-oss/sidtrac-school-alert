import { Clock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { URGENCY_LABELS } from '../labels'
import type { TimelineEntry } from '../types'

interface BehavioralTimelineProps {
  entries: TimelineEntry[]
  loading?: boolean
  maxHeight?: string
}

const SOURCE_COLORS: Record<TimelineEntry['source'], string> = {
  dece: 'border-blue-500',
  tutor: 'border-emerald-500',
  disciplinary: 'border-rose-500',
}

const SOURCE_BADGE: Record<TimelineEntry['source'], string> = {
  dece: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
  tutor: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  disciplinary: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BehavioralTimeline({
  entries,
  loading = false,
  maxHeight = '400px',
}: BehavioralTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando historial...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay reportes ni anotaciones registrados aún.
      </p>
    )
  }

  return (
    <ScrollArea style={{ height: maxHeight }} className="pr-4">
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div key={`${entry.source}-${entry.id}`} className="relative pl-6 pb-4">
            {index !== entries.length - 1 && (
              <div className="absolute left-2 top-3 bottom-0 w-px bg-border" />
            )}
            <div
              className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 bg-card ${SOURCE_COLORS[entry.source]}`}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{entry.type_label}</span>
                <Badge variant="outline" className={SOURCE_BADGE[entry.source]}>
                  {entry.source === 'dece'
                    ? 'DECE'
                    : entry.source === 'tutor'
                      ? 'Tutor'
                      : 'Disciplinario'}
                </Badge>
                {entry.urgency_level && (
                  <Badge variant="outline">{URGENCY_LABELS[entry.urgency_level]}</Badge>
                )}
                {entry.requires_follow_up && (
                  <Badge variant="outline" className="border-amber-200 text-amber-700">
                    Seguimiento
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{entry.description}</p>
              {entry.actions_taken && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Acciones:</span> {entry.actions_taken}
                </p>
              )}
              {entry.sanction && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Sanción:</span> {entry.sanction}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDate(entry.date)}</span>
                <span>•</span>
                <span>{entry.author_name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
