import { useEffect, useState } from 'react'
import {
  Activity,
  Building2,
  CheckCircle2,
  Cpu,
  GraduationCap,
  Plus,
  ShieldAlert,
  Sparkles,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiGet, apiPost, apiPut } from '@/shared/lib/api'

interface SaaSMetrics {
  total_institutions: number
  active_institutions: number
  suspended_institutions: number
  total_students: number
  total_users: number
  total_alerts_generated: number
  total_ai_tokens_consumed: number
  active_superadmins: number
}

interface SaaSInstitution {
  id: number
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  status: string
  plan_tier: string
  ai_token_count: number
  student_count: number
  created_at: string
}

export function SuperAdminPage() {
  const [metrics, setMetrics] = useState<SaaSMetrics | null>(null)
  const [institutions, setInstitutions] = useState<SaaSInstitution[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [planTier, setPlanTier] = useState('pro')

  const loadData = async () => {
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        apiGet<SaaSMetrics>('/superadmin/metrics'),
        apiGet<SaaSInstitution[]>('/superadmin/institutions'),
      ])
      setMetrics(mRes)
      setInstitutions(iRes)
    } catch {
      toast.error('No se pudieron cargar los datos de SuperAdmin')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      toast.error('Complete el nombre y el código de la institución')
      return
    }
    setSaving(true)
    try {
      await apiPost('/superadmin/institutions', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        email: email.trim() || undefined,
        plan_tier: planTier,
      })
      toast.success('Institución registrada correctamente')
      setCreateModalOpen(false)
      setName('')
      setCode('')
      setEmail('')
      await loadData()
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar institución')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      await apiPut(`/superadmin/institutions/${id}/status`, { status: newStatus })
      toast.success(`Estado actualizado a ${newStatus}`)
      await loadData()
    } catch {
      toast.error('Error al actualizar estado de la institución')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-400 uppercase tracking-wider">
              Panel Maestro SaaS
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">SuperAdmin & Multi-Tenant</h1>
          <p className="text-muted-foreground text-sm">
            Monitoreo global de instituciones educativas, consumo de IA y suscripciones.
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2 font-semibold shadow-md">
          <Plus className="h-4 w-4" />
          Nueva Institución
        </Button>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Instituciones Totales</p>
              <p className="text-3xl font-bold font-display mt-1">{metrics?.total_institutions ?? '—'}</p>
              <p className="text-xs text-emerald-400 mt-1">
                {metrics?.active_institutions ?? 0} activas
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Estudiantes en Red</p>
              <p className="text-3xl font-bold font-display mt-1">{metrics?.total_students ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">En todas las sedes</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <GraduationCap className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Consumo Tokens IA</p>
              <p className="text-3xl font-bold font-display text-sky-400 mt-1">
                {metrics?.total_ai_tokens_consumed.toLocaleString() ?? '0'}
              </p>
              <p className="text-xs text-sky-300/80 mt-1">GPT-4o-mini via OpenRouter</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
              <Sparkles className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Alertas Totales</p>
              <p className="text-3xl font-bold font-display mt-1">{metrics?.total_alerts_generated ?? '—'}</p>
              <p className="text-xs text-amber-400 mt-1">Evaluaciones nocturnas</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Institutions Table Card */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Colegios e Instituciones Registradas
          </CardTitle>
          <CardDescription>
            Administre las suscripciones, el estado operativo y el plan de cada cliente institucional.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4">Institución</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4 text-center">Plan Tier</th>
                  <th className="py-3 px-4 text-center">Estudiantes</th>
                  <th className="py-3 px-4 text-center">Tokens IA</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {institutions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay instituciones registradas en la plataforma SaaS.
                    </td>
                  </tr>
                ) : (
                  institutions.map((inst) => (
                    <tr key={inst.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold">
                        {inst.name}
                        {inst.email && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {inst.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-primary">
                        {inst.code}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 px-2.5 py-0.5 text-xs font-semibold uppercase">
                          {inst.plan_tier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold tabular-nums">
                        {inst.student_count}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-sky-400">
                        {inst.ai_token_count.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            inst.status === 'activa'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : inst.status === 'prueba_gratuita'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${inst.status === 'activa' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {inst.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Select
                          value={inst.status}
                          onValueChange={(v) => handleUpdateStatus(inst.id, v)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="activa">Activa</SelectItem>
                            <SelectItem value="prueba_gratuita">Prueba Gratuita</SelectItem>
                            <SelectItem value="suspendida">Suspendida</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Nueva Institución */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Registrar Nueva Institución
            </DialogTitle>
            <DialogDescription>
              Cree un nuevo tenant institucional con código único para habilitar su acceso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInstitution} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del Colegio / Unidad Educativa</Label>
              <Input
                placeholder="Ej. Unidad Educativa San Francisco"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código Único (Tenant ID)</Label>
                <Input
                  placeholder="Ej. UESF"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Plan de Suscripción</Label>
                <Select value={planTier} onValueChange={setPlanTier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="pro">Pro Enterprise</SelectItem>
                    <SelectItem value="enterprise">Custom Multi-Sede</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Correo Institucional del Rector/Admin</Label>
              <Input
                type="email"
                placeholder="rectoria@colegio.edu.ec"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? 'Guardando...' : 'Crear Institución'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
