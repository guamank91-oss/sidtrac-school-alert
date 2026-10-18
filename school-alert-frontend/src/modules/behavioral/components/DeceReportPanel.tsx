import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canCreateDeceReport, canEditDeceReport } from '@/modules/auth/lib/session'
import { getApiErrorMessage } from '@/shared/lib/api'
import { StudentSearchCombobox } from '@/modules/students/components/StudentSearchCombobox'
import { listStudents } from '@/modules/students/api'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import type { Student } from '@/modules/students/types'
import type { RiskLevel } from '@/shared/types/roles'
import { usePeriod, useTermId } from '@/shared/context/PeriodContext'
import { deleteDeceReport, listDeceReports } from '../api'
import { BehavioralRecordDetailDialog } from './BehavioralRecordDetailDialog'
import { DeceReportFormDialog } from './DeceReportFormDialog'
import { DECE_TYPE_LABELS, URGENCY_LABELS } from '../labels'
import type { DeceReport, DeceReportType } from '../types'

const DECE_TYPES = Object.keys(DECE_TYPE_LABELS) as DeceReportType[]
const URGENCY_LEVELS: RiskLevel[] = ['bajo', 'medio', 'alto', 'critico']

interface DeceReportPanelProps {
  initialStudentFilter?: string
  highlightReportId?: number
}

export function DeceReportPanel({
  initialStudentFilter,
  highlightReportId,
}: DeceReportPanelProps = {}) {
  const termId = useTermId()
  const { isViewingActiveTerm } = usePeriod()
  const canCreate = canCreateDeceReport() && isViewingActiveTerm
  const canEdit = canEditDeceReport() && isViewingActiveTerm
  const [students, setStudents] = useState<Student[]>([])
  const [reports, setReports] = useState<DeceReport[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editReport, setEditReport] = useState<DeceReport | null>(null)
  const [detailReport, setDetailReport] = useState<DeceReport | null>(null)
  const [deletingReport, setDeletingReport] = useState<DeceReport | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [filterStudent, setFilterStudent] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listDeceReports({
        student_id: filterStudent !== 'all' ? Number(filterStudent) : undefined,
        report_type: filterType !== 'all' ? (filterType as DeceReportType) : undefined,
        urgency_level: filterUrgency !== 'all' ? (filterUrgency as RiskLevel) : undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        term_id: termId,
      })
      setReports(data)
    } catch {
      toast.error('No se pudieron cargar los reportes DECE')
    } finally {
      setLoading(false)
    }
  }, [filterStudent, filterType, filterUrgency, filterDateFrom, filterDateTo, termId])

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
    const el = document.getElementById(`dece-report-${highlightReportId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightReportId, loading, reports])

  const handleDelete = async () => {
    if (!deletingReport) return
    setDeleting(true)
    try {
      await deleteDeceReport(deletingReport.id)
      toast.success('Reporte DECE eliminado')
      setDeletingReport(null)
      await loadReports()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el reporte'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="glass-panel border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-4 bg-black/20 border-b border-white/10">
          <div>
            <CardTitle className="text-lg font-display text-white">Reportes DECE</CardTitle>
            <CardDescription className="text-slate-400 mt-1">Filtrar por estudiante, tipo, urgencia y fechas</CardDescription>
          </div>
          {canCreate && (
            <Button className="gap-2 shrink-0 bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-500/25" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo reporte
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StudentSearchCombobox
              students={students}
              value={filterStudent}
              onValueChange={setFilterStudent}
              placeholder="Todos los estudiantes"
              allOption={{ value: 'all', label: 'Todos los estudiantes' }}
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {DECE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DECE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUrgency} onValueChange={setFilterUrgency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Urgencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda urgencia</SelectItem>
                {URGENCY_LEVELS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {URGENCY_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin reportes con estos filtros.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  id={`dece-report-${r.id}`}
                  className={`rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group ${
                    highlightReportId === r.id 
                      ? 'border-purple-500/50 bg-purple-500/10 ring-2 ring-purple-500/20' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-lg text-white">{r.student_name}</span>
                      <Badge variant="outline" className="border-white/10 text-slate-300 bg-black/20">{DECE_TYPE_LABELS[r.report_type]}</Badge>
                      <Badge variant="outline" className={`${
                        r.urgency_level === 'critico' ? 'border-red-500/50 text-red-300 bg-red-500/10' :
                        r.urgency_level === 'alto' ? 'border-orange-500/50 text-orange-300 bg-orange-500/10' :
                        r.urgency_level === 'medio' ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' :
                        'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
                      }`}>{URGENCY_LABELS[r.urgency_level]}</Badge>
                      {r.requires_follow_up && (
                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
                          Seguimiento
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-full bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white"
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
                            className="h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white"
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
                            className="h-8 w-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                            onClick={() => setDeletingReport(r)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-200 leading-relaxed">{r.description}</p>
                  {r.actions_taken && (
                    <p className="mt-2 line-clamp-1 text-xs text-slate-300">
                      <span className="font-semibold text-white">Acciones: </span>
                      {r.actions_taken}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400 border-t border-white/5 pt-3">
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

      <DeceReportFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditReport(null)
        }}
        students={students}
        defaultStudentId={filterStudent !== 'all' ? filterStudent : undefined}
        editReport={editReport}
        onSuccess={() => {
          toast.success(editReport ? 'Reporte DECE actualizado' : 'Reporte DECE registrado')
          setEditReport(null)
          loadReports()
        }}
      />

      <BehavioralRecordDetailDialog
        kind="dece"
        deceReport={detailReport}
        open={detailReport !== null}
        onOpenChange={(open) => !open && setDetailReport(null)}
      />

      <AlertDialog
        open={deletingReport !== null}
        onOpenChange={(open) => !open && setDeletingReport(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reporte DECE?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el reporte
              {deletingReport ? ` de ${deletingReport.student_name}` : ''} y su registro asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
