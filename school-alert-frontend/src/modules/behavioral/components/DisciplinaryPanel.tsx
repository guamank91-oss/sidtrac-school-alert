import { useCallback, useEffect, useState } from 'react'
import { Eye, Info, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { canCreateDisciplinaryReport, canEditDisciplinaryReport } from '@/modules/auth/lib/session'
import { getApiErrorMessage } from '@/shared/lib/api'
import { StudentSearchCombobox } from '@/modules/students/components/StudentSearchCombobox'
import { listStudents } from '@/modules/students/api'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import type { Student } from '@/modules/students/types'
import { deleteDisciplinaryReport, listDisciplinaryReports } from '../api'
import { usePeriod, useTermId } from '@/shared/context/PeriodContext'
import { BehavioralRecordDetailDialog } from './BehavioralRecordDetailDialog'
import { DisciplinaryFormDialog } from './DisciplinaryFormDialog'
import { FAULT_TYPE_LABELS } from '../labels'
import type { DisciplinaryReport } from '../types'

interface DisciplinaryPanelProps {
  initialStudentFilter?: string
  highlightReportId?: number
}

const FAULT_COLORS: Record<string, string> = {
  leve: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  grave: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  muy_grave: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const FAULT_BORDER: Record<string, string> = {
  leve: 'from-amber-500',
  grave: 'from-orange-500',
  muy_grave: 'from-red-500',
}

export function DisciplinaryPanel({
  initialStudentFilter,
  highlightReportId,
}: DisciplinaryPanelProps = {}) {
  const termId = useTermId()
  const { isViewingActiveTerm } = usePeriod()
  const canCreate = canCreateDisciplinaryReport() && isViewingActiveTerm
  const canEdit = canEditDisciplinaryReport() && isViewingActiveTerm
  const [students, setStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<DisciplinaryReport[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editReport, setEditReport] = useState<DisciplinaryReport | null>(null)
  const [detailReport, setDetailReport] = useState<DisciplinaryReport | null>(null)
  const [deletingReport, setDeletingReport] = useState<DisciplinaryReport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterStudent, setFilterStudent] = useState('all')

  const handleDelete = async () => {
    if (!deletingReport) return
    setDeleting(true)
    try {
      await deleteDisciplinaryReport(deletingReport.id)
      toast.success('Reporte disciplinario eliminado')
      setDeletingReport(null)
      await loadReports()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el reporte'))
    } finally {
      setDeleting(false)
    }
  }

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      setReports(
        await listDisciplinaryReports(
          filterStudent !== 'all' ? Number(filterStudent) : undefined,
          termId
        )
      )
    } catch {
      toast.error('No se pudieron cargar los reportes disciplinarios')
    } finally {
      setLoading(false)
    }
  }, [filterStudent, termId])

  useEffect(() => {
    listStudents({ term_id: termId })
      .then((rows) => setStudents(rows.map(studentRecordToUi)))
      .catch(() => toast.error('No se pudieron cargar los estudiantes'))
  }, [termId])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  useEffect(() => {
    if (initialStudentFilter) {
      setFilterStudent(initialStudentFilter)
    }
  }, [initialStudentFilter])

  useEffect(() => {
    if (!highlightReportId || loading) return
    const el = document.getElementById(`disciplinary-report-${highlightReportId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightReportId, loading, reports])

  return (
    <div className="space-y-4">
      {canCreate ? (
        <div className="flex gap-3 rounded-2xl glass-panel border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300 shadow-lg shadow-emerald-500/5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>
            Use <strong className="text-emerald-200">anotaciones</strong> para observaciones del día a día. Use{' '}
            <strong className="text-emerald-200">disciplinarios</strong> cuando deba quedar constancia formal de una falta y
            sanción en su paralelo.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl glass-panel border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-300 shadow-lg shadow-sky-500/5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div>
            <p className="font-semibold text-sky-200">Registro disciplinario del tutor</p>
            <p className="mt-1 text-sky-300/90">
              Las faltas formales con sanción las registra el <strong className="text-sky-200">tutor de curso</strong>. El
              DECE consulta aquí esos registros junto con sus reportes formales.
            </p>
          </div>
        </div>
      )}

      <Card className="glass-panel border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-4 bg-black/20 border-b border-white/10">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-display text-white">
              <ShieldAlert className="h-5 w-5 text-indigo-400" />
              Reportes disciplinarios
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {canCreate
                ? 'Registre faltas leves, graves o muy graves de su paralelo'
                : 'Consulta de registros disciplinarios del tutor de curso'}
            </CardDescription>
          </div>
          {canCreate && (
            <Button className="gap-2 shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 border-0 rounded-xl" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo reporte
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <StudentSearchCombobox
            students={students}
            value={filterStudent}
            onValueChange={setFilterStudent}
            placeholder="Todos los estudiantes"
            className="sm:max-w-xs bg-white/5 border-white/10 text-white"
            allOption={{ value: 'all', label: 'Todos los estudiantes' }}
          />

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
                <ShieldAlert className="h-7 w-7 text-slate-400 opacity-60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Sin reportes disciplinarios</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                  {canCreate
                    ? 'Registre un incidente formal cuando aplique una sanción en su paralelo.'
                    : 'Aún no hay faltas disciplinarias registradas por el tutor para los filtros seleccionados.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r, idx) => (
                <div
                  key={r.id}
                  id={`disciplinary-report-${r.id}`}
                  className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group animate-slide-up ${
                    highlightReportId === r.id 
                      ? 'border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-gradient-to-b to-transparent opacity-70 ${FAULT_BORDER[r.fault_type] ?? 'from-slate-500'}`} />
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-lg text-white group-hover:text-indigo-300 transition-colors">{r.student_name}</span>
                      <Badge
                        variant="outline"
                        className={`border text-[10px] uppercase font-bold ${FAULT_COLORS[r.fault_type] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/20'}`}
                      >
                        {FAULT_TYPE_LABELS[r.fault_type]}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-xl bg-black/20 hover:bg-white/10 text-slate-300 hover:text-white"
                        onClick={() => setDetailReport(r)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalle
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl bg-black/20 hover:bg-white/10 text-slate-300 hover:text-white"
                            onClick={() => {
                              setEditReport(r)
                              setFormOpen(true)
                            }}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                            onClick={() => setDeletingReport(r)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 pl-2 line-clamp-2 text-sm text-slate-300 leading-relaxed">{r.description}</p>
                  {r.sanction && (
                    <p className="mt-2 pl-2 line-clamp-1 text-xs text-indigo-300/80 bg-indigo-500/10 border border-indigo-500/20 rounded-md px-2 py-1 inline-block">
                      <span className="font-semibold text-indigo-300">Sanción:</span> {r.sanction}
                    </p>
                  )}
                  <div className="mt-4 pl-2 flex items-center gap-2 text-xs font-medium text-slate-400 border-t border-white/5 pt-3">
                    <span>{new Date(r.reported_at).toLocaleDateString('es-EC')}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>{r.author_name}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>{r.course_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(canCreate || canEdit) && (
        <DisciplinaryFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open)
            if (!open) setEditReport(null)
          }}
          students={students}
          defaultStudentId={filterStudent !== 'all' ? filterStudent : undefined}
          editReport={editReport}
          onSuccess={() => {
            toast.success(editReport ? 'Reporte actualizado' : 'Reporte disciplinario registrado')
            setEditReport(null)
            loadReports()
          }}
        />
      )}

      <BehavioralRecordDetailDialog
        kind="disciplinary"
        disciplinaryReport={detailReport}
        open={detailReport !== null}
        onOpenChange={(open) => !open && setDetailReport(null)}
      />

      <AlertDialog
        open={deletingReport !== null}
        onOpenChange={(open) => !open && setDeletingReport(null)}
      >
        <AlertDialogContent className="glass-panel border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar reporte disciplinario?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción no se puede deshacer. Se eliminará el reporte
              {deletingReport ? ` de ${deletingReport.student_name}` : ''} y su registro asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="bg-transparent border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl border-0 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
