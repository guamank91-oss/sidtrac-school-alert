import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { StudentSearchCombobox } from '@/modules/students/components/StudentSearchCombobox'
import type { Student } from '@/modules/students/types'
import { getApiErrorMessage } from '@/shared/lib/api'
import { createDisciplinaryReport, updateDisciplinaryReport } from '../api'
import { FAULT_TYPE_LABELS } from '../labels'
import type { DisciplinaryReport, FaultType } from '../types'

const FAULT_TYPES = Object.keys(FAULT_TYPE_LABELS) as FaultType[]

interface DisciplinaryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Student[]
  defaultStudentId?: string
  editReport?: DisciplinaryReport | null
  onSuccess?: () => void
}

export function DisciplinaryFormDialog({
  open,
  onOpenChange,
  students,
  defaultStudentId,
  editReport,
  onSuccess,
}: DisciplinaryFormDialogProps) {
  const [studentId, setStudentId] = useState('')
  const [faultType, setFaultType] = useState<FaultType | ''>('')
  const [description, setDescription] = useState('')
  const [sanction, setSanction] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editReport) {
      setStudentId(String(editReport.student_id))
      setFaultType(editReport.fault_type)
      setDescription(editReport.description)
      setSanction(editReport.sanction ?? '')
    } else {
      setStudentId(defaultStudentId ?? '')
      setFaultType('')
      setDescription('')
      setSanction('')
    }
    setFormError(null)
  }, [open, defaultStudentId, editReport])

  const handleSubmit = async () => {
    if (!studentId || !faultType || !description.trim()) {
      setFormError('Complete estudiante, tipo de falta y descripción')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editReport) {
        await updateDisciplinaryReport(editReport.id, {
          fault_type: faultType,
          description: description.trim(),
          sanction: sanction.trim() || null,
        })
      } else {
        await createDisciplinaryReport({
          student_id: Number(studentId),
          fault_type: faultType,
          description: description.trim(),
          sanction: sanction.trim() || null,
        })
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo guardar el reporte'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editReport ? 'Editar reporte disciplinario' : 'Nuevo reporte disciplinario'}
          </DialogTitle>
          <DialogDescription>
            Registro disciplinario del tutor de curso — faltas leves, graves o muy graves.
          </DialogDescription>
        </DialogHeader>

        {formError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Estudiante</Label>
            <StudentSearchCombobox
              students={students}
              value={studentId}
              onValueChange={setStudentId}
              disabled={editReport != null}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de falta</Label>
            <Select value={faultType} onValueChange={(v) => setFaultType(v as FaultType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar gravedad" />
              </SelectTrigger>
              <SelectContent>
                {FAULT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FAULT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción detallada</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-28"
            />
          </div>
          <div className="space-y-2">
            <Label>Sanción aplicada</Label>
            <Textarea
              value={sanction}
              onChange={(e) => setSanction(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editReport ? 'Guardar cambios' : 'Registrar reporte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
