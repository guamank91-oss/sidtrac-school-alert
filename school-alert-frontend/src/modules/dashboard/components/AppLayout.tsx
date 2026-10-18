import { useState } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  GraduationCap,
  Home,
  KeyRound,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  clearSession,
  getUser,
  isAdmin,
  canViewStudents,
  canViewAcademic,
  canViewBehavioral,
  canViewAlerts,
  canUseRag,
  canViewReports,
} from '@/modules/auth/lib/session'
import { NotificationsBell } from '@/modules/notifications/components/NotificationsBell'
import { ChangePasswordDialog } from '@/modules/auth/components/ChangePasswordDialog'
import { PeriodProvider } from '@/shared/context/PeriodContext'
import { PeriodSelector } from '@/shared/components/PeriodSelector'
import { BrandLogo } from '@/shared/components/BrandLogo'
import type { UserRole } from '@/shared/types/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ROLE_LABELS } from '@/shared/types/roles'

interface AppLayoutProps {
  children: React.ReactNode
  criticalAlerts?: number
}

export function AppLayout({ children, criticalAlerts = 0 }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = getUser()

  const navItems = [
    { icon: Home, label: 'Inicio', path: '/dashboard', adminOnly: false, roles: null as UserRole[] | null },
    { icon: BookOpen, label: 'Académico', path: '/academic', adminOnly: false, roles: ['administrador', 'dece', 'tutor', 'docente'] as UserRole[] },
    { icon: Users, label: 'Estudiantes', path: '/students', adminOnly: false, roles: ['administrador', 'dece', 'tutor'] as UserRole[] },
    {
      icon: FileText,
      label: 'Seguimiento',
      path: '/behavioral',
      adminOnly: false,
      roles: ['administrador', 'dece', 'tutor'] as UserRole[],
    },
    {
      icon: AlertTriangle,
      label: 'Alertas',
      path: '/alerts',
      adminOnly: false,
      roles: ['administrador', 'dece', 'tutor'] as UserRole[],
    },
    {
      icon: Sparkles,
      label: 'Consulta IA',
      path: '/rag',
      adminOnly: false,
      roles: ['administrador', 'dece'] as UserRole[],
    },
    {
      icon: BarChart3,
      label: 'Reportes',
      path: '/reports',
      adminOnly: false,
      roles: ['administrador', 'dece'] as UserRole[],
    },
    { icon: Flame, label: 'Panel Directivo', path: '/rector', adminOnly: true, roles: null },
    { icon: GraduationCap, label: 'Personal', path: '/users', adminOnly: true, roles: null },
    { icon: Building2, label: 'SuperAdmin', path: '/superadmin', adminOnly: true, roles: null },
    { icon: Settings, label: 'Configuración', path: '/settings', adminOnly: true, roles: null },
  ].filter((item) => {
    if (item.adminOnly && !isAdmin()) return false
    if (item.roles && !item.roles.includes(user?.active_role as UserRole)) return false
    if (item.path === '/students' && !canViewStudents()) return false
    if (item.path === '/academic' && !canViewAcademic()) return false
    if (item.path === '/behavioral' && !canViewBehavioral()) return false
    if (item.path === '/alerts' && !canViewAlerts()) return false
    if (item.path === '/rag' && !canUseRag()) return false
    if (item.path === '/reports' && !canViewReports()) return false
    return true
  })

  const handleLogout = () => {
    clearSession()
    navigate('/login')
  }

  const goTo = (path: string) => {
    navigate(path)
    setMobileNavOpen(false)
  }

  const initials = user
    ? `${user.first_name?.trim().charAt(0) ?? ''}${user.last_name?.trim().charAt(0) ?? ''}`.toUpperCase() ||
      'US'
    : 'US'

  const NavList = ({ compact = false }: { compact?: boolean }) => (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const active = location.pathname === item.path
        return (
          <li key={item.path + item.label}>
            <button
              type="button"
              onClick={() => goTo(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                active
                  ? 'bg-gradient-to-r from-sky-500/10 to-transparent text-sky-400 border border-sky-400/20 shadow-[inset_4px_0_0_rgba(56,189,248,0.5)]'
                  : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10'
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              {!compact && <span className="text-sm font-medium">{item.label}</span>}
              {!compact && item.path === '/alerts' && criticalAlerts > 0 ? (
                <span className="ml-auto rounded-md bg-destructive/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {criticalAlerts}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <PeriodProvider>
      <div className="app-shell-bg relative flex h-screen overflow-hidden">
        <aside
          className={`${
            sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
          } glass-panel m-4 md:mr-0 rounded-2xl relative z-20 hidden md:flex flex-col transition-all duration-300 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]`}
        >
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-primary/80 shadow-lg shrink-0">
              <BrandLogo size="md" className="h-7 w-7" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-display font-semibold text-sm tracking-wide">SIDTRAC</span>
                <span className="text-xs text-slate-300 truncate">Alerta Temprana</span>
              </div>
            )}
          </div>

          <nav className="flex-1 p-3 overflow-y-auto" aria-label="Navegación principal">
            <NavList compact={sidebarCollapsed} />
          </nav>

          <div className="p-3 border-t border-white/10 space-y-1">
            {/* Theme toggle - full label when expanded, icon when collapsed */}
            {!sidebarCollapsed ? (
              <ThemeToggle variant="full" />
            ) : (
              <div className="flex justify-center">
                <ThemeToggle variant="icon" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              {!sidebarCollapsed && <span className="text-sm">Colapsar</span>}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span className="text-sm">Salir</span>}
            </button>
          </div>
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="glass-panel w-[min(100%,18rem)] border-r border-white/20 p-0 sm:max-w-xs"
          >
            <SheetHeader className="border-b border-white/10 p-4 text-left">
              <SheetTitle className="flex items-center gap-3 font-display">
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-primary/80">
                  <BrandLogo size="sm" className="h-6 w-6" />
                </span>
                SIDTRAC
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación móvil">
              <NavList />
            </nav>
            <div className="mt-auto border-t border-white/10 p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-white/8 hover:text-white transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm">Salir</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="h-[68px] mx-4 mt-4 mb-2 glass-panel border border-white/10 rounded-2xl flex items-center justify-between gap-3 px-4 lg:px-6 shadow-lg backdrop-blur-2xl">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="relative hidden sm:block group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-sky-400 transition-colors" />
                <Input
                  placeholder="Buscar estudiante..."
                  className="pl-9 w-48 lg:w-72 border-white/10 bg-black/20 hover:bg-black/30 focus:bg-black/40 rounded-xl transition-all shadow-inner focus-visible:ring-sky-400/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <PeriodSelector />
              <NotificationsBell />
              <ThemeToggle variant="icon" />

              <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-border/40">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {user ? `${user.first_name} ${user.last_name}` : 'Usuario'}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {user?.active_role ? ROLE_LABELS[user.active_role] : ''}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-xl outline-none ring-offset-2 ring-offset-[#07152F] transition focus-visible:ring-2 focus-visible:ring-sky-400 hover:scale-105 active:scale-95"
                      aria-label="Menú de usuario"
                    >
                      <Avatar className="h-10 w-10 rounded-xl border border-white/20 shadow-md">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white font-semibold rounded-xl">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {user ? `${user.first_name} ${user.last_name}` : 'Usuario'}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {user?.active_role ? ROLE_LABELS[user.active_role] : ''}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setChangePwOpen(true)}>
                      <KeyRound className="h-4 w-4" />
                      Cambiar contraseña
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={handleLogout}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Salir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4 pb-4 pt-2 lg:px-6">{children}</main>
        </div>

        <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      </div>
    </PeriodProvider>
  )
}
