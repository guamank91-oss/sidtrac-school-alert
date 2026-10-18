import { useRef, useState } from 'react'
import { CheckCircle2, Eraser, FileCheck, ShieldCheck, PenTool } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/shared/lib/api'

interface DigitalSignatureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: number
  roleName?: string
  onSignedSuccess?: () => void
}

export function DigitalSignatureModal({
  open,
  onOpenChange,
  planId,
  roleName = 'DECE',
  onSignedSuccess,
}: DigitalSignatureModalProps) {
  const [signerName, setSignerName] = useState('')
  const [signerId, setSignerId] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSaveSignature = async () => {
    if (!signerName.trim() || !signerId.trim()) {
      toast.error('Complete su Nombre Completo y Cédula de Identidad.')
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')

    setLoading(true)
    try {
      await apiPost(`/action-plans/${planId}/signatures`, {
        signer_role: roleName.toLowerCase(),
        signer_name: signerName.trim(),
        signer_national_id: signerId.trim(),
        signature_data: dataUrl,
        signature_type: 'digital_draw',
      })
      toast.success('Firma Digital y Sello Legal registrados correctamente.')
      if (onSignedSuccess) onSignedSuccess()
      onOpenChange(false)
    } catch {
      toast.error('No se pudo registrar la firma digital.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Firma Digital y Trazabilidad Legal de Plan (PDF)
          </DialogTitle>
          <DialogDescription>
            Registre la firma holográfica digital como respaldos legales bajo la normativa del RGLOEI del Ecuador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre Completo del Firmante</Label>
              <Input
                placeholder="Ej. Dr. Carlos Mendoza"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cédula / Pasaporte</Label>
              <Input
                placeholder="Ej. 1712345678"
                value={signerId}
                onChange={(e) => setSignerId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <PenTool className="h-3.5 w-3.5 text-sky-400" /> Trazo de Firma Digital
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="h-6 text-xs gap-1">
                <Eraser className="h-3 w-3" /> Limpiar Trazo
              </Button>
            </div>
            <div className="border border-border/80 rounded-xl overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                width={460}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full cursor-crosshair touch-none"
              />
            </div>
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 flex items-start gap-2">
            <FileCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              La firma quedará estampada en el PDF oficial con sellado de tiempo UTC e IP de auditoría institucional.
            </span>
          </div>

          <Button
            onClick={handleSaveSignature}
            disabled={loading}
            className="w-full gap-2 font-bold shadow-md bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl h-11"
          >
            <CheckCircle2 className="h-5 w-5" />
            {loading ? 'Registrando Sello Digital...' : 'Estampar Firma Digital en Plan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
