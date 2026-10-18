import { useCallback, useEffect, useState } from 'react'
import { Mail, RotateCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listEmailNotifications,
  resendEmail,
  sendTestEmail,
  type EmailNotification,
} from '../api'

const STATUS_BADGES: Record<string, string> = {
  enviado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
}

export function EmailAdminPanel() {
  const [emails, setEmails] = useState<EmailNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [testRecipient, setTestRecipient] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [resendingId, setResendingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    listEmailNotifications()
      .then(setEmails)
      .catch(() => toast.error('No se pudo cargar el historial de correos'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleTest = async () => {
    if (!testRecipient.includes('@')) {
      toast.error('Ingresa un correo válido')
      return
    }
    setSendingTest(true)
    try {
      const result = await sendTestEmail(testRecipient)
      if (result.status === 'enviado') {
        toast.success('Correo de prueba enviado correctamente')
      } else {
        toast.error(`El envío falló: ${result.error_detail ?? 'error desconocido'}`)
      }
      load()
    } catch {
      toast.error('No se pudo enviar el correo de prueba')
    } finally {
      setSendingTest(false)
    }
  }

  const handleResend = async (id: number) => {
    setResendingId(id)
    try {
      const result = await resendEmail(id)
      if (result.status === 'enviado') {
        toast.success('Correo reenviado correctamente')
      } else {
        toast.error(`El reenvío falló: ${result.error_detail ?? 'error desconocido'}`)
      }
      load()
    } catch {
      toast.error('No se pudo reenviar el correo')
    } finally {
      setResendingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Prueba de integración Resend
          </CardTitle>
          <CardDescription>
            Envía un correo de prueba para verificar que la integración funciona.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-md">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            <Button onClick={handleTest} disabled={sendingTest}>
              <Send className="h-4 w-4 mr-2" />
              {sendingTest ? 'Enviando...' : 'Enviar prueba'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de correos</CardTitle>
          <CardDescription>
            Resultado de cada envío con trazabilidad de Resend. Los fallidos pueden reenviarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aún no se han enviado correos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="font-medium">{email.recipient}</TableCell>
                    <TableCell className="max-w-56 truncate">{email.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGES[email.status]}>
                        {email.status}
                      </Badge>
                      {email.error_detail && (
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-48 truncate">
                          {email.error_detail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(email.created_at).toLocaleString('es-EC')}
                    </TableCell>
                    <TableCell className="text-right">
                      {email.status !== 'enviado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resendingId === email.id}
                          onClick={() => void handleResend(email.id)}
                        >
                          <RotateCw
                            className={`h-3.5 w-3.5 mr-1 ${
                              resendingId === email.id ? 'animate-spin' : ''
                            }`}
                          />
                          Reenviar
                        </Button>
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
