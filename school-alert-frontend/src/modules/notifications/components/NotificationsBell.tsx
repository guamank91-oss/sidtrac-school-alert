import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getUser } from '@/modules/auth/lib/session'
import { RISK_BADGE_CLASSES, RISK_DOT_CLASSES, RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import type { RiskLevel } from '@/shared/types/roles'
import {
  listInternalNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InternalNotification,
} from '../api'

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function riskFromTitle(title: string): RiskLevel | null {
  const lower = title.toLowerCase()
  if (lower.includes('crítica') || lower.includes('critica')) return 'critico'
  if (lower.includes('alta')) return 'alto'
  if (lower.includes('media')) return 'medio'
  if (lower.includes('baja') || lower.includes('bajo')) return 'bajo'
  return null
}

function studentNameFromTitle(title: string): string {
  const match = title.match(/:\s*(.+)$/)
  return match?.[1]?.trim() || title
}

function riskLabelFromTitle(title: string, risk: RiskLevel | null): string {
  if (!risk) return 'Alerta'
  const match = title.match(/^Alerta\s+([^:]+):/i)
  if (match?.[1]) return `Alerta ${match[1].trim()}`
  return `Alerta ${RISK_LEVEL_LABELS[risk].toLowerCase()}`
}

function messageLines(message: string): string[] {
  return message
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

export function NotificationsBell() {
  const navigate = useNavigate()
  const role = getUser()?.active_role
  const canOpenAlerts =
    role === 'dece' || role === 'administrador' || role === 'tutor'
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    listInternalNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load, role])

  const unread = notifications.filter((n) => !n.is_read)

  const handleRead = async (notification: InternalNotification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
        )
      } catch {
        // best effort
      }
    }
    setOpen(false)
    if (canOpenAlerts) {
      navigate('/alerts')
    }
  }

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // best effort
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-white/10 rounded-xl" aria-label="Notificaciones">
          <Bell className="h-5 w-5 text-slate-300" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse px-0.5 text-[10px] text-white border border-red-400">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0 glass-panel border border-white/10 shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 bg-black/40 backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-transparent pointer-events-none" />
          <p className="flex items-center gap-2 text-sm font-semibold text-white relative z-10">
            <BellRing className="h-4 w-4 text-sky-400" />
            Notificaciones
            {unread.length > 0 && (
              <span className="rounded-full bg-sky-500/20 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                {unread.length} nuevas
              </span>
            )}
          </p>
          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg relative z-10"
              onClick={handleReadAll}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5 text-sky-400" />
              Marcar todas
            </Button>
          )}
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain bg-black/20">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
              <Bell className="h-8 w-8 text-slate-500 opacity-50" />
              No tienes notificaciones
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((notification) => {
                const risk = riskFromTitle(notification.title)
                const lines = messageLines(notification.message)
                const preview = lines.slice(0, 2)

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => void handleRead(notification)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10 ${
                        notification.is_read ? 'bg-transparent' : 'bg-sky-500/[0.05]'
                      }`}
                    >
                      <span className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                        {!notification.is_read && (
                          <span
                            className={`h-2 w-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] ${
                              risk ? RISK_DOT_CLASSES[risk] : 'bg-sky-400'
                            }`}
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {risk && (
                            <Badge
                              variant="outline"
                              className={`h-5 px-1.5 text-[10px] font-bold ${RISK_BADGE_CLASSES[risk]} border bg-black/20`}
                            >
                              {riskLabelFromTitle(notification.title, risk)}
                            </Badge>
                          )}
                          <span
                            className={`truncate text-sm leading-tight transition-colors ${
                              notification.is_read
                                ? 'font-medium text-slate-400'
                                : 'font-bold text-white group-hover:text-sky-300'
                            }`}
                          >
                            {studentNameFromTitle(notification.title)}
                          </span>
                        </div>
                        {preview.length > 0 && (
                          <ul className="space-y-0.5 mt-1">
                            {preview.map((line) => (
                              <li
                                key={line}
                                className={`truncate text-xs ${notification.is_read ? 'text-slate-500' : 'text-slate-300'}`}
                                title={line}
                              >
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[10px] text-slate-500 font-medium mt-1">
                          {timeAgo(notification.created_at)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {notifications.length > 0 && canOpenAlerts ? (
          <div className="border-t border-white/10 bg-black/40 px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-xl"
              onClick={() => {
                setOpen(false)
                navigate('/alerts')
              }}
            >
              Ver todas las alertas
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
