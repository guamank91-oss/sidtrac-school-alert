export function parseScore(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatScore(value: number | string | null | undefined): string {
  const n = parseScore(value)
  return n === null ? '—' : n.toFixed(2)
}

export function isLowScore(value: number | string | null | undefined, threshold = 7): boolean {
  const n = parseScore(value)
  return n !== null && n < threshold
}
