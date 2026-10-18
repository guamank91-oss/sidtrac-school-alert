import { useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getAlertConfig, runEvaluation, updateAlertConfig } from '../api'
import type { AlertConfig } from '../types'

export function AlertConfigPanel() {
  const [config, setConfig] = useState<AlertConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  useEffect(() => {
    getAlertConfig()
      .then(setConfig)
      .catch(() => toast.error('No se pudo cargar la configuración de alertas'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const updated = await updateAlertConfig({
        min_average: config.min_average,
        absences_medium: config.absences_medium,
        absences_high: config.absences_high,
        serious_faults_month: config.serious_faults_month,
        sender_email: config.sender_email || null,
        evaluation_hour: config.evaluation_hour,
      })
      setConfig(updated)
      toast.success('Umbrales actualizados')
    } catch {
      toast.error('No se pudieron guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      const result = await runEvaluation()
      toast.success(
        `Evaluación: ${result.students_evaluated} estudiantes, ${result.alerts_created} alertas, ` +
          `${result.emails_sent} correos, ${result.internal_notifications} notificaciones`
      )
    } catch {
      toast.error('La evaluación falló')
    } finally {
      setEvaluating(false)
    }
  }

  if (loading || !config) {
    return <Skeleton className="h-72 w-full" />
  }

  const set = (patch: Partial<AlertConfig>) => setConfig({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Umbrales de alerta automática</CardTitle>
          <CardDescription>
            El motor evalúa a todos los estudiantes activos cada día a las{' '}
            {String(config.evaluation_hour).padStart(2, '0')}:00. Ajusta los umbrales sin
            modificar el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Promedio mínimo (indicador académico)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={10}
                value={config.min_average}
                onChange={(e) => set({ min_average: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Promedio general por debajo de este valor activa el indicador.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Hora de evaluación diaria</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={config.evaluation_hour}
                onChange={(e) => set({ evaluation_hour: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Hora (0-23) en que corre la evaluación automática.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ausencias para riesgo medio (15 días)</Label>
              <Input
                type="number"
                min={1}
                value={config.absences_medium}
                onChange={(e) => set({ absences_medium: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ausencias para riesgo alto (15 días)</Label>
              <Input
                type="number"
                min={1}
                value={config.absences_high}
                onChange={(e) => set({ absences_high: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Faltas graves por mes (indicador disciplinario)</Label>
              <Input
                type="number"
                min={1}
                value={config.serious_faults_month}
                onChange={(e) => set({ serious_faults_month: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo remitente de notificaciones</Label>
              <Input
                type="email"
                placeholder="alertas@institucion.edu.ec"
                value={config.sender_email ?? ''}
                onChange={(e) => set({ sender_email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Debe estar verificado en Resend. Vacío usa el remitente por defecto.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar umbrales'}
            </Button>
            <Button variant="outline" onClick={handleEvaluate} disabled={evaluating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
              Ejecutar evaluación ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
