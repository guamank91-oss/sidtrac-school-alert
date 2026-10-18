import type { RiskLevel } from '@/shared/types/roles'
import type { AlertStatus, AlertType } from './types'

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  academica: 'Académica',
  asistencia: 'Asistencia',
  conductual: 'Conductual',
  emocional: 'Emocional',
  disciplinaria: 'Disciplinaria',
  desercion: 'Deserción',
  combinada: 'Combinada',
}

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  activa: 'Activa',
  atendida: 'Atendida',
  archivada: 'Archivada',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  bajo: 'Bajo',
  medio: 'Medio',
  alto: 'Alto',
  critico: 'Crítico',
}

export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  bajo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medio: 'bg-amber-100 text-amber-700 border-amber-200',
  alto: 'bg-orange-100 text-orange-800 border-orange-200',
  critico: 'bg-red-100 text-red-700 border-red-300',
}

export const RISK_DOT_CLASSES: Record<RiskLevel, string> = {
  bajo: 'bg-emerald-500',
  medio: 'bg-amber-500',
  alto: 'bg-orange-500',
  critico: 'bg-red-600',
}
