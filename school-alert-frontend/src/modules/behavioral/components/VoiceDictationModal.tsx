import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Eraser,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Wand2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/shared/lib/api'

interface DictationResult {
  resumen_hallazgos: string
  nivel_riesgo_sugerido: string
  objetivo_plan_accion: string
  compromisos_sugeridos: Array<{
    titulo: string
    descripcion: string
    responsable: string
  }>
}

interface VoiceDictationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyPlan?: (data: DictationResult) => void
}

const TEMPLATES = [
  {
    label: '📚 Conducta y Clima de Aula',
    text: 'Se realiza entrevista individual al estudiante por reiteradas interrupciones y desatención en clase. Refiere desmotivación y cansancio acumulado. Se acuerda compromiso de autorregulación y reporte del docente.',
  },
  {
    label: '🏠 Situación Familiar y Emocional',
    text: 'El estudiante acude al DECE manifestando tensión emocional por problemas familiares recientes. Se evidencia llanto esporádico y baja concentración. Se requiere citación inmediata a representantes y seguimiento psicopedagógico semanal.',
  },
  {
    label: '📉 Descenso en Rendimiento Académico',
    text: 'Evaluación psicopedagógica por caída abrupta del promedio. No presenta entregas de tareas en materias clave. Se propone plan de refuerzo académico con tutores y agenda de tareas firmada diariamente por el representante.',
  },
]

const RISK_BADGE: Record<string, string> = {
  critico: 'bg-red-500/20 text-red-300 border-red-500/40',
  alto:    'bg-orange-500/20 text-orange-300 border-orange-500/40',
  medio:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
  bajo:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
}

