import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'dark' | 'light' | 'system'

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(resolved)
  localStorage.setItem('sidtrac-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('sidtrac-theme') as Theme | null
    return stored ?? 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen for system changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    applyTheme(next)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  return { theme, setTheme, toggle, isDark }
}

interface ThemeToggleProps {
  /** 'icon' = just the button icon, 'full' = button + label */
  variant?: 'icon' | 'full'
  className?: string
}

export function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { toggle, isDark } = useTheme()

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
          text-sidebar-foreground/75 hover:bg-white/8 hover:text-sidebar-foreground
          border border-transparent transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60
          ${className}`}
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {isDark ? (
          <Sun className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        ) : (
          <Moon className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden />
        )}
        <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={`relative h-9 w-9 overflow-hidden rounded-xl border border-border/60
        bg-secondary/60 hover:bg-secondary hover:border-border
        transition-all duration-200
        focus-visible:ring-2 focus-visible:ring-ring/60
        ${className}`}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 1 : 0, transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)' }}
      >
        <Sun className="h-4 w-4 text-amber-300" aria-hidden />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: isDark ? 0 : 1, transform: isDark ? 'rotate(-90deg) scale(0.5)' : 'rotate(0deg) scale(1)' }}
      >
        <Moon className="h-4 w-4 text-indigo-500" aria-hidden />
      </span>
    </Button>
  )
}
