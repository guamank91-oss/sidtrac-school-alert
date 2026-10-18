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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { StudentSearchCombobox } from '@/modules/students/components/StudentSearchCombobox'
import type { Student } from '@/modules/students/types'
import type { RiskLevel } from '@/shared/types/roles'
import { getApiErrorMessage } from '@/shared/lib/api'
import { createDeceReport, updateDeceReport } from '../api'
import { DECE_TYPE_LABELS, URGENCY_LABELS } from '../labels'
import type { DeceReport, DeceReportType } from '../types'

const DECE_TYPES = Object.keys(DECE_TYPE_LABELS) as DeceReportType[]
const URGENCY_LEVELS: RiskLevel[] = ['bajo', 'medio', 'alto', 'critico']

interface DeceReportFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: Student[]
  defaultStudentId?: string
  editReport?: DeceReport | null
  onSuccess?: () => void
}

export function DeceReportFormDialog({
  open,
  onOpenChange,
  students,
  defaultStudentId,
  editReport,
  onSuccess,
}: DeceReportFormDialogProps) {
  const [studentId, setStudentId] = useState('')
  const [reportType, setReportType] = useState<DeceReportType | ''>('')
  const [description, setDescription] = useState('')
  const [actionsTaken, setActionsTaken] = useState('')
  const [urgencyLevel, setUrgencyLevel] = useState<RiskLevel>('medio')
  const [requiresFollowUp, setRequiresFollowUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editReport) {
      setStudentId(String(editReport.student_id))
      setReportType(editReport.report_type)
      setDescription(editReport.description)
      setActionsTaken(editReport.actions_taken ?? '')
      setUrgencyLevel(editReport.urgency_level)
      setRequiresFollowUp(editReport.requires_follow_up)
    } else {
      setStudentId(defaultStudentId ?? '')
      setReportType('')
      setDescription('')
      setActionsTaken('')
      setUrgencyLevel('medio')
      setRequiresFollowUp(false)
    }
    setFormError(null)
  }, [open, defaultStudentId, editReport])

  const patch = () => setFormError(null)

  const handleSubmit = async () => {
    if (!studentId || !reportType || !description.trim()) {
      setFormError('Complete estudiante, tipo y descripción')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editReport) {
        await updateDeceReport(editReport.id, {
          report_type: reportType,
          description: description.trim(),
          actions_taken: actionsTaken.trim() || null,
          urgency_level: urgencyLevel,
          requires_follow_up: requiresFollowUp,
        })
      } else {
        await createDeceReport({
          student_id: Number(studentId),
          report_type: reportType,
          description: description.trim(),
          actions_taken: actionsTaken.trim() || null,
          urgency_level: urgencyLevel,
          requires_follow_up: requiresFollowUp,
        })
      }
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo guardar el reporte. Verifique los datos.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editReport ? 'Editar reporte DECE' : 'Nuevo reporte DECE'}</DialogTitle>
          <DialogDescription>
            Observaciones, entrevistas, alertas emocionales, derivaciones y planes de intervención.
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
              onValueChange={(v) => {
                setStudentId(v)
                patch()
              }}
              placeholder="Buscar estudiante..."
              disabled={editReport != null}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de reporte</Label>
            <Select
              value={reportType}
              onValueChange={(v) => {
                setReportType(v as DeceReportType)
                patch()
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {DECE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DECE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                patch()
              }}
              placeholder="Describa la situación observada..."
              className="min-h-28"
            />
          </div>
          <div className="space-y-2">
            <Label>Acciones tomadas</Label>
            <Textarea
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              placeholder="Opcional: medidas o acciones realizadas"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-2">
              <Label>Nivel de urgencia</Label>
              <Select
                value={urgencyLevel}
                onValueChange={(v) => setUrgencyLevel(v as RiskLevel)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_LEVELS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {URGENCY_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pb-2">
              <Switch checked={requiresFollowUp} onCheckedChange={setRequiresFollowUp} />
              <Label>Requiere seguimiento</Label>
            </div>
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
