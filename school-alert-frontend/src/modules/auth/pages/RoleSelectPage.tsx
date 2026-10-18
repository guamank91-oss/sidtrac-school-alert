import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectRole } from '../api'
import { getUser, setSession } from '../lib/session'
import { ChevronRight, Loader2, UserCircle } from 'lucide-react'
import { BrandLogo } from '@/shared/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS, type UserRole } from '@/shared/types/roles'

export function RoleSelectPage() {
  const navigate = useNavigate()
  const user = getUser()
  const [loading, setLoading] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!user || user.roles.length === 0) {
    navigate('/login', { replace: true })
    return null
  }

  if (user.active_role) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleSelect = async (role: UserRole) => {
    setError(null)
    setLoading(role)
    try {
      const data = await selectRole(role)
      setSession(data.token.access_token, data.user)
      navigate('/dashboard')
    } catch {
      setError('No se pudo seleccionar el rol. Intente nuevamente.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-700"
        style={{ backgroundImage: "url('/login-liquid-glass-bg.png')" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,21,47,0.30)_0%,rgba(7,21,47,0.80)_70%,rgba(7,21,47,0.95)_100%)]
          dark:bg-[radial-gradient(ellipse_at_center,rgba(7,21,47,0.30)_0%,rgba(7,21,47,0.80)_70%,rgba(7,21,47,0.95)_100%)]
          light:bg-[radial-gradient(ellipse_at_center,rgba(239,246,255,0.10)_0%,rgba(219,234,254,0.65)_70%,rgba(241,245,249,0.90)_100%)]"
        aria-hidden
      />

      <div className="animate-slide-up glass-panel glass-shine relative z-10 w-full max-w-md rounded-[2rem] p-6 sm:p-10 shadow-[0_30px_80px_rgba(2,8,23,0.55)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-primary/80 shadow-lg">
            <BrandLogo size="lg" className="h-11 w-11" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Seleccione su rol</h1>
          <p className="mt-2 text-sm text-slate-300">
            Hola {user.first_name}, tiene varios roles asignados. ¿Con cuál desea ingresar?
          </p>
        </div>

        <div className="space-y-3 mt-8">
          {error ? (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2.5 text-center text-sm text-red-300">
              {error}
            </div>
          ) : null}
          
          <div className="stagger-children space-y-3">
            {user.roles.map((role) => (
              <Button
                key={role}
                variant="outline"
                className="group relative h-14 w-full justify-between overflow-hidden rounded-xl border-white/20 bg-white/5 px-4 text-white hover:border-sky-400/50 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] transition-all duration-300"
                disabled={loading !== null}
                onClick={() => void handleSelect(role)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sky-400 group-hover:scale-110 group-hover:bg-sky-400/20 transition-all duration-300">
                    {loading === role ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCircle className="h-5 w-5" />}
                  </div>
                  <span className="text-base font-medium tracking-wide">
                    {loading === role ? 'Ingresando...' : ROLE_LABELS[role]}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 opacity-50 transition-all duration-300 group-hover:translate-x-1 group-hover:text-sky-400 group-hover:opacity-100" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
