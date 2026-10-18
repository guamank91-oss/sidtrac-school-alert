import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StudentProfileDialog } from '@/modules/students/components/StudentProfileDialog'
import { getRiskBadge } from '@/modules/students/utils/risk'
import type { Student } from '@/modules/students/types'
import type { RiskLevelUI } from '@/shared/types/roles'

interface StudentListTableProps {
  students: Student[]
  extraAction?: (student: Student) => React.ReactNode
  maxHeight?: string
  showCourseFilter?: boolean
}

const RISK_OPTIONS: { value: RiskLevelUI | 'all'; label: string }[] = [
  { value: 'all',    label: 'Todos los estados' },
  { value: 'green',  label: '🟢 Estable' },
  { value: 'yellow', label: '🟡 En observación' },
  { value: 'red',    label: '🔴 Requiere atención' },
  { value: 'purple', label: '🟣 Crítico' },
]

const AVATAR_COLORS: Record<string, string> = {
  purple: 'bg-violet-500/25 text-violet-300 border border-violet-500/30',
  red:    'bg-rose-500/25 text-rose-300 border border-rose-500/30',
  yellow: 'bg-amber-500/25 text-amber-300 border border-amber-500/30',
  green:  'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30',
}

const RISK_ROW_TINT: Record<string, string> = {
  purple: 'hover:bg-violet-500/5',
  red:    'hover:bg-rose-500/5',
  yellow: 'hover:bg-amber-500/5',
  green:  'hover:bg-white/5',
}

export function StudentListTable({
  students,
  extraAction,
  maxHeight = '420px',
  showCourseFilter = true,
}: StudentListTableProps) {
  const [search, setSearch]           = useState('')
  const [riskFilter, setRiskFilter]   = useState<RiskLevelUI | 'all'>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')

  const courses = useMemo(() => {
    const names = Array.from(new Set(students.map((s) => s.course).filter(Boolean)))
    return names.sort()
  }, [students])

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        search.trim() === '' ||
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (s.nationalId ?? '').includes(search)
      const matchRisk   = riskFilter === 'all'   || s.risk   === riskFilter
      const matchCourse = courseFilter === 'all' || s.course === courseFilter
      return matchSearch && matchRisk && matchCourse
    })
  }, [students, search, riskFilter, courseFilter])

  const hasFilters = search !== '' || riskFilter !== 'all' || courseFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setRiskFilter('all')
    setCourseFilter('all')
  }

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white/5 border-white/10 rounded-xl text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 focus-visible:border-sky-500/40"
          />
        </div>

        {/* Risk filter */}
        <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskLevelUI | 'all')}>
          <SelectTrigger className="h-9 w-full sm:w-48 text-sm gap-1.5 bg-white/5 border-white/10 rounded-xl text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <SelectValue placeholder="Estado de riesgo" />
          </SelectTrigger>
          <SelectContent>
            {RISK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Course filter */}
        {showCourseFilter && courses.length > 0 && (
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm bg-white/5 border-white/10 rounded-xl text-slate-300">
              <SelectValue placeholder="Curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-2.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl border border-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Result count ── */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
        <span>
          {filtered.length === students.length
            ? `${students.length} estudiante${students.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${students.length} estudiantes`}
        </span>
        {hasFilters && (
          <Badge variant="secondary" className="text-[10px] py-0 bg-sky-500/20 text-sky-300 border border-sky-500/30">
            Filtros activos
          </Badge>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {/* Fixed header */}
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '34%' }} />
            <col className="hidden md:table-column" style={{ width: '18%' }} />
            <col className="hidden sm:table-column" style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-white/8 bg-black/30">
              <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Estudiante
              </th>
              <th className="text-left py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                Curso
              </th>
              <th className="text-center py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                Promedio
              </th>
              <th className="text-center py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="text-right py-3 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
        </table>

        {/* Scrollable body */}
        <div className="overflow-y-auto" style={{ maxHeight }}>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '34%' }} />
              <col className="hidden md:table-column" style={{ width: '18%' }} />
              <col className="hidden sm:table-column" style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                        <Search className="h-6 w-6 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium">Sin resultados</p>
                        <p className="text-xs text-slate-600 mt-1">Intenta con otros filtros</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-sky-400 hover:text-sky-300 text-xs h-7">
                        Limpiar filtros
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr
                    key={student.id}
                    className={`border-b border-white/5 transition-colors duration-150 group ${RISK_ROW_TINT[student.risk] ?? 'hover:bg-white/5'}`}
                  >
                    {/* Student */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${AVATAR_COLORS[student.risk] ?? AVATAR_COLORS.green}`}>
                          {student.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate text-sm leading-tight group-hover:text-sky-300 transition-colors">
                            {student.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 md:hidden truncate">{student.course}</p>
                        </div>
                      </div>
                    </td>

                    {/* Course */}
                    <td className="py-3 px-4 text-sm text-slate-400 hidden md:table-cell truncate">
                      {student.course}
                    </td>

                    {/* Average */}
                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                      <span className={`text-sm font-bold tabular-nums ${
                        student.average > 0 && student.average < 7
                          ? 'text-rose-400'
                          : student.average > 0 ? 'text-white' : 'text-slate-600'
                      }`}>
                        {student.average > 0 ? student.average.toFixed(1) : '—'}
                      </span>
                    </td>

                    {/* Risk badge */}
                    <td className="py-3 px-2">
                      <div className="flex justify-center items-center">
                        {getRiskBadge(student.risk)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <StudentProfileDialog student={student} />
                        {extraAction?.(student)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
