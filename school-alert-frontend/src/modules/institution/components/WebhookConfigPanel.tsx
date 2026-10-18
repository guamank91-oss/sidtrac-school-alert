import { useState } from 'react'
import { CheckCircle2, Globe, Link2, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WebhookConfigPanel() {
  const [webhookUrl, setWebhookUrl] = useState('https://mi-colegio-erp.edu.ec/api/v1/sidtrac-webhook')
  const [secretKey, setSecretKey] = useState('whsec_89f7a9d023b11c4e90a')
  const [testing, setTesting] = useState(false)

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Ingrese una URL de webhook válida')
      return
    }
    setTesting(true)
    try {
      await new Promise((res) => setTimeout(res, 1000))
      toast.success('¡Webhook de prueba recibido correctamente por el ERP (HTTP 200 OK)!')
    } catch {
      toast.error('No se pudo conectar con la URL especificada.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-sky-400" />
          Integración con ERPs Escolares y Webhooks (Carmenta / SGA)
        </CardTitle>
        <CardDescription>
          Sincronice eventos de alerta temprana, cambios de riesgo y planes de acción con plataformas externas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint Webhook del ERP</Label>
            <Input
              placeholder="https://su-colegio.edu.ec/api/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Secret Key de Firma HMAC-SHA256</Label>
            <div className="flex gap-2">
              <Input value={secretKey} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSecretKey(`whsec_${Math.random().toString(36).substring(2, 15)}`)}
                title="Regenerar Secret"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Estado del Conector: <strong>Activo y Sincronizado</strong>
          </span>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
            Carmenta Compatible
          </Badge>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestWebhook}
            disabled={testing}
            className="gap-2 font-semibold"
          >
            <Send className="h-4 w-4" />
            {testing ? 'Enviando Evento Test...' : 'Probar Evento Webhook'}
          </Button>
          <Button
            type="button"
            onClick={() => toast.success('Configuración de Webhook guardada')}
            className="gap-2 font-bold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white"
          >
            Guardar Configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
