import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, Pencil, Plus, Trash2, FileSignature } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { canCreateTutorNote, canEditTutorNote } from '@/modules/auth/lib/session'
import { getApiErrorMessage } from '@/shared/lib/api'
import { StudentSearchCombobox } from '@/modules/students/components/StudentSearchCombobox'
import { listStudents } from '@/modules/students/api'
import { studentRecordToUi } from '@/modules/students/utils/mapStudentRecord'
import type { Student } from '@/modules/students/types'
import {
  createTutorNote,
  deleteTutorNote,
  listTutorNotes,
  updateTutorNote,
} from '../api'
import { usePeriod, useTermId } from '@/shared/context/PeriodContext'
import { BehavioralRecordDetailDialog } from './BehavioralRecordDetailDialog'
import { TUTOR_TYPE_LABELS } from '../labels'
import type { TutorAnnotation, TutorAnnotationType } from '../types'

const ANNOTATION_TYPES = Object.keys(TUTOR_TYPE_LABELS) as TutorAnnotationType[]

const TYPE_COLORS: Record<string, string> = {
  academica: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  comportamiento: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  emocional: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  familiar: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  salud: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  otra: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
}

const TYPE_BORDER: Record<string, string> = {
  academica: 'from-blue-500',
  comportamiento: 'from-amber-500',
  emocional: 'from-purple-500',
  familiar: 'from-emerald-500',
  salud: 'from-rose-500',
  otra: 'from-slate-500',
}

interface TutorNotePanelProps {
  initialStudentFilter?: string
  highlightNoteId?: number
}

