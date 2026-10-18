import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, UserPlus, X } from 'lucide-react'
import { createUser } from '@/modules/users/api'
import type { BasicUser, Course } from '@/modules/institution/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { getApiErrorMessage } from '@/shared/lib/api'
import { createStudent } from '../api'

export const EMPTY_STUDENT_FORM = {
  first_name: '',
  last_name: '',
  national_id: '',
  birth_date: '',
  gender: '',
  course_id: '',
  guardian_id: '',
}

const EMPTY_GUARDIAN = {
  first_name: '',
  last_name: '',
  national_id: '',
}

export interface StudentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  institutionId: number
  courses: Course[]
  tutors: BasicUser[]
  guardians: BasicUser[]
  onSuccess?: (message: string) => void
  onGuardiansChanged?: () => void | Promise<void>
}

export function StudentFormDialog({
  open,
  onOpenChange,
  institutionId,
  courses,
  tutors,
  guardians,
  onSuccess,
  onGuardiansChanged,
}: StudentFormDialogProps) {
  const [form, setForm] = useState(EMPTY_STUDENT_FORM)
  const [showQuickGuardian, setShowQuickGuardian] = useState(false)
  const [quickGuardian, setQuickGuardian] = useState(EMPTY_GUARDIAN)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formNotice, setFormNotice] = useState<string | null>(null)

  const tutorById = useMemo(
    () => new Map(tutors.map((t) => [t.id, `${t.first_name} ${t.last_name}`])),
    [tutors]
  )

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === form.course_id),
    [courses, form.course_id]
  )

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_STUDENT_FORM)
      setQuickGuardian(EMPTY_GUARDIAN)
      setShowQuickGuardian(false)
      setFormError(null)
      setFormNotice(null)
    }
  }, [open])

  const patchForm = (patch: Partial<typeof EMPTY_STUDENT_FORM>) => {
    setFormError(null)
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const quickGuardianComplete =
    Boolean(quickGuardian.first_name) &&
    Boolean(quickGuardian.last_name) &&
    Boolean(quickGuardian.national_id)

  const guardianLinked = Boolean(form.guardian_id)

  const guardianQuickFormDirty =
    Boolean(quickGuardian.first_name) ||
    Boolean(quickGuardian.last_name) ||
    Boolean(quickGuardian.national_id)

  const createAndLinkGuardian = async (): Promise<number | null> => {
    if (!quickGuardianComplete) {
      setFormError('Complete nombres, apellidos y cédula del representante')
      setFormNotice(null)
      return null
    }
    if (quickGuardian.national_id.trim().length < 5) {
      setFormError('La cédula del representante debe tener al menos 5 caracteres')
      setFormNotice(null)
      return null
    }
    try {
      const created = await createUser({
        institution_id: institutionId,
        first_name: quickGuardian.first_name,
        last_name: quickGuardian.last_name,
        national_id: quickGuardian.national_id,
        roles: ['representante'],
      })
      await onGuardiansChanged?.()
      setForm((prev) => ({ ...prev, guardian_id: String(created.id) }))
      setQuickGuardian(EMPTY_GUARDIAN)
      setShowQuickGuardian(false)
      setFormNotice(`Representante creado y vinculado: ${created.username}`)
      return created.id
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo registrar el representante'))
      setFormNotice(null)
      return null
    }
  }

  const handleCreateGuardian = async () => {
    setSaving(true)
    setFormError(null)
    try {
      await createAndLinkGuardian()
    } finally {
      setSaving(false)
    }
  }

  const resolveGuardianId = async (): Promise<number | null> => {
    if (form.guardian_id) return Number(form.guardian_id)

    if (showQuickGuardian) {
      if (!quickGuardianComplete) {
        if (guardianQuickFormDirty) {
          setFormError(
            'Complete todos los datos del representante o pulse «Crear representante y vincular» antes de registrar al estudiante'
          )
        } else {
          setFormError(
            'Debe crear y vincular un representante antes de registrar al estudiante'
          )
        }
        setFormNotice(null)
        return null
      }
      return await createAndLinkGuardian()
    }

    setFormError('Seleccione un representante existente o registre uno nuevo')
    setFormNotice(null)
    return null
  }

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !form.course_id) {
      setFormError('Complete nombres, apellidos y curso')
      setFormNotice(null)
      return
    }
    setSaving(true)
    setFormError(null)
    setFormNotice(null)
    try {
      const guardianId = await resolveGuardianId()
      if (!guardianId) return

      await createStudent({
        institution_id: institutionId,
        course_id: Number(form.course_id),
        first_name: form.first_name,
        last_name: form.last_name,
        national_id: form.national_id || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        guardian_id: guardianId,
      })
      onSuccess?.('Estudiante registrado correctamente')
      onOpenChange(false)
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          'No se pudo registrar el estudiante. Verifique curso, cédula y representante.'
        )
      )
    } finally {
      setSaving(false)
    }
  }

  const canSubmitStudent =
    courses.length > 0 &&
    !saving &&
    (guardianLinked || (showQuickGuardian && quickGuardianComplete) || (!showQuickGuardian && Boolean(form.guardian_id)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Nuevo estudiante
          </DialogTitle>
          <DialogDescription>
            Registre un alumno en el curso activo. Puede vincular o crear un representante.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}
        {formNotice && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {formNotice}
          </div>
        )}

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombres</Label>
            <Input
              value={form.first_name}
              onChange={(e) => patchForm({ first_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Apellidos</Label>
            <Input
              value={form.last_name}
              onChange={(e) => patchForm({ last_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cédula</Label>
            <Input
              value={form.national_id}
              onChange={(e) => patchForm({ national_id: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de nacimiento</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => patchForm({ birth_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Género</Label>
            <Select
              value={form.gender || undefined}
              onValueChange={(v) => patchForm({ gender: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Curso</Label>
            <Select
              value={form.course_id || undefined}
              onValueChange={(v) => patchForm({ course_id: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar curso" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCourse?.tutor_id && (
              <p className="text-xs text-muted-foreground">
                Tutor: {tutorById.get(selectedCourse.tutor_id) ?? 'Asignado'}
              </p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Representante <span className="text-destructive">*</span>
            </Label>
            {guardianLinked ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Vinculado:{' '}
                  {guardians.find((g) => String(g.id) === form.guardian_id)?.first_name ?? 'Representante'}{' '}
                  {guardians.find((g) => String(g.id) === form.guardian_id)?.last_name ?? ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-emerald-800 hover:text-emerald-900 dark:text-emerald-300"
                  onClick={() => {
                    patchForm({ guardian_id: '' })
                    setShowQuickGuardian(false)
                    setQuickGuardian(EMPTY_GUARDIAN)
                    setFormNotice(null)
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Select
                  value={form.guardian_id || undefined}
                  onValueChange={(v) => patchForm({ guardian_id: v })}
                  disabled={showQuickGuardian}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar representante" />
                  </SelectTrigger>
                  <SelectContent>
                    {guardians.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.first_name} {g.last_name} ({g.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                  <Checkbox
                    checked={showQuickGuardian}
                    onCheckedChange={(checked) => {
                      const next = checked === true
                      setShowQuickGuardian(next)
                      setFormError(null)
                      setFormNotice(null)
                      if (next) {
                        patchForm({ guardian_id: '' })
                      } else {
                        setQuickGuardian(EMPTY_GUARDIAN)
                      }
                    }}
                  />
                  Registrar representante nuevo
                </label>
              </>
            )}
          </div>
        </div>

        {showQuickGuardian && !guardianLinked && (
          <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-4">
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                El estudiante <strong className="text-foreground">debe tener un representante</strong>.
                Complete los datos y pulse el botón destacado, o registre al estudiante y el
                representante se creará automáticamente si los datos están completos.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombres del representante *</Label>
                <Input
                  value={quickGuardian.first_name}
                  onChange={(e) =>
                    setQuickGuardian({ ...quickGuardian, first_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Apellidos *</Label>
                <Input
                  value={quickGuardian.last_name}
                  onChange={(e) =>
                    setQuickGuardian({ ...quickGuardian, last_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cédula (será su contraseña) *</Label>
                <Input
                  value={quickGuardian.national_id}
                  onChange={(e) =>
                    setQuickGuardian({ ...quickGuardian, national_id: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">Mínimo 5 caracteres.</p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleCreateGuardian()}
              disabled={saving || !quickGuardianComplete}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Crear representante y vincular
            </Button>
          </div>
        )}

        {!showQuickGuardian && !guardianLinked && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Seleccione un representante de la lista o marque la opción para registrar uno nuevo.
          </p>
        )}

        {courses.length === 0 && (
          <p className="text-sm text-amber-600">
            Cree cursos en Configuración (periodo activo) antes de registrar estudiantes.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmitStudent}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Registrar estudiante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
