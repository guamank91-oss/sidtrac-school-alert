import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { RoleSelectPage } from '@/modules/auth/pages/RoleSelectPage'
import {
  getToken,
  getUser,
  hasActiveRole,
  isAdmin,
  canViewStudents,
  canViewAcademic,
  canViewBehavioral,
  canViewAlerts,
  canUseRag,
  canViewReports,
} from '@/modules/auth/lib/session'
import { AlertsPage } from '@/modules/alerts/pages/AlertsPage'
import { BehavioralPage } from '@/modules/behavioral/pages/BehavioralPage'
import { RagPage } from '@/modules/rag/pages/RagPage'
import { ReportsPage } from '@/modules/reports/pages/ReportsPage'
import { AcademicPage } from '@/modules/academic/pages/AcademicPage'
import { StudentsPage } from '@/modules/students/pages/StudentsPage'
import { DashboardPage } from '@/modules/dashboard/pages/DashboardPage'
import { SettingsPage } from '@/modules/institution/pages/SettingsPage'
import { UsersPage } from '@/modules/users/pages/UsersPage'
import { SuperAdminPage } from '@/modules/superadmin/pages/SuperAdminPage'
import { RectorDashboard } from '@/modules/dashboard/components/RectorDashboard'
import { AppLayout } from '@/modules/dashboard/components/AppLayout'
import { Toaster } from '@/components/ui/sonner'
import { useLocation } from 'react-router-dom'

/** Wraps page content with a fade+slide-up animation on route change */
function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter contents">
      {children}
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleRoute({ children }: { children: React.ReactNode }) {
  const user = getUser()
  if (!getToken()) return <Navigate to="/login" replace />
  if (user && !hasActiveRole()) return <Navigate to="/select-role" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function StudentsRoute({ children }: { children: React.ReactNode }) {
  if (!canViewStudents()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AcademicRoute({ children }: { children: React.ReactNode }) {
  if (!canViewAcademic()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function BehavioralRoute({ children }: { children: React.ReactNode }) {
  if (!canViewBehavioral()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AlertsRoute({ children }: { children: React.ReactNode }) {
  if (!canViewAlerts()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function RagRoute({ children }: { children: React.ReactNode }) {
  if (!canUseRag()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function ReportsRoute({ children }: { children: React.ReactNode }) {
  if (!canViewReports()) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function LayoutRoute({ children }: { children: React.ReactNode }) {
  return (
    <RoleRoute>
      <AppLayout>
        <PageTransition>{children}</PageTransition>
      </AppLayout>
    </RoleRoute>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/select-role"
          element={
            <PrivateRoute>
              <RoleSelectPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <LayoutRoute>
              <DashboardPage />
            </LayoutRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <LayoutRoute>
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/superadmin"
          element={
            <LayoutRoute>
              <AdminRoute>
                <SuperAdminPage />
              </AdminRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/rector"
          element={
            <LayoutRoute>
              <AdminRoute>
                <RectorDashboard />
              </AdminRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/users"
          element={
            <LayoutRoute>
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/students"
          element={
            <LayoutRoute>
              <StudentsRoute>
                <StudentsPage />
              </StudentsRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/academic"
          element={
            <LayoutRoute>
              <AcademicRoute>
                <AcademicPage />
              </AcademicRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/behavioral"
          element={
            <LayoutRoute>
              <BehavioralRoute>
                <BehavioralPage />
              </BehavioralRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <LayoutRoute>
              <AlertsRoute>
                <AlertsPage />
              </AlertsRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/rag"
          element={
            <LayoutRoute>
              <RagRoute>
                <RagPage />
              </RagRoute>
            </LayoutRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <LayoutRoute>
              <ReportsRoute>
                <ReportsPage />
              </ReportsRoute>
            </LayoutRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
