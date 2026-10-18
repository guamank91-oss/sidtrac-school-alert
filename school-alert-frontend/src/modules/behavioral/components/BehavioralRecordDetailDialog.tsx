import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DECE_TYPE_LABELS, FAULT_TYPE_LABELS, TUTOR_TYPE_LABELS, URGENCY_LABELS } from '../labels'
import type { DeceReport, DisciplinaryReport, TutorAnnotation } from '../types'

type RecordKind = 'dece' | 'tutor' | 'disciplinary'

interface BehavioralRecordDetailDialogProps {
  kind: RecordKind | null
  deceReport?: DeceReport | null
  tutorNote?: TutorAnnotation | null
  disciplinaryReport?: DisciplinaryReport | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BehavioralRecordDetailDialog({
  kind,
  deceReport,
  tutorNote,
  disciplinaryReport,
  open,
  onOpenChange,
}: BehavioralRecordDetailDialogProps) {
  const title =
    kind === 'dece'
      ? 'Detalle reporte DECE'
      : kind === 'tutor'
        ? 'Detalle anotación de tutor'
        : kind === 'disciplinary'
          ? 'Detalle reporte disciplinario'
          : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Registro institucional de seguimiento conductual</DialogDescription>
        </DialogHeader>

        {kind === 'dece' && deceReport && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{deceReport.student_name}</Badge>
              <Badge variant="outline">{DECE_TYPE_LABELS[deceReport.report_type]}</Badge>
              <Badge variant="outline">{URGENCY_LABELS[deceReport.urgency_level]}</Badge>
              {deceReport.requires_follow_up && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Seguimiento</Badge>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descripción
              </p>
              <p className="mt-1 leading-relaxed">{deceReport.description}</p>
            </div>
            {deceReport.actions_taken ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary">Acciones tomadas</p>
                <p className="mt-1 leading-relaxed">{deceReport.actions_taken}</p>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Sin acciones registradas.</p>
            )}
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Curso</dt>
                <dd className="font-medium">{deceReport.course_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Registrado por</dt>
                <dd className="font-medium">{deceReport.author_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium">{formatDate(deceReport.reported_at)}</dd>
              </div>
            </dl>
          </div>
        )}

        {kind === 'tutor' && tutorNote && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{tutorNote.student_name}</Badge>
              <Badge variant="outline">{TUTOR_TYPE_LABELS[tutorNote.annotation_type]}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observación
              </p>
              <p className="mt-1 leading-relaxed">{tutorNote.description}</p>
            </div>
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Curso</dt>
                <dd className="font-medium">{tutorNote.course_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Tutor</dt>
                <dd className="font-medium">{tutorNote.author_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium">{formatDate(tutorNote.annotated_at)}</dd>
              </div>
            </dl>
          </div>
        )}

        {kind === 'disciplinary' && disciplinaryReport && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{disciplinaryReport.student_name}</Badge>
              <Badge variant="outline">{FAULT_TYPE_LABELS[disciplinaryReport.fault_type]}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Incidente
              </p>
              <p className="mt-1 leading-relaxed">{disciplinaryReport.description}</p>
            </div>
            {disciplinaryReport.sanction && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3">
                <p className="text-xs font-medium text-rose-800">Sanción aplicada</p>
                <p className="mt-1 leading-relaxed text-rose-900">{disciplinaryReport.sanction}</p>
              </div>
            )}
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Curso</dt>
                <dd className="font-medium">{disciplinaryReport.course_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Registrado por</dt>
                <dd className="font-medium">{disciplinaryReport.author_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Fecha</dt>
                <dd className="font-medium">{formatDate(disciplinaryReport.reported_at)}</dd>
              </div>
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
