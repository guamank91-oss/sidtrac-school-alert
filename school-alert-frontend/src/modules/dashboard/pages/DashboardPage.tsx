import { getUser } from '@/modules/auth/lib/session'
import { DeceDashboard } from '../components/DeceDashboard'
import { GuardianDashboard } from '../components/GuardianDashboard'
import { TeacherDashboard } from '../components/TeacherDashboard'
import { TutorDashboard } from '../components/TutorDashboard'

export function DashboardPage() {
  const role = getUser()?.active_role ?? 'dece'

  const renderView = () => {
    switch (role) {
      case 'tutor':
        return <TutorDashboard />
      case 'representante':
        return <GuardianDashboard />
      case 'docente':
        return <TeacherDashboard />
      case 'dece':
      case 'administrador':
      default:
        return <DeceDashboard />
    }
  }

  return <>{renderView()}</>
}
