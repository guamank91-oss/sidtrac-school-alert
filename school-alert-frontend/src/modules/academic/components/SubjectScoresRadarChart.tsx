import { useId } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { GraduationCap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SubjectRadarPoint } from '../types'
import { scoreTier, useChartTheme } from '../utils/chartTheme'
import { formatScore, isLowScore } from '../utils/formatScore'

interface SubjectScoresRadarChartProps {
  subjects: SubjectRadarPoint[]
  compact?: boolean
  className?: string
}

function shortenSubject(name: string, max = 14): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

function tierRowClass(value: number): string {
  if (value < 5) return 'border-rose-400/30 bg-rose-500/15'
  if (value < 7) return 'border-amber-400/30 bg-amber-500/15'
  return 'border-emerald-400/30 bg-emerald-500/15'
}

function tierScoreClass(value: number): string {
  if (value < 5) return 'text-rose-300'
  if (value < 7) return 'text-amber-300'
  return 'text-emerald-300'
}

export function SubjectScoresRadarChart({
  subjects,
  compact = false,
  className,
}: SubjectScoresRadarChartProps) {
  const colors = useChartTheme()
  const gradientId = useId().replace(/:/g, '')
  const maxScale = subjects[0]?.full_mark > 0 ? subjects[0].full_mark : 10

  const chartData = subjects.map((item) => ({
    subject: shortenSubject(item.subject),
    fullSubject: item.subject,
    score: item.value,
  }))

  return (
    <Card
      className={cn(
        'min-w-0 overflow-hidden border-white/15 bg-[rgba(15,32,64,0.55)]',
        className,
      )}
    >
      <CardHeader className={cn('pb-2', compact && 'px-4 pt-4')}>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-50">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-primary/25">
            <GraduationCap className="h-4 w-4 text-sky-200" />
          </span>
          Rendimiento por materia
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(compact ? 'px-3 pb-4' : 'px-4 pb-5')}>
        {subjects.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Sin calificaciones registradas.
          </p>
        ) : (
          <>
            <div
              className={cn(
                'relative mx-auto min-w-0 w-full rounded-xl border border-white/12 bg-white/5 p-2',
                compact ? 'h-56 max-w-[300px]' : 'h-72 max-w-md',
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="68%">
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={colors.accent} stopOpacity={0.55} />
                      <stop offset="55%" stopColor={colors.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.chart2} stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <PolarGrid stroke={colors.border} strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                      fontSize: compact ? 10 : 11,
                      fill: colors.muted,
                      fontWeight: 500,
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, maxScale]}
                    tick={{ fontSize: 9, fill: colors.muted }}
                    tickCount={6}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0].payload as {
                        fullSubject: string
                        score: number
                      }
                      const tier = scoreTier(row.score)
                      const badgeClass =
                        tier === 'low'
                          ? 'border-rose-400/30 bg-rose-500/20 text-rose-100'
                          : tier === 'mid'
                            ? 'border-amber-400/30 bg-amber-500/20 text-amber-100'
                            : 'border-emerald-400/30 bg-emerald-500/20 text-emerald-100'
                      return (
                        <div className="rounded-xl border border-white/20 bg-[rgba(12,28,56,0.96)] px-3 py-2 text-xs shadow-[var(--shadow-elevated)]">
                          <p className="font-semibold text-slate-50">{row.fullSubject}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={badgeClass}>
                              {formatScore(row.score)}
                            </Badge>
                            <span className="text-slate-400">/ {maxScale.toFixed(0)}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Radar
                    name="Nota"
                    dataKey="score"
                    stroke={colors.accent}
                    fill={`url(#${gradientId})`}
                    fillOpacity={1}
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: colors.accent,
                      stroke: '#07152F',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 6,
                      fill: colors.primary,
                      stroke: colors.chart2,
                      strokeWidth: 2,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <ul
              className={cn(
                'mt-3 grid gap-2',
                compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
              )}
            >
              {subjects.map((item) => (
                <li
                  key={item.subject}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors',
                    tierRowClass(item.value),
                  )}
                >
                  <span className="min-w-0 truncate font-medium text-slate-100">
                    {item.subject}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn('font-bold tabular-nums', tierScoreClass(item.value))}>
                      {formatScore(item.value)}
                    </span>
                    {isLowScore(item.value) && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        Bajo
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
