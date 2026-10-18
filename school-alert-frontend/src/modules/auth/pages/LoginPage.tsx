import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { login } from '../api'
import { setSession } from '../lib/session'
import { BrandLogo } from '@/shared/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await login(username.trim().toLowerCase(), password)
      setSession(data.token.access_token, data.user)
      if (data.user.requires_role_selection) {
        navigate('/select-role')
      } else {
        navigate('/dashboard')
      }
    } catch {
      setError('Credenciales inválidas o error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Background layer */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center transition-transform duration-700"
        style={{ backgroundImage: "url('/login-liquid-glass-bg.png')" }}
        aria-hidden
      />
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,21,47,0.30)_0%,rgba(7,21,47,0.80)_70%,rgba(7,21,47,0.95)_100%)]
          dark:bg-[radial-gradient(ellipse_at_center,rgba(7,21,47,0.30)_0%,rgba(7,21,47,0.80)_70%,rgba(7,21,47,0.95)_100%)]
          light:bg-[radial-gradient(ellipse_at_center,rgba(239,246,255,0.10)_0%,rgba(219,234,254,0.65)_70%,rgba(241,245,249,0.90)_100%)]"
        aria-hidden
      />

      {/* Card container */}
      <div className="animate-slide-up relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/20 shadow-[0_30px_80px_rgba(2,8,23,0.55)] light:border-slate-200/60 light:shadow-[0_20px_60px_rgba(15,23,42,0.15)] lg:grid-cols-[1.1fr_0.9fr]">

        {/* Left panel — hero (hidden on mobile) */}
        <section className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden p-10 lg:flex">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-90"
            style={{ backgroundImage: "url('/login-liquid-glass-bg.png')" }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#07152F]/70 via-[#07152F]/40 to-transparent" />

          <div className="relative animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/10 shadow-[var(--shadow-glass)] backdrop-blur-md">
              <BrandLogo size="lg" className="h-10 w-10" />
            </div>
            <p className="font-display text-xs font-semibold tracking-[0.22em] text-cyan-200/90 uppercase">
              SIDTRAC
            </p>
            <h1 className="font-display mt-3 max-w-sm text-4xl font-semibold leading-tight text-white text-glow">
              Alerta temprana con claridad institucional
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-200/90">
              Acceso seguro para el acompañamiento académico, conductual y psicosocial de estudiantes.
            </p>
          </div>

          {/* Feature pills */}
          <div className="relative animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Motor de Alertas', 'IA RAG', 'DECE', 'RGLOEI'].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden />
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-300/80">
              Sistema Inteligente de Detección Temprana de Riesgo
            </p>
          </div>
        </section>

        {/* Right panel — form */}
        <section className="glass-panel glass-shine relative flex flex-col justify-center p-6 sm:p-10">
          <div className="animate-slide-up relative mb-8 text-center lg:text-left" style={{ animationDelay: '80ms' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-primary/80 shadow-lg lg:mx-0">
              <BrandLogo size="lg" className="h-10 w-10" />
            </div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingrese su usuario y contraseña institucional
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="animate-slide-up relative space-y-5"
            style={{ animationDelay: '160ms' }}
          >
            {error ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2.5 text-sm text-red-300 dark:text-red-200"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="ej. gkevinl"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sky-400/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sky-400/50"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] text-base font-semibold text-white
                shadow-[var(--shadow-primary)] hover:shadow-[var(--shadow-primary-hover)]
                hover:from-[#1d4ed8] hover:to-[#0ea5e9]
                transition-all duration-200 active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              Acceso exclusivo para personal institucional autorizado
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
