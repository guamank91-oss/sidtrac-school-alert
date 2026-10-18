import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Users,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getAcademicOverview } from '@/modules/academic/api'
import { parseScore } from '@/modules/academic/utils/formatScore'
import { createTutorNote, listTutorNotes } from '@/modules/behavioral/api'
import { TUTOR_TYPE_LABELS } from '@/modules/behavioral/labels'
import type { TutorAnnotation, TutorAnnotationType } from '@/modules/behavioral/types'
import { listStudents } from '@/modules/students/api'
import { StudentListTable } from '@/modules/students/components/StudentListTable'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import type { Student } from '@/modules/students/types'
import { useTermId } from '@/shared/context/PeriodContext'

const ANNOTATION_TYPES = Object.keys(TUTOR_TYPE_LABELS) as TutorAnnotationType[]

export function TutorDashboard() {
  const navigate = useNavigate()
  const termId = useTermId()
  const [students, setStudents] = useState<Student[]>([])
  const [notes, setNotes] = useState<TutorAnnotation[]>([])
  const [loading, setLoading] = useState(true)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [annotationType, setAnnotationType] = useState<TutorAnnotationType | ''>('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentRows, noteRows, overview] = await Promise.all([
        listStudents({ term_id: termId }),
        listTutorNotes(undefined, termId),
        getAcademicOverview(undefined, termId),
      ])

      const overviewMap = new Map(overview.map((o) => [o.student_id, o]))
      const enriched = studentRows.map((row) => {
        const ui = studentRecordToUi(row)
        const academic = overviewMap.get(row.id)
        if (academic) {
          const avg = parseScore(academic.average_score)
          ui.average = avg ?? 0
          const total = academic.absence_count + academic.tardy_count
          ui.absences = total > 0 ? Math.min(100, Math.round((total / 20) * 100)) : 0
        }
        return ui
      })

      setStudents(enriched)
      setNotes(noteRows.slice(0, 5))
    } finally {
      setLoading(false)
    }
  }, [termId])

  useEffect(() => {
    load()
  }, [load])

  const courseName = students[0]?.course ?? 'Mi paralelo'
  const criticalAlerts = useMemo(
    () => students.filter((s) => s.risk === 'red' || s.risk === 'purple').length,
    [students]
  )
  const warningAlerts = useMemo(
    () => students.filter((s) => s.risk === 'yellow').length,
    [students]
  )

  const handleSaveNote = async () => {
    if (!studentId || !annotationType || !description.trim()) {
      toast.error('Complete estudiante, tipo y descripción')
      return
    }
    setSaving(true)
    try {
      await createTutorNote({
        student_id: Number(studentId),
        annotation_type: annotationType,
        description: description.trim(),
      })
      toast.success('Anotación registrada')
      setReportModalOpen(false)
      setStudentId('')
      setAnnotationType('')
      setDescription('')
      await load()
    } catch {
      toast.error('No se pudo guardar la anotación')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Cargando paralelo...
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10" aria-hidden />
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Mi Paralelo</h1>
          <p className="text-slate-300 mt-2">
            {courseName} — <span className="font-semibold text-emerald-400">{students.length} estudiantes</span>
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto relative z-10 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/academic')} className="gap-2 flex-1 sm:flex-none rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <BookOpen className="h-4 w-4" />
            Académico
          </Button>
          <Button onClick={() => setReportModalOpen(true)} className="gap-2 flex-1 sm:flex-none rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Plus className="h-4 w-4" />
            Nueva anotación
          </Button>
        </div>
      </div>

      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva anotación</DialogTitle>
            <DialogDescription>
              Registre comportamiento, rendimiento, aspectos emocionales o familiares.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Estudiante</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={annotationType}
                onValueChange={(v) => setAnnotationType(v as TutorAnnotationType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ANNOTATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TUTOR_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describa la observación..."
                className="min-h-32"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNote} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="glass-panel border-emerald-500/30 bg-emerald-500/5 shadow-xl overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300">
          <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Users className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-white">{students.length}</p>
              <p className="text-sm font-medium text-slate-400 mt-1">Total Estudiantes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-red-500/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.1)] overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300 relative group">
          <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-2xl bg-red-500/20 flex items-center justify-center border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-red-400">{criticalAlerts}</p>
              <p className="text-sm font-medium text-red-300/80 mt-1">Requieren Atención</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-orange-500/30 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.1)] overflow-hidden rounded-3xl hover:-translate-y-1 transition-transform duration-300 relative group">
          <div className="absolute inset-0 bg-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5 sm:p-6 flex flex-col justify-between h-full relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-display font-bold text-orange-400">{warningAlerts}</p>
              <p className="text-sm font-medium text-orange-300/80 mt-1">En Observación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <Card className="lg:col-span-2 glass-panel border-white/10 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-black/20 border-b border-white/5 pb-5">
            <CardTitle className="font-display text-xl text-white">Mis Estudiantes</CardTitle>
            <CardDescription className="text-slate-400 mt-1">Estudiantes del paralelo con promedio y estado de riesgo</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <StudentListTable
              students={students}
              showCourseFilter={false}
              maxHeight="420px"
              extraAction={(student) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-white/10 hover:text-emerald-400 text-slate-300 transition-colors h-8 w-8"
                  onClick={() => {
                    setStudentId(student.id)
                    setReportModalOpen(true)
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
            />
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
          <CardHeader className="bg-black/20 border-b border-white/5 pb-5">
            <CardTitle className="font-display text-xl text-white">Anotaciones recientes</CardTitle>
            <CardDescription className="text-slate-400 mt-1">Sus últimos registros</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-5 space-y-4">
            {notes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-6 text-center text-slate-400">Sin anotaciones aún.</div>
            ) : (
              <div className="space-y-3 flex-1">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                    <p className="font-semibold text-white mb-1 truncate">{n.student_name}</p>
                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{n.description}</p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full rounded-full border-white/20 bg-white/5 hover:bg-white/10 text-white mt-auto" onClick={() => navigate('/behavioral')}>
              Ver seguimiento
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