export function VoiceDictationModal({ open, onOpenChange, onApplyPlan }: VoiceDictationModalProps) {
  const [dictationText, setDictationText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DictationResult | null>(null)

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up on close
  useEffect(() => {
    if (!open) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setIsRecording(false)
      setTimerSeconds(0)
    }
  }, [open])

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setTimerSeconds((p) => p + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimerSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleToggleRecord = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Su navegador no soporta reconocimiento de voz. Escriba el dictado directamente.')
      return
    }

    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop()
      setIsRecording(false)
      return
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = 'es-EC'
      recognition.continuous = true
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsRecording(true)
        toast.info('🎙️ Grabando dictado por voz...')
      }

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' '
          }
        }
        if (finalTranscript.trim()) {
          setDictationText((prev) => prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim())
        }
      }

      recognition.onerror = () => { setIsRecording(false) }
      recognition.onend   = () => { setIsRecording(false) }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      toast.error('Error al acceder al micrófono')
      setIsRecording(false)
    }
  }

  const handleProcessDictation = async () => {
    if (!dictationText.trim()) {
      toast.error('Ingrese o dicte texto antes de procesar.')
      return
    }
    setLoading(true)
    try {
      const res = await apiPost<{ status: string; structured_data: DictationResult }>(
        '/behavioral/dictate-transcribe',
        { raw_text: dictationText.trim() }
      )
      setResult(res.structured_data)
      toast.success('✅ Dictado procesado y estructurado con IA')
    } catch {
      toast.error('Error al procesar con IA. Verifique la conexión con el backend.')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (result && onApplyPlan) {
      onApplyPlan(result)
      onOpenChange(false)
    }
  }

  const handleClose = () => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsRecording(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0 gap-0 sm:max-w-2xl border border-white/10 bg-[#070f1f] rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden">

        {/* Header */}
        <DialogHeader className="relative px-6 pt-6 pb-5 border-b border-white/8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-600/15 via-blue-600/10 to-purple-600/15" />
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-sky-500/20 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
                <Sparkles className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-display font-bold text-white">
                  Asistente de Voz DECE
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-0.5">
                  Dicte observaciones · La IA estructurará el Plan de Acción
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Mic control */}
          <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${
            isRecording
              ? 'border-rose-500/50 bg-rose-500/5 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
              : 'border-white/10 bg-white/5'
          }`}>
            {isRecording && (
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/8 to-transparent animate-pulse" />
            )}
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isRecording ? (
                  <div className="h-11 w-11 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    <div className="flex items-end gap-0.5 h-5">
                      {[3, 5, 4, 2, 5, 3, 4].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-rose-500 rounded-full animate-pulse"
                          style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-11 w-11 rounded-full bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                    <Volume2 className="h-5 w-5 text-sky-400" />
                  </div>
                )}
                <div>
                  <p className={`text-sm font-bold ${isRecording ? 'text-rose-400' : 'text-white'}`}>
                    {isRecording ? 'Escuchando en tiempo real...' : 'Micrófono listo'}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {isRecording ? `Grabando: ${formatTimer(timerSeconds)}` : 'Haga clic para iniciar'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleToggleRecord}
                className={`gap-2 font-bold rounded-xl h-10 px-5 transition-all duration-300 shrink-0 ${
                  isRecording
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-lg shadow-sky-500/25'
                }`}
              >
                {isRecording ? (
                  <><MicOff className="h-4 w-4" /> Detener</>
                ) : (
                  <><Mic className="h-4 w-4" /> Grabar</>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              Plantillas Rápidas
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDictationText(tmpl.text)}
                  className="text-xs bg-white/5 hover:bg-sky-500/20 border border-white/10 hover:border-sky-500/40 rounded-full px-3.5 py-1.5 transition-all text-slate-300 hover:text-white font-medium"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative group">
            <div className="absolute -inset-px bg-gradient-to-r from-sky-500/30 to-indigo-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
              <Textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="El texto dictado aparecerá aquí automáticamente, o escríbalo directamente..."
                className="min-h-[130px] resize-none border-0 bg-transparent text-sm text-white placeholder:text-slate-600 focus-visible:ring-0 px-4 py-3"
              />
              {dictationText && (
                <button
                  type="button"
                  onClick={() => setDictationText('')}
                  className="absolute right-3 top-3 h-7 w-7 rounded-full bg-white/10 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                  title="Limpiar"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Process Button */}
          <Button
            type="button"
            onClick={() => void handleProcessDictation()}
            disabled={loading || !dictationText.trim()}
            className="w-full h-12 gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Wand2 className="h-5 w-5 animate-spin" /> Analizando con IA...</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Estructurar Dictado con IA</>
            )}
          </Button>

          {/* Result */}
          {result && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-4 shadow-[0_0_30px_rgba(56,189,248,0.1)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-indigo-500/5 to-transparent pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Analizado por IA
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${RISK_BADGE[result.nivel_riesgo_sugerido?.toLowerCase()] ?? RISK_BADGE.medio}`}>
                  Riesgo {result.nivel_riesgo_sugerido}
                </span>
              </div>

              <div className="relative z-10">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Resumen DECE</p>
                <p className="text-sm text-slate-200 font-medium leading-relaxed">{result.resumen_hallazgos}</p>
              </div>

              <div className="relative z-10">
                <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1.5">Objetivo del Plan</p>
                <p className="text-sm text-slate-300 bg-black/30 rounded-xl p-3 border border-white/8 leading-relaxed">
                  {result.objetivo_plan_accion}
                </p>
              </div>

              <div className="relative z-10">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Compromisos Generados ({result.compromisos_sugeridos.length})
                </p>
                <ul className="space-y-2">
                  {result.compromisos_sugeridos.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 bg-white/5 hover:bg-white/8 transition-colors p-3 rounded-xl border border-white/8">
                      <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{item.titulo}</p>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{item.descripcion}</p>
                        <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-[10px] text-slate-400 font-semibold">
                          Responsable: {item.responsable}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {onApplyPlan && (
                <Button
                  type="button"
                  onClick={handleApply}
                  className="w-full h-11 gap-2 mt-2 font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 transition-all relative z-10"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aplicar al Plan de Acción
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
