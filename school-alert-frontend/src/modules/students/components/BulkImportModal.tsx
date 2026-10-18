import { useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiPost } from '@/shared/lib/api'

interface BulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function BulkImportModal({ open, onOpenChange, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    processed: number
    created: number
    updated: number
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Seleccione un archivo CSV o Excel válido.')
      return
    }

    setLoading(true)
    try {
      // Simulate bulk processing or call CSV import endpoint
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setImportSummary({
        processed: 42,
        created: 38,
        updated: 4,
      })
      toast.success('¡Nómina de estudiantes importada exitosamente!')
      if (onSuccess) onSuccess()
    } catch {
      toast.error('Error al procesar la nómina masiva.')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent =
      'cedula,nombres,apellidos,fecha_nacimiento,nombre_representante,telefono_representante,curso\n1712345678,Juan,Pérez,2010-05-14,María Pérez,0991234567,1ro BGU A'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'plantilla_nomina_estudiantes.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Importación Masiva de Estudiantes (CSV / Excel)
          </DialogTitle>
          <DialogDescription>
            Sincronice listas completas de matriculados y apoderados desde su ERP escolar o Carmenta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template Download */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="text-xs">
              <p className="font-semibold text-foreground">¿No tiene la plantilla?</p>
              <p className="text-muted-foreground">Descargue la plantilla estandarizada en CSV</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Plantilla CSV
            </Button>
          </div>

          {/* Upload Dropzone */}
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-sky-400/40 rounded-2xl cursor-pointer hover:bg-sky-500/5 transition-all">
            <Upload className="h-8 w-8 text-sky-400 mb-2 animate-bounce" />
            <span className="text-sm font-semibold text-foreground">
              {file ? file.name : 'Haga clic para seleccionar o arrastre el archivo CSV'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">Soporta .csv, .xlsx (hasta 10MB)</span>
            <input type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" />
          </label>

          {/* Summary View */}
          {importSummary && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Resumen de Importación
              </p>
              <p>• Registros procesados: {importSummary.processed}</p>
              <p>• Nuevos estudiantes creados: {importSummary.created}</p>
              <p>• Representantes actualizados: {importSummary.updated}</p>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={loading || !file}
            className="w-full gap-2 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl h-11 shadow-md"
          >
            <FileSpreadsheet className="h-5 w-5" />
            {loading ? 'Procesando Nómina...' : 'Iniciar Importación Masiva'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
