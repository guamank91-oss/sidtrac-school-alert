import type { StudentAcademicProfile } from '@/modules/academic/types'
import type { Student } from '@/modules/students/types'

export function buildRecommendations(
  student: Student,
  profile: StudentAcademicProfile | null
): { title: string; text: string; tone: 'rose' | 'amber' | 'emerald' }[] {
  const items: { title: string; text: string; tone: 'rose' | 'amber' | 'emerald' }[] = []
  const firstName = student.firstName

  if (profile?.subject_scores?.length) {
    const sorted = [...profile.subject_scores].sort((a, b) => a.value - b.value)
    const lowest = sorted[0]
    const highest = sorted[sorted.length - 1]
    if (lowest.value < 7) {
      items.push({
        title: `Rendimiento en ${lowest.subject}`,
        text: `${firstName} necesita reforzar ${lowest.subject}. Sugerimos establecer 30 minutos de repaso diario.`,
        tone: 'rose',
      })
    }
    if (highest.value >= 8 && highest.subject !== lowest.subject) {
      items.push({
        title: `Fortaleza en ${highest.subject}`,
        text: `¡Excelente! ${firstName} destaca en ${highest.subject}. Considere fomentar esta fortaleza.`,
        tone: 'emerald',
      })
    }
  }

  if ((profile?.tardy_count ?? 0) >= 2) {
    items.push({
      title: 'Puntualidad',
      text: `Se han registrado ${profile?.tardy_count} tardanzas. Le recomendamos revisar los horarios de descanso.`,
      tone: 'amber',
    })
  }

  if ((profile?.absence_count ?? 0) >= 3) {
    items.push({
      title: 'Asistencia',
      text: `Se registraron ${profile?.absence_count} ausencias. Es importante mantener la regularidad escolar.`,
      tone: 'amber',
    })
  }

  if (items.length === 0) {
    items.push({
      title: 'Seguimiento continuo',
      text: `Mantenga comunicación con el tutor de ${firstName} para apoyar su proceso educativo.`,
      tone: 'emerald',
    })
  }

  return items.slice(0, 4)
}
