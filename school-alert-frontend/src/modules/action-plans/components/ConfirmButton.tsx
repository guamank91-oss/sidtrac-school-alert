import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmButtonProps {
  triggerLabel?: string
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  onConfirm: () => void | Promise<void>
  className?: string
  children?: ReactNode
  /** Evita que el click del trigger afecte al padre (p. ej. fila seleccionable). */
  stopPropagation?: boolean
}

/** Botón que pide confirmación antes de ejecutar un cambio de estado. */
export function ConfirmButton({
  triggerLabel,
  title,
  description,
  confirmLabel = 'Sí, confirmar',
  cancelLabel = 'Cancelar',
  variant = 'outline',
  size = 'sm',
  disabled,
  onConfirm,
  className,
  children,
  stopPropagation,
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isDestructive = variant === 'destructive'

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={disabled || busy}
        className={className}
        aria-label={triggerLabel || undefined}
        onClick={(e) => {
          if (stopPropagation) {
            e.stopPropagation()
            e.preventDefault()
          }
          setOpen(true)
        }}
      >
        {children ?? triggerLabel}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next)
        }}
      >
        <AlertDialogContent
          className={cn(
            'glass-panel',
            isDestructive ? 'border-red-500/30' : 'border-white/15',
          )}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy}
              className="rounded-xl border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={cn(
                'rounded-xl border-0 text-white',
                isDestructive
                  ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25',
              )}
              onClick={(e) => {
                e.preventDefault()
                if (stopPropagation) e.stopPropagation()
                setBusy(true)
                void Promise.resolve(onConfirm())
                  .then(() => setOpen(false))
                  .catch(() => {
                    /* el caller muestra el error */
                  })
                  .finally(() => setBusy(false))
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
