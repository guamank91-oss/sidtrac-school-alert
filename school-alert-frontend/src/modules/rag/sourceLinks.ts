/** Parse backend source label: "Reporte DECE (reporte_dece:2)" */
export function parseRagSource(source: string): { kind: string; id: number } | null {
  const match = source.match(/\(([a-z_]+):(\d+)\)\s*$/)
  if (!match) return null
  return { kind: match[1], id: Number(match[2]) }
}

/** Build in-app path for opening the source record in a new browser tab. */
export function buildRagSourceHref(studentId: number, source: string): string | null {
  const parsed = parseRagSource(source)
  if (!parsed) return null

  const params = new URLSearchParams()
  if (parsed.kind === 'reporte_dece') {
    params.set('tab', 'dece')
    params.set('student', String(studentId))
    params.set('report', String(parsed.id))
    return `/behavioral?${params.toString()}`
  }
  if (parsed.kind === 'anotacion_tutor') {
    params.set('tab', 'tutor')
    params.set('student', String(studentId))
    params.set('note', String(parsed.id))
    return `/behavioral?${params.toString()}`
  }
  if (parsed.kind === 'reporte_disciplinario') {
    params.set('tab', 'disciplinary')
    params.set('student', String(studentId))
    params.set('report', String(parsed.id))
    return `/behavioral?${params.toString()}`
  }
  return null
}

export function buildStudentInterventionsHref(studentId: number): string {
  const params = new URLSearchParams({
    student: String(studentId),
    profile: '1',
    tab: 'interventions',
  })
  return `/students?${params.toString()}`
}

export function buildAttendedAlertsHref(studentId: number): string {
  const params = new URLSearchParams({
    status: 'atendida',
    student: String(studentId),
  })
  return `/alerts?${params.toString()}`
}
