import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Student } from '../types'

interface StudentSearchComboboxProps {
  students: Student[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  /** e.g. filter "Todos los estudiantes" */
  allOption?: { value: string; label: string }
}

export function StudentSearchCombobox({
  students,
  value,
  onValueChange,
  placeholder = 'Buscar estudiante...',
  searchPlaceholder = 'Escriba nombre o curso...',
  className,
  disabled,
  allOption,
}: StudentSearchComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = students.find((s) => s.id === value)
  const allSelected = allOption && value === allOption.value
  const displayLabel = allSelected
    ? allOption.label
    : selected
      ? `${selected.displayName} — ${selected.course}`
      : placeholder

  const pick = (next: string) => {
    onValueChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate text-left">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No se encontró el estudiante.</CommandEmpty>
            {allOption && (
              <CommandGroup>
                <CommandItem value={allOption.label} onSelect={() => pick(allOption.value)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', allSelected ? 'opacity-100' : 'opacity-0')}
                  />
                  {allOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Estudiantes">
              {students.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.displayName} ${s.course} ${s.firstName} ${s.lastName}`}
                  onSelect={() => pick(s.id)}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">
                    {s.displayName} — {s.course}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