export function TutorNotePanel({
  initialStudentFilter,
  highlightNoteId,
}: TutorNotePanelProps = {}) {
  const termId = useTermId()
  const { isViewingActiveTerm } = usePeriod()
  const canCreate = canCreateTutorNote() && isViewingActiveTerm
  const canEdit = canEditTutorNote() && isViewingActiveTerm
  const [students, setStudents] = useState<Student[]>([])
  const [notes, setNotes] = useState<TutorAnnotation[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [detailNote, setDetailNote] = useState<TutorAnnotation | null>(null)
  const [editingNote, setEditingNote] = useState<TutorAnnotation | null>(null)
  const [deletingNote, setDeletingNote] = useState<TutorAnnotation | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [studentId, setStudentId] = useState('')
  const [annotationType, setAnnotationType] = useState<TutorAnnotationType | ''>('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [filterStudent, setFilterStudent] = useState('all')

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      setNotes(
        await listTutorNotes(
          filterStudent !== 'all' ? Number(filterStudent) : undefined,
          termId
        )
      )
    } catch {
      toast.error('No se pudieron cargar las anotaciones')
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
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (initialStudentFilter) {
      setFilterStudent(initialStudentFilter)
    }
  }, [initialStudentFilter])

  useEffect(() => {
    if (!highlightNoteId || loading) return
    const el = document.getElementById(`tutor-note-${highlightNoteId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightNoteId, loading, notes])

  const openForm = () => {
    setEditingNote(null)
    setStudentId(filterStudent !== 'all' ? filterStudent : '')
    setAnnotationType('')
    setDescription('')
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (note: TutorAnnotation) => {
    setEditingNote(note)
    setStudentId(String(note.student_id))
    setAnnotationType(note.annotation_type)
    setDescription(note.description)
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!studentId || !annotationType || !description.trim()) {
      setFormError('Complete estudiante, tipo y descripción')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editingNote) {
        await updateTutorNote(editingNote.id, {
          annotation_type: annotationType,
          description: description.trim(),
        })
        toast.success('Anotación actualizada')
      } else {
        await createTutorNote({
          student_id: Number(studentId),
          annotation_type: annotationType,
          description: description.trim(),
        })
        toast.success('Anotación registrada')
      }
      setFormOpen(false)
      await loadNotes()
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'No se pudo guardar la anotación'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingNote) return
    setDeleting(true)
    try {
      await deleteTutorNote(deletingNote.id)
      toast.success('Anotación eliminada')
      setDeletingNote(null)
      await loadNotes()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar la anotación'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="glass-panel border-white/10 shadow-xl overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-4 bg-black/20 border-b border-white/10">
          <div>
            <CardTitle className="text-lg font-display text-white">Anotaciones de tutor</CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Observaciones del paralelo — comportamiento, rendimiento, emocional
            </CardDescription>
          </div>
          {canCreate && (
            <Button className="gap-2 shrink-0 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 border-0 rounded-xl" onClick={openForm}>
              <Plus className="h-4 w-4" />
              Nueva anotación
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Filtrar por estudiante</Label>
            <StudentSearchCombobox
              students={students}
              value={filterStudent}
              onValueChange={setFilterStudent}
              placeholder="Todos los estudiantes"
              className="sm:max-w-md bg-white/5 border-white/10 text-white"
              allOption={{ value: 'all', label: 'Todos los estudiantes' }}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-slate-500/10 flex items-center justify-center border border-slate-500/20">
                <FileSignature className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Sin anotaciones registradas</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Las observaciones del tutor aparecerán aquí.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n, idx) => (
                <div
                  key={n.id}
                  id={`tutor-note-${n.id}`}
                  className={`rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group relative overflow-hidden animate-slide-up ${
                    highlightNoteId === n.id 
                      ? 'border-sky-500/50 bg-sky-500/10 ring-2 ring-sky-500/20 shadow-[0_0_20px_rgba(14,165,233,0.2)]' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-gradient-to-b to-transparent opacity-70 ${TYPE_BORDER[n.annotation_type] ?? 'from-slate-500'}`} 
                  />
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-lg text-white group-hover:text-sky-300 transition-colors">{n.student_name}</span>
                      <Badge variant="outline" className={`border text-[10px] uppercase font-bold ${TYPE_COLORS[n.annotation_type] ?? TYPE_COLORS.otra}`}>
                        {TUTOR_TYPE_LABELS[n.annotation_type]}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 rounded-xl bg-black/20 hover:bg-white/10 text-slate-300 hover:text-white"
                        onClick={() => setDetailNote(n)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl bg-black/20 hover:bg-white/10 text-slate-300 hover:text-white"
                            onClick={() => openEdit(n)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                            onClick={() => setDeletingNote(n)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 pl-2 line-clamp-2 text-sm text-slate-300 leading-relaxed">{n.description}</p>
                  <div className="mt-4 pl-2 flex items-center gap-2 text-xs font-medium text-slate-400 border-t border-white/5 pt-3">
                    <span>{new Date(n.annotated_at).toLocaleDateString('es-EC')}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>{n.author_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass-panel max-w-lg border-white/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingNote ? 'Editar anotación de tutor' : 'Nueva anotación de tutor'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">Registro rápido desde el aula o tutoría</DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Estudiante</Label>
              <StudentSearchCombobox
                students={students}
                value={studentId}
                onValueChange={setStudentId}
                disabled={editingNote !== null}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo</Label>
              <Select
                value={annotationType}
                onValueChange={(v) => setAnnotationType(v as TutorAnnotationType)}
              >
                <SelectTrigger className="w-full bg-black/20 border-white/10 text-white focus:ring-sky-500/50">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="glass-panel border-white/10 text-white">
                  {ANNOTATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="focus:bg-white/10">
                      {TUTOR_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 bg-black/20 border-white/10 text-white focus-visible:ring-sky-500/50 placeholder:text-slate-500"
                placeholder="Detalle la observación..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} className="text-slate-300 hover:text-white hover:bg-white/10 rounded-xl">
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving} className="gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white border-0 shadow-lg shadow-sky-500/25">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingNote ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BehavioralRecordDetailDialog
        kind="tutor"
        tutorNote={detailNote}
        open={detailNote !== null}
        onOpenChange={(open) => !open && setDetailNote(null)}
      />

      <AlertDialog open={deletingNote !== null} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent className="glass-panel border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar anotación?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción no se puede deshacer. Se eliminará la anotación
              {deletingNote ? ` de ${deletingNote.student_name}` : ''} y su registro asociado.
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
