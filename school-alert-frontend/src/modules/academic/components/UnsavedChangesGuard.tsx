import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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

interface UnsavedChangesDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className="glass-panel border-amber-500/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Hay cambios sin guardar
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Si continúa, se descartarán los registros que aún no ha guardado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-white/10 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white">
            Seguir editando
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-xl border-0 bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            Descartar cambios
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Protege acciones que descartan ediciones locales (cambiar materia, fecha, parcial…).
 * Si hay cambios sin guardar, pide confirmación antes de ejecutar la acción y
 * advierte al cerrar o recargar la pestaña del navegador.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  const guard = useCallback(
    (action: () => void) => {
      if (hasUnsavedChanges) {
        setPendingAction(() => action)
      } else {
        action()
      }
    },
    [hasUnsavedChanges],
  )

  const dialogProps: UnsavedChangesDialogProps = {
    open: pendingAction !== null,
    onCancel: () => setPendingAction(null),
    onConfirm: () => {
      const action = pendingAction
      setPendingAction(null)
      action?.()
    },
  }

  return { guard, dialogProps }
}
