import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUser } from '@/modules/auth/lib/session'
import {
  getActivePlanForCase,
  listCases,
  reportItemProgress,
  type ActionPlan,
  type DeceCase,
} from './api'

interface AttentionPlanPanelProps {
  studentId: number
}

export function AttentionPlanPanel({ studentId }: AttentionPlanPanelProps) {
  const role = getUser()?.active_role
  const isProfessional = role === 'dece'
  const [cases, setCases] = useState<DeceCase[]>([])
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyItem, setBusyItem] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCases(studentId)
      .then(async (rows) => {
        if (cancelled) return
        setCases(rows)
        const open = rows.find((c) => c.status === 'open' || c.status === 'under_assessment') ?? rows[0]
        if (!open) {
          setPlan(null)
          return
        }
        const active = await getActivePlanForCase(open.id)
        if (!cancelled) setPlan(active)
      })
      .catch(() => {
        if (!cancelled) {
          setCases([])
          setPlan(null)
          setError('No se pudo cargar el plan de atención (verifique permisos o feature flags).')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  async function onReport(itemId: number) {
    if (!plan) return
    setBusyItem(itemId)
    try {
      const updated = await reportItemProgress(plan.id, itemId, 'Avance reportado desde Perfil 360')
      setPlan(updated)
    } catch {
      setError('No se pudo reportar el avance.')
    } finally {
      setBusyItem(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando plan de atención...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>
  }

  if (!cases.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay casos DECE abiertos para este estudiante.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Casos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cases.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{c.title}</span>
              <Badge variant="secondary">{c.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {!plan ? (
        <p className="text-sm text-muted-foreground">Sin plan activo versionado.</p>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Plan activo v{plan.version} · {plan.validated_progress_pct}% validado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isProfessional || role === 'tutor' || role === 'docente' ? (
              <p className="text-sm text-muted-foreground">{plan.general_objective}</p>
            ) : null}
            <ul className="space-y-2">
              {plan.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {isProfessional ? (
                      <p className="text-xs text-muted-foreground">{item.objective}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{item.status}</Badge>
                      {item.due_hint ? (
                        <span className="text-xs text-muted-foreground">Plazo: {item.due_hint}</span>
                      ) : null}
                    </div>
                  </div>
                  {(role === 'tutor' || role === 'docente' || isProfessional) &&
                  item.status !== 'validated' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyItem === item.id || item.status === 'reported_completed'}
                      onClick={() => onReport(item.id)}
                    >
                      {item.status === 'reported_completed' ? 'Pendiente validación' : 'Reportar avance'}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!isProfessional ? (
              <p className="text-xs text-muted-foreground">
                Vista limitada: acciones asignadas y objetivo público. Sin notas DECE confidenciales.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
