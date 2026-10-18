import { useEffect, useState } from 'react'

const FALLBACK = {
  primary: '#2563eb',
  accent: '#38bdf8',
  chart2: '#22c55e',
  border: 'rgba(255, 255, 255, 0.22)',
  muted: '#cbd5e1',
  riskGreen: '#22c55e',
  riskYellow: '#f59e0b',
  riskRed: '#ef4444',
}

export type ChartThemeColors = typeof FALLBACK

export function useChartTheme(): ChartThemeColors {
  const [colors, setColors] = useState(FALLBACK)

  useEffect(() => {
    const root = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      root.getPropertyValue(name).trim() || fallback

    setColors({
      primary: read('--lg-electric', FALLBACK.primary),
      accent: read('--lg-sky', FALLBACK.accent),
      chart2: read('--chart-2', FALLBACK.chart2),
      border: read('--border', FALLBACK.border),
      muted: read('--muted-foreground', FALLBACK.muted),
      riskGreen: read('--risk-green', FALLBACK.riskGreen),
      riskYellow: read('--risk-yellow', FALLBACK.riskYellow),
      riskRed: read('--risk-red', FALLBACK.riskRed),
    })
  }, [])

  return colors
}

export function scoreTier(value: number): 'high' | 'mid' | 'low' {
  if (value < 5) return 'low'
  if (value < 7) return 'mid'
  return 'high'
}

export function scoreTierColor(value: number, colors: ChartThemeColors): string {
  const tier = scoreTier(value)
  if (tier === 'low') return colors.riskRed
  if (tier === 'mid') return colors.riskYellow
  return colors.riskGreen
}
