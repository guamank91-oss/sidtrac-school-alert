import { ExternalLink } from 'lucide-react'
import {
  buildAttendedAlertsHref,
  buildRagSourceHref,
  buildStudentInterventionsHref,
} from '../sourceLinks'

interface RagSourceLinksProps {
  studentId: number
  sources: string[]
}

export function RagSourceLinks({ studentId, sources }: RagSourceLinksProps) {
  const uniqueSources = sources.filter((source, index, arr) => {
    const label = source.replace(/\s*\([^)]+\)\s*$/, '').trim()
    return arr.findIndex((s) => s.replace(/\s*\([^)]+\)\s*$/, '').trim() === label) === index
  })

  if (uniqueSources.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mt-2 w-full pt-3 border-t border-white/10">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fuentes (abren en nueva pestaña):</span>
      <div className="flex flex-wrap gap-1.5">
        {uniqueSources.map((source) => {
          const href = buildRagSourceHref(studentId, source)
          if (!href) {
            return (
              <span key={source} className="text-xs text-muted-foreground">
                {source}
              </span>
            )
          }
          return (
            <a
              key={source}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs rounded-full border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/10 hover:border-purple-500/30 transition-all text-slate-300 hover:text-white"
            >
              {source.replace(/\s*\([^)]+\)\s*$/, '').trim()}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
            </a>
          )
        })}
        <a
          href={buildStudentInterventionsHref(studentId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 hover:bg-purple-500/20 transition-all text-purple-200"
        >
          Perfil 360 · Intervenciones
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
        <a
          href={buildAttendedAlertsHref(studentId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-white/10 bg-black/20 px-3 py-1.5 hover:bg-white/10 transition-all text-slate-300 hover:text-white"
        >
          Alertas atendidas
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
      </div>
    </div>
  )
}
