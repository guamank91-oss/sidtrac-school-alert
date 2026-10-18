import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Assignment } from '../types'

interface AssignmentPickerProps {
  assignments: Assignment[]
  value: string
  onChange: (value: string) => void
  editableOnly?: boolean
  disabled?: boolean
}

export function AssignmentPicker({
  assignments,
  value,
  onChange,
  editableOnly = false,
  disabled = false,
}: AssignmentPickerProps) {
  const options = editableOnly ? assignments.filter((a) => a.can_edit) : assignments

  if (options.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Materia y curso
        </Label>
        <p className="text-sm text-slate-400">No hay asignaciones disponibles para su rol.</p>
      </div>
    )
  }

  const selectedOption = options.find((a) => String(a.id) === value)

  const formatLabel = (a: Assignment, compact = false) => {
    const base = `${a.course_name} — ${a.subject_name}`
    if (editableOnly || a.can_edit || compact) return base
    return `${base} (${a.teacher_name})`
  }

  return (
    <div className="w-full min-w-0 space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Materia y curso
      </Label>
      <Select value={selectedOption ? value : undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-black/20 text-white">
          <SelectValue placeholder="Seleccione una asignación">
            {selectedOption ? formatLabel(selectedOption, true) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
          {options.map((a) => (
            <SelectItem key={a.id} value={String(a.id)} className="whitespace-normal">
              <span className="line-clamp-2">{formatLabel(a)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
