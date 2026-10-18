import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { StudentAcademicProfile } from '../types'
import { formatScore, isLowScore } from '../utils/formatScore'
import { SubjectScoresRadarChart } from './SubjectScoresRadarChart'

interface StudentAcademicSnapshotProps {
  profile: StudentAcademicProfile | null
  loading?: boolean
  /** Narrow column (e.g. Perfil 360 side panel) — 2×2 KPIs, tighter spacing */
  compact?: boolean
  /** Perfil 360: gráfico radar; vista académica: barras por materia */
  subjectsView?: 'bars' | 'radar'
}

function scoreBarColor(value: number): string {
  if (value < 5) return 'bg-rose-500'
  if (value < 7) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function scoreTextColor(value: number): string {
  if (value < 5) return 'text-rose-600'
  if (value < 7) return 'text-amber-600'
  return 'text-emerald-600'
}

export function StudentAcademicSnapshot({
  profile,
  loading = false,
  compact = false,
  subjectsView = 'bars',
}: StudentAcademicSnapshotProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground text-sm">
        Cargando rendimiento académico...
      </div>
    )
  }

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay datos académicos para este estudiante.
      </p>
    )
  }

  const subjects = profile.subject_scores ?? []
  const attendanceTrend = profile.attendance_trend ?? []
  const average = profile.average_score

  const kpiClass = compact
    ? 'rounded-lg border bg-muted/40 px-3 py-2.5 text-center min-w-0'
    : 'rounded-lg border bg-muted/40 px-3 py-3 text-center min-w-0'

  return (
    <div className={cn('min-w-0', compact ? 'space-y-3' : 'space-y-4')}>
      <div
        className={cn(
          'grid gap-2',
          compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4 gap-3',
        )}
      >
        <div className={kpiClass}>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">Promedio</p>
          <p
            className={cn(
              'font-bold tabular-nums mt-0.5',
              compact ? 'text-lg' : 'text-xl',
              average !== null && average < 7 && 'text-rose-600',
            )}
          >
            {average !== null ? formatScore(average) : '—'}
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">Asistencia</p>
          <p className={cn('font-bold tabular-nums mt-0.5', compact ? 'text-lg' : 'text-xl')}>
            {profile.attendance_rate != null ? `${profile.attendance_rate}%` : '—'}
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">Ausencias</p>
          <p
            className={cn(
              'font-bold tabular-nums mt-0.5',
              compact ? 'text-lg' : 'text-xl',
              profile.absence_count > 5 && 'text-rose-600',
            )}
          >
            {profile.absence_count}
          </p>
        </div>
        <div className={kpiClass}>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">Tardanzas</p>
          <p
            className={cn(
              'font-bold tabular-nums mt-0.5',
              compact ? 'text-lg' : 'text-xl',
              profile.tardy_count > 3 && 'text-amber-600',
            )}
          >
            {profile.tardy_count}
          </p>
        </div>
      </div>

      {subjectsView === 'radar' ? (
        <SubjectScoresRadarChart subjects={subjects} compact={compact} />
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className={cn('pb-2', compact && 'px-4 pt-4')}>
            <CardTitle className="text-sm font-semibold">Notas por materia</CardTitle>
          </CardHeader>
          <CardContent className={cn('space-y-3', compact && 'px-4 pb-4')}>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin calificaciones registradas.
              </p>
            ) : (
              subjects.map((item) => {
                const max = item.full_mark > 0 ? item.full_mark : 10
                const pct = Math.min(100, Math.max(0, (item.value / max) * 100))
                return (
                  <div key={item.subject} className="space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium leading-snug min-w-0 break-words">
                        {item.subject}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-semibold tabular-nums ${scoreTextColor(item.value)}`}>
                          {formatScore(item.value)}
                        </span>
                        {isLowScore(item.value) && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Bajo
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBarColor(item.value)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}

      {attendanceTrend.length > 0 && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className={cn('pb-2', compact && 'px-4 pt-4')}>
            <CardTitle className="text-sm font-semibold">Tendencia de asistencia</CardTitle>
          </CardHeader>
          <CardContent className={cn(compact && 'px-4 pb-4')}>
            <div className={cn('min-w-0 w-full', compact ? 'h-32' : 'h-40')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceTrend} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Asistencia']} />
                  <Bar dataKey="attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
