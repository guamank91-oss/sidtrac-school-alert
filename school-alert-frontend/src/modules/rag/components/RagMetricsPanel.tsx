import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Bot, Clock, MessagesSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getRagHistory, getRagMetrics, type RagHistoryEntry, type RagMetrics } from '../api'

export function RagMetricsPanel() {
  const [metrics, setMetrics] = useState<RagMetrics | null>(null)
  const [history, setHistory] = useState<RagHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRagMetrics(), getRagHistory(50)])
      .then(([metricsData, historyData]) => {
        setMetrics(metricsData)
        setHistory(historyData)
      })
      .catch(() => toast.error('No se pudieron cargar las métricas RAG'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Skeleton className="h-72 w-full" />
  }

  const cards = [
    {
      label: 'Consultas totales',
      value: metrics?.total_queries ?? 0,
      icon: MessagesSquare,
    },
    { label: 'Consultas hoy', value: metrics?.queries_today ?? 0, icon: Activity },
    {
      label: 'Latencia promedio',
      value: `${((metrics?.avg_latency_ms ?? 0) / 1000).toFixed(1)}s`,
      icon: Clock,
    },
    {
      label: 'Modelos usados',
      value: metrics?.models_used.length ?? 0,
      icon: Bot,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center">
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultas por día</CardTitle>
            <CardDescription>Últimos 14 días</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics && metrics.queries_per_day.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.queries_per_day}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Consultas" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Aún no hay consultas registradas
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modelos utilizados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics?.models_used.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            )}
            {metrics?.models_used.map((m) => (
              <div key={m.model} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{m.model}</span>
                <Badge variant="secondary">{m.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de consultas</CardTitle>
          <CardDescription>
            Cada consulta registra usuario, estudiante, pregunta, modelo y latencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin consultas</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Pregunta</TableHead>
                  <TableHead>Latencia</TableHead>
                  <TableHead>Riesgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('es-EC')}
                    </TableCell>
                    <TableCell>{entry.user_name}</TableCell>
                    <TableCell>{entry.student_name}</TableCell>
                    <TableCell className="max-w-64 truncate text-sm">{entry.question}</TableCell>
                    <TableCell className="text-sm">
                      {(entry.latency_ms / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell>
                      {entry.detected_risk && (
                        <Badge variant="outline">{entry.detected_risk}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
