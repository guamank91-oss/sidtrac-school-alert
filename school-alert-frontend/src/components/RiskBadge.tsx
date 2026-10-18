import { cn } from '@/lib/utils'

export type RiskLevel = 'critico' | 'alto' | 'medio' | 'bajo'

const RISK_CONFIG: Record<RiskLevel, {
  label: string
  dot: string
  badge: string
  strip: string
  glow: string
}> = {
  critico: {
    label: 'Crítico',
    dot: 'bg-red-500',
    badge: 'risk-critico border',
    strip: 'risk-strip-critico',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]',
  },
  alto: {
    label: 'Alto',
    dot: 'bg-orange-500',
    badge: 'risk-alto border',
    strip: 'risk-strip-alto',
    glow: 'shadow-[0_0_12px_rgba(249,115,22,0.4)]',
  },
  medio: {
    label: 'Medio',
    dot: 'bg-amber-500',
    badge: 'risk-medio border',
    strip: 'risk-strip-medio',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
  },
  bajo: {
    label: 'Bajo',
    dot: 'bg-green-500',
    badge: 'risk-bajo border',
    strip: 'risk-strip-bajo',
    glow: '',
  },
}

interface RiskBadgeProps {
  level: RiskLevel | string
  /** 'badge' = colored pill, 'dot' = small dot indicator, 'strip' = left border strip only */
  variant?: 'badge' | 'dot' | 'strip'
  /** Show animated pulse for critical alerts */
  pulse?: boolean
  className?: string
}

export function RiskBadge({ level, variant = 'badge', pulse = false, className }: RiskBadgeProps) {
  const key = (level?.toLowerCase() ?? 'bajo') as RiskLevel
  const config = RISK_CONFIG[key] ?? RISK_CONFIG.bajo

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full shrink-0',
          config.dot,
          pulse && key === 'critico' && 'animate-pulse',
          className,
        )}
        aria-label={`Riesgo ${config.label}`}
        role="img"
      />
    )
  }

  if (variant === 'strip') {
    return <div className={cn(config.strip, className)} aria-hidden />
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.badge,
        pulse && key === 'critico' && 'animate-pulse-glow',
        className,
      )}
      aria-label={`Nivel de riesgo: ${config.label}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} aria-hidden />
      {config.label}
    </span>
  )
}

/** Large semaphore indicator for student profile header */
export function RiskSemaphore({ level, className }: { level: RiskLevel | string; className?: string }) {
  const key = (level?.toLowerCase() ?? 'bajo') as RiskLevel
  const config = RISK_CONFIG[key] ?? RISK_CONFIG.bajo

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border px-6 py-4 text-center',
        config.badge,
        key === 'critico' && 'animate-pulse-glow',
        className,
      )}
      role="status"
      aria-label={`Nivel de riesgo actual: ${config.label}`}
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full shadow-lg',
          config.dot,
          key !== 'bajo' && 'animate-pulse',
        )}
        aria-hidden
      />
      <span className="text-sm font-bold uppercase tracking-wider">{config.label}</span>
    </div>
  )
}
