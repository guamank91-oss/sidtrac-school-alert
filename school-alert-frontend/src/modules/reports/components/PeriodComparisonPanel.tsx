import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, CalendarRange, Loader2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUser } from '@/modules/auth/lib/session'
import { listTerms } from '@/modules/institution/api'
import type { AcademicTerm } from '@/modules/institution/types'
import { RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import type { RiskLevel } from '@/shared/types/roles'
import { usePeriod } from '@/shared/context/PeriodContext'
import { getPeriodComparison, type PeriodComparison, type PeriodSummary } from '../api'

const NONE = '__none__'

const PERIOD_A_COLOR = '#2563eb'
const PERIOD_B_COLOR = '#64748b'

const RISK_ORDER: RiskLevel[] = ['critico', 'alto', 'medio', 'bajo']

const LEVEL_COLORS: Record<string, string> = {
  critico: '#dc2626',
  alto: '#ea580c',
  medio: '#f59e0b',
  bajo: '#10b981',
}

// Higher value = worse. Used to color deltas (more alerts/reports = negative trend).
function DeltaBadge({
  a,
  b,
  higherIsWorse = true,
  suffix = '',
}: {
  a: number | null
  b: number | null
  higherIsWorse?: boolean
  suffix?: string
}) {
  if (a == null || b == null) return <span className="text-xs text-muted-foreground">—</span>
  const diff = Math.round((a - b) * 100) / 100
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> sin cambio
      </span>
    )
  const worse = higherIsWorse ? diff > 0 : diff < 0
  const cls = worse ? 'text-rose-600' : 'text-emerald-600'
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${cls}`}>
      <Icon className="h-3 w-3" />
      {diff > 0 ? '+' : ''}
      {diff}
      {suffix}
    </span>
  )
}

interface MetricRow {
  label: string
  a: number | null
  b: number | null
  higherIsWorse: boolean
  suffix?: string
  format?: (v: number | null) => string
}

function fmt(v: number | null, suffix = ''): string {
  if (v == null) return '—'
  return `${v}${suffix}`
}

function riskCount(period: PeriodSummary | null | undefined, level: string): number {
  if (!period) return 0
  return period.risk_distribution.find((r) => r.level === level)?.count ?? 0
}

export function PeriodComparisonPanel() {
  const institutionId = getUser()?.institution_id
  const { selectedTermId } = usePeriod()
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [termA, setTermA] = useState<string>('')
  const [termB, setTermB] = useState<string>(NONE)
  const [data, setData] = useState<PeriodComparison | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!institutionId) return
    listTerms(institutionId)
      .then((rows) => {
        setTerms(rows)
        const preferred = selectedTermId ?? rows.find((t) => t.is_active)?.id ?? rows[0]?.id
        if (preferred) setTermA(String(preferred))
      })
      .catch(() => toast.error('No se pudieron cargar los periodos lectivos'))
  }, [institutionId, selectedTermId])

  const load = useCallback(async () => {
    if (!termA) return
    setLoading(true)
    try {
      const result = await getPeriodComparison(
        Number(termA),
        termB !== NONE ? Number(termB) : undefined
      )
      setData(result)
    } catch {
      toast.error('No se pudo cargar la comparación por periodo')
    } finally {
      setLoading(false)
    }
  }, [termA, termB])

  useEffect(() => {
    void load()
  }, [load])

  const rows: MetricRow[] = useMemo(() => {
    const a = data?.period_a
    const b = data?.period_b ?? null
    const val = (p: PeriodSummary | null | undefined, key: keyof PeriodSummary) =>
      p ? (p[key] as number | null) : null
    return [
      { label: 'Estudiantes (activos)', a: val(a, 'students'), b: val(b, 'students'), higherIsWorse: false },
      { label: 'Promedio académico', a: val(a, 'average_score'), b: val(b, 'average_score'), higherIsWorse: false },
      { label: 'Asistencia', a: val(a, 'attendance_rate'), b: val(b, 'attendance_rate'), higherIsWorse: false, suffix: '%' },
      { label: 'Alertas generadas', a: val(a, 'alerts_total'), b: val(b, 'alerts_total'), higherIsWorse: true },
      { label: 'Alertas atendidas', a: val(a, 'alerts_attended'), b: val(b, 'alerts_attended'), higherIsWorse: false },
      { label: 'Reportes DECE', a: val(a, 'dece_reports'), b: val(b, 'dece_reports'), higherIsWorse: true },
      { label: 'Reportes disciplinarios', a: val(a, 'disciplinary_reports'), b: val(b, 'disciplinary_reports'), higherIsWorse: true },
      { label: 'Anotaciones de tutor', a: val(a, 'tutor_annotations'), b: val(b, 'tutor_annotations'), higherIsWorse: true },
    ]
  }, [data])

  const comparing = data?.period_b != null

  const termAKey = data?.period_a.term_name ?? 'Periodo A'
  const termBKey = data?.period_b?.term_name ?? 'Periodo B'

  const academicChartData = useMemo(() => {
    if (!data) return []
    const a = data.period_a
    const b = data.period_b
    return [
      {
        name: 'Promedio',
        [termAKey]: a.average_score ?? 0,
        ...(b ? { [termBKey]: b.average_score ?? 0 } : {}),
      },
      {
        name: 'Asistencia %',
        [termAKey]: a.attendance_rate ?? 0,
        ...(b ? { [termBKey]: b.attendance_rate ?? 0 } : {}),
      },
    ]
  }, [data, termAKey, termBKey])

  const incidentsChartData = useMemo(() => {
    if (!data) return []
    const a = data.period_a
    const b = data.period_b
    const row = (name: string, va: number, vb?: number) => ({
      name,
      [termAKey]: va,
      ...(b != null && vb != null ? { [termBKey]: vb } : {}),
    })
    return [
      row('Alertas', a.alerts_total, b?.alerts_total),
      row('DECE', a.dece_reports, b?.dece_reports),
      row('Disciplinarios', a.disciplinary_reports, b?.disciplinary_reports),
      row('Anot. tutor', a.tutor_annotations, b?.tutor_annotations),
    ]
  }, [data, termAKey, termBKey])

  const riskChartData = useMemo(() => {
    if (!data) return []
    const a = data.period_a
    const b = data.period_b
    return RISK_ORDER.map((level) => ({
      name: RISK_LEVEL_LABELS[level],
      level,
      [termAKey]: riskCount(a, level),
      ...(b ? { [termBKey]: riskCount(b, level) } : {}),
    }))
  }, [data, termAKey, termBKey])

  const studentsChartData = useMemo(() => {
    if (!data) return []
    const a = data.period_a
    const b = data.period_b
    return [
      {
        name: 'Estudiantes',
        [termAKey]: a.students,
        ...(b ? { [termBKey]: b.students } : {}),
      },
    ]
  }, [data, termAKey, termBKey])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-5 w-5" />
            Análisis por periodo lectivo
          </CardTitle>
          <CardDescription>
            Filtre por periodo académico y compare estadísticas entre dos periodos (ej. 2026 vs 2027).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Periodo</Label>
              <Select value={termA} onValueChange={setTermA}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar periodo" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                      {t.is_active ? ' (activo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comparar con</Label>
              <Select value={termB} onValueChange={setTermB}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin comparación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin comparación</SelectItem>
                  {terms
                    .filter((t) => String(t.id) !== termA)
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Indicadores del periodo</CardTitle>
              <CardDescription>
                {data.period_a.term_name} ({data.period_a.start_date} → {data.period_a.end_date})
                {comparing && data.period_b
                  ? ` vs ${data.period_b.term_name} (${data.period_b.start_date} → ${data.period_b.end_date})`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Indicador</th>
                    <th className="py-2 pr-4 font-medium">{data.period_a.term_name}</th>
                    {comparing && data.period_b && (
                      <>
                        <th className="py-2 pr-4 font-medium">{data.period_b.term_name}</th>
                        <th className="py-2 font-medium">Variación</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.label}</td>
                      <td className="py-2 pr-4 font-semibold">{fmt(row.a, row.suffix)}</td>
                      {comparing && (
                        <>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {fmt(row.b, row.suffix)}
                          </td>
                          <td className="py-2">
                            <DeltaBadge
                              a={row.a}
                              b={row.b}
                              higherIsWorse={row.higherIsWorse}
                              suffix={row.suffix}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {comparing && data.period_b && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Rendimiento académico</CardTitle>
                  <CardDescription>Promedio de notas y tasa de asistencia</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={academicChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[0, 10]} />
                      <Tooltip labelStyle={{ fontWeight: 600 }} />
                      <Legend />
                      <Bar dataKey={termAKey} fill={PERIOD_A_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey={termBKey} fill={PERIOD_B_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Matrícula</CardTitle>
                  <CardDescription>Estudiantes activos por periodo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={studentsChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip labelStyle={{ fontWeight: 600 }} />
                      <Legend />
                      <Bar dataKey={termAKey} fill={PERIOD_A_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey={termBKey} fill={PERIOD_B_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seguimiento e incidencias</CardTitle>
                  <CardDescription>
                    Alertas, reportes DECE, disciplinarios y anotaciones de tutor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={incidentsChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip labelStyle={{ fontWeight: 600 }} />
                      <Legend />
                      <Bar dataKey={termAKey} fill={PERIOD_A_COLOR} radius={[4, 4, 0, 0]} />
                      <Bar dataKey={termBKey} fill={PERIOD_B_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Distribución de riesgo (actual)</CardTitle>
              <CardDescription>
                Nivel de riesgo actual de los estudiantes matriculados en cada periodo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {comparing && data.period_b ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={riskChartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip labelStyle={{ fontWeight: 600 }} />
                    <Legend />
                    <Bar dataKey={termAKey} fill={PERIOD_A_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={termBKey} fill={PERIOD_B_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {[data.period_a, comparing ? data.period_b : null]
                  .filter((p): p is PeriodSummary => p != null)
                  .map((p) => (
                    <div key={p.term_id} className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">{p.term_name}</p>
                      <div className="flex flex-wrap gap-2">
                        {p.risk_distribution.map((r) => (
                          <Badge
                            key={r.level}
                            variant="outline"
                            style={{ borderColor: LEVEL_COLORS[r.level] ?? undefined }}
                          >
                            {RISK_LEVEL_LABELS[r.level as RiskLevel] ?? r.level}: {r.count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
