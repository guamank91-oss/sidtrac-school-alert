import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, UserPlus } from 'lucide-react'
import { getUser } from '@/modules/auth/lib/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createUser, listUsers, updateUser } from '../api'
import { ASSIGNABLE_ROLES, type StaffRole, type User } from '../types'
import { ROLE_LABELS, type UserRole } from '@/shared/types/roles'

const TAB_LABELS: Record<StaffRole, string> = {
  tutor: 'Tutores',
  docente: 'Docentes',
  representante: 'Representantes',
  dece: 'DECE',
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  national_id: '',
  roles: [] as UserRole[],
}

export function UsersPage() {
  const sessionUser = getUser()
  const institutionId = sessionUser?.institution_id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<StaffRole>('tutor')
  const [staff, setStaff] = useState<User[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<User | null>(null)
  const [deactivating, setDeactivating] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    ...EMPTY_FORM,
    status: 'activo' as 'activo' | 'inactivo',
  })
  const [saving, setSaving] = useState(false)

  const loadStaff = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers({ institution_id: institutionId, role: activeTab })
      setStaff(data)
    } catch {
      setError('No se pudo cargar el personal')
    } finally {
      setLoading(false)
    }
  }, [institutionId, activeTab])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  const toggleRole = (roles: UserRole[], role: UserRole, checked: boolean) => {
    if (checked) return [...roles, role]
    return roles.filter((r) => r !== role)
  }

  const handleCreate = async () => {
    if (!institutionId || !form.first_name || !form.last_name || !form.national_id || form.roles.length === 0) {
      setError('Complete nombres, apellidos, cédula y al menos un rol')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const created = await createUser({
        institution_id: institutionId,
        first_name: form.first_name,
        last_name: form.last_name,
        national_id: form.national_id,
        roles: form.roles,
        email: form.email || null,
      })
      setForm(EMPTY_FORM)
      setSuccess(`Registrado. Usuario: ${created.username} — contraseña inicial: cédula`)
      await loadStaff()
    } catch {
      setError('No se pudo registrar. Verifique la cédula y los datos ingresados.')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email ?? '',
      national_id: user.national_id ?? '',
      roles: user.roles.filter((r) => ASSIGNABLE_ROLES.includes(r as StaffRole)) as UserRole[],
      status: user.status,
    })
  }

  const handleUpdate = async () => {
    if (!editing || editForm.roles.length === 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateUser(editing.id, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        national_id: editForm.national_id || null,
        roles: editForm.roles,
        status: editForm.status,
      })
      setEditing(null)
      setSuccess(`Actualizado. Usuario: ${updated.username}`)
      await loadStaff()
    } catch {
      setError('No se pudo actualizar el usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivating) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateUser(deactivating.id, { status: 'inactivo' })
      setDeactivating(null)
      setSuccess(`${deactivating.first_name} ${deactivating.last_name} fue desactivado`)
      await loadStaff()
    } catch {
      setError('No se pudo desactivar el usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (user: User) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateUser(user.id, { status: 'activo' })
      setSuccess(`${user.first_name} ${user.last_name} fue activado`)
      await loadStaff()
    } catch {
      setError('No se pudo activar el usuario')
    } finally {
      setSaving(false)
    }
  }

  if (!institutionId) {
    return <p className="text-muted-foreground">Sesión sin institución asociada.</p>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display font-bold text-white tracking-tight">Personal</h1>
        <p className="text-sm text-slate-400">
          Gestione el acceso del personal educativo, asigne roles y configure sus credenciales de ingreso.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2 shadow-lg shadow-red-500/10">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2 shadow-lg shadow-emerald-500/10">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          {success}
        </div>
      )}

      {/* ── CREATE USER FORM ── */}
      <Card className="glass-panel border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-sky-500/10 to-transparent rounded-bl-full pointer-events-none" />
        <CardHeader className="border-b border-white/10 bg-black/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-display text-white">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
            Nuevo personal
          </CardTitle>
          <CardDescription className="text-slate-400">
            El usuario y contraseña se generan automáticamente (usuario según nombre/apellidos, contraseña = cédula).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 relative z-10">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nombres</Label>
              <Input className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50" placeholder="Ej. Juan Carlos" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Apellidos</Label>
              <Input className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50" placeholder="Ej. Pérez Silva" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Cédula</Label>
              <Input className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50" placeholder="10 dígitos" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Correo (opcional)</Label>
              <Input className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-2xl bg-black/20 border border-white/5">
            <Label className="text-slate-300 font-semibold">Roles a asignar</Label>
            <div className="flex flex-wrap gap-4">
              {ASSIGNABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-white/10">
                  <Checkbox
                    checked={form.roles.includes(role)}
                    className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                    onCheckedChange={(checked) =>
                      setForm({ ...form, roles: toggleRole(form.roles, role, checked === true) })
                    }
                  />
                  <span className="text-slate-200">{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => void handleCreate()} disabled={saving} className="gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border-0 rounded-xl px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar usuario
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── USER LIST TABS ── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StaffRole)} className="space-y-6">
        <TabsList className="bg-black/20 border border-white/10 p-1 rounded-xl glass-panel">
          {(Object.keys(TAB_LABELS) as StaffRole[]).map((tab) => (
            <TabsTrigger key={tab} value={tab} className="rounded-lg data-[state=active]:bg-white/15 data-[state=active]:text-white text-slate-400 data-[state=active]:shadow-lg transition-all">
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(TAB_LABELS) as StaffRole[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0 outline-none">
            <Card className="glass-panel border-white/10 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-black/40 border-b border-white/10">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4">Nombre</TableHead>
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4">Usuario</TableHead>
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4">Cédula</TableHead>
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4">Roles</TableHead>
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4">Estado</TableHead>
                      <TableHead className="text-slate-300 font-semibold uppercase text-[10px] tracking-wider py-4 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : staff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col justify-center items-center h-full text-slate-400 gap-2">
                            <UserPlus className="h-8 w-8 opacity-20" />
                            <p>No hay {TAB_LABELS[tab].toLowerCase()} registrados</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      staff.map((user) => (
                        <TableRow key={user.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                          <TableCell className="font-medium text-white group-hover:text-sky-300 transition-colors py-3">
                            {user.first_name} {user.last_name}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-400 py-3">{user.username}</TableCell>
                          <TableCell className="text-slate-400 py-3">{user.national_id ?? '—'}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles.map((role) => (
                                <Badge key={role} variant="outline" className="text-[10px] bg-black/20 border-white/10 text-slate-300">
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {user.status === 'activo' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 text-[10px]">Activo</Badge>
                            ) : (
                              <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 text-[10px]">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <div className="flex justify-end items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl bg-black/20 hover:bg-white/10 text-slate-300 hover:text-white" onClick={() => openEdit(user)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {user.status === 'activo' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs px-3"
                                  onClick={() => setDeactivating(user)}
                                >
                                  Desactivar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-xs px-3"
                                  disabled={saving}
                                  onClick={() => void handleActivate(user)}
                                >
                                  Activar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* ── EDIT DIALOG ── */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="glass-panel border-white/10 shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Editar personal</DialogTitle>
          </DialogHeader>
          {editing && (
            <p className="text-sm text-slate-400 bg-black/20 p-2 rounded-lg border border-white/5">
              Usuario: <span className="font-mono text-sky-300">{editing.username}</span>
            </p>
          )}
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Nombres</Label>
              <Input
                className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Apellidos</Label>
              <Input
                className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Correo (opcional)</Label>
              <Input
                className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Cédula</Label>
              <Input
                className="bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50"
                value={editForm.national_id}
                onChange={(e) => setEditForm({ ...editForm, national_id: e.target.value })}
              />
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Al cambiar la cédula se actualiza la contraseña.</p>
            </div>
            <div className="space-y-2 p-3 rounded-xl bg-black/20 border border-white/5">
              <Label className="text-slate-300">Roles</Label>
              <div className="flex flex-wrap gap-4 mt-2">
                {ASSIGNABLE_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editForm.roles.includes(role)}
                      className="border-white/20 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                      onCheckedChange={(checked) =>
                        setEditForm({
                          ...editForm,
                          roles: toggleRole(editForm.roles, role, checked === true),
                        })
                      }
                    />
                    <span className="text-slate-300">{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Estado</Label>
              <Select
                value={editForm.status}
                onValueChange={(v: 'activo' | 'inactivo') => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger className="bg-black/20 border-white/10 text-white focus:ring-sky-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 text-white">
                  <SelectItem value="activo" className="focus:bg-white/10 text-emerald-400">Activo</SelectItem>
                  <SelectItem value="inactivo" className="focus:bg-white/10 text-slate-400">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditing(null)} className="text-slate-300 hover:text-white hover:bg-white/10 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={saving} className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white border-0 shadow-lg shadow-sky-500/25 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DEACTIVATE DIALOG ── */}
      <AlertDialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent className="glass-panel border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deactivating && (
                <>
                  <span className="font-semibold text-white">
                    {deactivating.first_name} {deactivating.last_name}
                  </span>{' '}
                  no podrá iniciar sesión mientras esté inactivo. Puede reactivarlo desde Editar.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving} className="bg-transparent border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDeactivate()
              }}
              disabled={saving}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl border-0 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
