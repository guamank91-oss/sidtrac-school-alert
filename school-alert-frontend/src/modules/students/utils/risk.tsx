import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RiskLevelUI } from '@/shared/types/roles'

export function getRiskBadge(risk: RiskLevelUI) {
  switch (risk) {
    case 'green':
      return (
        <Badge className="border-emerald-300 dark:border-emerald-400/30 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-500/25 text-xs px-2.5 py-0.5 font-semibold whitespace-nowrap shadow-xs">
          Estable
        </Badge>
      )
    case 'yellow':
      return (
        <Badge className="border-amber-300 dark:border-amber-400/30 bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-500/25 text-xs px-2.5 py-0.5 font-semibold whitespace-nowrap shadow-xs">
          Observación
        </Badge>
      )
    case 'red':
      return (
        <Badge className="border-orange-300 dark:border-orange-400/30 bg-orange-100 dark:bg-orange-500/20 text-orange-950 dark:text-orange-100 hover:bg-orange-200 dark:hover:bg-orange-500/25 text-xs px-2.5 py-0.5 font-semibold whitespace-nowrap shadow-xs">
          Atención
        </Badge>
      )
    case 'purple':
      return (
        <Badge className="border-red-300 dark:border-red-400/35 bg-red-100 dark:bg-red-500/25 text-red-950 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-500/30 text-xs px-2.5 py-0.5 font-semibold whitespace-nowrap shadow-xs">
          Crítico
        </Badge>
      )
  }
}

export function getRiskIcon(risk: RiskLevelUI) {
  switch (risk) {
    case 'green':
      return <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
    case 'yellow':
      return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
    case 'red':
      return <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
    case 'purple':
      return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
  }
}
