import { useCallback, useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAuditActions, listAuditLogs, type AuditLog } from '../api'

const ACTION_LABELS: Record<string, string> = {
  inicio_sesion: 'Inicio de sesión',
  reporte_dece_creado: 'Reporte DECE creado',
  anotacion_tutor_creada: 'Anotación de tutor',
  reporte_disciplinario_creado: 'Reporte disciplinario',
  alerta_atendida: 'Alerta atendida',
  alerta_manual: 'Alerta manual',
  evaluacion_alertas: 'Evaluación de alertas',
  consulta_rag: 'Consulta RAG',
  configuracion_umbrales: 'Cambio de umbrales',
  email_prueba: 'Correo de prueba',
  reenvio_email: 'Reenvío de correo',
  exportacion_csv: 'Exportación CSV',
}

const ALL = 'todas'

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [actionFilter, setActionFilter] = useState(ALL)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      listAuditLogs({ action: actionFilter !== ALL ? actionFilter : undefined }),
      listAuditActions(),
    ])
      .then(([logList, actionList]) => {
        setLogs(logList)
        setActions(actionList)
      })
      .catch(() => toast.error('No se pudo cargar el log de auditoría'))
      .finally(() => setLoading(false))
  }, [actionFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Log de auditoría
            </CardTitle>
            <CardDescription>
              Inicios de sesión, reportes, alertas, consultas RAG y cambios de configuración.
            </CardDescription>
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las acciones</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>
                  {ACTION_LABELS[action] ?? action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin registros</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('es-EC')}
                  </TableCell>
                  <TableCell className="font-medium">{log.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                    {log.detail}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.ip_address ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
