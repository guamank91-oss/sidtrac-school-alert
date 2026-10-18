import { CalendarDays } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePeriod } from '@/shared/context/PeriodContext'

export function PeriodSelector() {
  const { terms, selectedTermId, activeTerm, isViewingActiveTerm, loading, setSelectedTermId } =
    usePeriod()

  if (loading || terms.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <Label className="sr-only">Periodo lectivo</Label>
      <Select
        value={selectedTermId ? String(selectedTermId) : undefined}
        onValueChange={(v) => setSelectedTermId(Number(v))}
      >
        <SelectTrigger className="w-[11rem] h-9 text-sm">
          <CalendarDays className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          {terms.map((term) => (
            <SelectItem key={term.id} value={String(term.id)}>
              {term.name}
              {term.is_active ? ' (actual)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isViewingActiveTerm && activeTerm && (
        <span className="text-[10px] text-amber-400 text-right hidden lg:block">
          Periodo histórico
        </span>
      )}
    </div>
  )
}
