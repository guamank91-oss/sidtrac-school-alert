import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Clock, Copy, Loader2, Search, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getStudentAcademicProfile } from '@/modules/academic/api'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import { RISK_BADGE_CLASSES, RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import { getUser } from '@/modules/auth/lib/session'
import { listCourses } from '@/modules/institution/api'
import type { Course } from '@/modules/institution/types'
import { getStudent, listStudents } from '@/modules/students/api'
import { RISK_LABELS } from '@/modules/students/utils/mapStudent'
import { useTermId } from '@/shared/context/PeriodContext'
import type { StudentRecord } from '@/modules/students/types'
import type { RiskLevel } from '@/shared/types/roles'
import { RagMarkdown } from '../components/RagMarkdown'
import { RagSourceLinks } from '../components/RagSourceLinks'
import { ragQueryStream, type RagQueryResponse } from '../api'

const ALL_COURSES = '__all__' as const
const ALL_RISK = '__all__' as const

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  riskLevel?: string | null
  sources?: string[]
  latencyMs?: number
  usedLlm?: boolean
  intent?: RagQueryResponse['intent']
}

const RISK_DOT_CLASSES: Record<RiskLevel, string> = {
  bajo: 'bg-emerald-500',
  medio: 'bg-amber-500',
  alto: 'bg-orange-500',
  critico: 'bg-red-500',
}

function AssistantAvatar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/80 via-blue-500/80 to-indigo-500/80 shadow-[0_0_15px_rgba(168,85,247,0.4)] backdrop-blur-md border border-white/20 ${className}`}
    >
      <Sparkles className="h-1/2 w-1/2 text-white animate-pulse" />
    </div>
  )
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
}

const SUGGESTED_QUESTIONS = [
  '¿Cuál es la situación actual de este estudiante?',
  '¿Ha mostrado algún cambio emocional en las últimas semanas?',
  '¿Qué factores de riesgo tiene y qué tan urgentes son?',
  '¿En qué materias tiene más problemas?',
  '¿Qué acciones del DECE se han tomado hasta ahora?',
  '¿Existe riesgo de deserción? ¿Qué recomiendas hacer?',
]

/** Revela texto acumulado cada ~3.5 s (bloques), no letra a letra. */
const STREAM_BLOCK_MS = 3500

let nextMessageId = Date.now()
function createMessageIds() {
  const userId = nextMessageId
  nextMessageId = userId + 2
  return { userId, assistantId: userId + 1 }
}

export function RagPage() {
  const termId = useTermId()
  const institutionId = getUser()?.institution_id
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCourse, setFilterCourse] = useState<string>(ALL_COURSES)
  const [filterRisk, setFilterRisk] = useState<string>(ALL_RISK)
  const [selected, setSelected] = useState<StudentRecord | null>(null)
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const preselectDone = useRef(false)
  const holdSelectionRef = useRef(false)

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedId(message.id)
      setTimeout(() => setCopiedId((prev) => (prev === message.id ? null : prev)), 1500)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  useEffect(() => {
    setFilterCourse(ALL_COURSES)
  }, [termId])

  useEffect(() => {
    if (!institutionId || !termId) {
      setCourses([])
      return
    }
    listCourses(institutionId, termId)
      .then(setCourses)
      .catch(() => setCourses([]))
  }, [institutionId, termId])

  const loadStudents = useCallback(async () => {
    if (!termId) return
    setStudentsLoading(true)
    try {
      const list = await listStudents({
        institution_id: institutionId,
        term_id: termId,
        search: search.trim() || undefined,
        course_id: filterCourse !== ALL_COURSES ? Number(filterCourse) : undefined,
        risk_level: filterRisk !== ALL_RISK ? (filterRisk as RiskLevel) : undefined,
        status: 'activo',
      })
      setStudents(list)
    } catch {
      toast.error('No se pudieron cargar los estudiantes')
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }, [institutionId, termId, search, filterCourse, filterRisk])

  useEffect(() => {
    const timer = setTimeout(() => void loadStudents(), 250)
    return () => clearTimeout(timer)
  }, [loadStudents])

  useEffect(() => {
    const preselect = searchParams.get('student')
    if (!preselect || preselectDone.current || studentsLoading) return
    const id = Number(preselect)
    if (!Number.isFinite(id)) {
      preselectDone.current = true
      return
    }

    const fromList = students.find((s) => s.id === id)
    if (fromList) {
      setSelected(fromList)
      preselectDone.current = true
      return
    }

    void getStudent(id)
      .then((student) => {
        holdSelectionRef.current = true
        setFilterCourse(ALL_COURSES)
        setFilterRisk(ALL_RISK)
        setSearch('')
        setSelected(student)
        preselectDone.current = true
      })
      .catch(() => {
        preselectDone.current = true
      })
  }, [searchParams, students, studentsLoading])

  useEffect(() => {
    if (studentsLoading || !selected) return
    const inList = students.some((s) => s.id === selected.id)
    if (holdSelectionRef.current) {
      if (inList) holdSelectionRef.current = false
      return
    }
    if (!inList) setSelected(null)
  }, [students, studentsLoading, selected?.id])

  useEffect(() => {
    // History is cleared when switching students.
    setMessages([])
    setProfile(null)
    if (!selected) return
    setProfileLoading(true)
    getStudentAcademicProfile(selected.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false))
  }, [selected])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async (question: string) => {
    if (!selected || !question.trim() || sending) return
    const text = question.trim()
    setInput('')
    const { userId, assistantId } = createMessageIds()
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: text, createdAt: Date.now() },
      { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() },
    ])
    setSending(true)

    let sources: string[] = []
    let displayed = ''
    let pending = ''
    let flushTimer: ReturnType<typeof setInterval> | null = null

    const flushBlock = (forceAll = false) => {
      if (!pending && !forceAll) return
      displayed += pending
      pending = ''
      const snapshot = displayed
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m))
      )
    }

    flushTimer = setInterval(() => flushBlock(), STREAM_BLOCK_MS)

    try {
      await ragQueryStream(
        { student_id: selected.id, question: text, history },
        {
          onMeta: (meta) => {
            sources = meta.sources
          },
          onDelta: (chunk) => {
            pending += chunk
          },
          onDone: (done) => {
            if (flushTimer) clearInterval(flushTimer)
            displayed += pending
            pending = ''
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: displayed,
                      riskLevel: done.detected_risk_level,
                      sources,
                      latencyMs: done.latency_ms,
                      usedLlm: done.used_llm,
                      intent: done.intent,
                    }
                  : m
              )
            )
          },
          onError: () => toast.error('La consulta falló. Intenta de nuevo.'),
        }
      )
    } catch {
      toast.error('La consulta falló. Intenta de nuevo.')
    } finally {
      if (flushTimer) clearInterval(flushTimer)
      setSending(false)
    }
  }

  const riskLevel = (selected?.current_risk_level ?? 'bajo') as RiskLevel

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <div className="flex shrink-0 items-start gap-4 glass-panel p-5 rounded-3xl border border-white/10 animate-slide-up relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent" aria-hidden />
        <AssistantAvatar className="h-14 w-14 shrink-0 relative z-10" />
        <div className="relative z-10">
          <h1 className="flex items-center gap-3 text-3xl font-display font-bold tracking-tight text-white">
            Consulta Inteligente
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-400 px-2 py-0.5"
            >
              IA · RAG
            </Badge>
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
            Pregunta en lenguaje natural sobre la situación académica, conductual y emocional de un
            estudiante. Las respuestas se generan solo con datos institucionales.
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[340px_1fr] lg:items-stretch">
        <div className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Card className="glass-panel border-white/10 shadow-xl overflow-hidden rounded-3xl">
            <CardHeader className="pb-4 bg-black/20 border-b border-white/5">
              <CardTitle className="text-base font-display text-white">Estudiante</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Selecciona sobre quién quieres consultar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o cédula..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_COURSES}>Todos los cursos</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nivel de riesgo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RISK}>Todo riesgo</SelectItem>
                  {(Object.keys(RISK_LABELS) as RiskLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      {RISK_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ScrollArea className="h-56">
                <div className="space-y-1 pr-2">
                  {studentsLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {students.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelected(s)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-300 ${
                            selected?.id === s.id
                              ? 'bg-purple-500/20 text-white ring-1 ring-purple-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                              : 'hover:bg-white/5 text-slate-300 hover:text-white'
                          }`}
                        >
                          <span
                            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_5px_currentColor] ${
                              RISK_DOT_CLASSES[(s.current_risk_level ?? 'bajo') as RiskLevel]
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium leading-tight">
                              {s.first_name} {s.last_name}
                            </span>
                            <span
                              className={`block truncate text-xs ${
                                selected?.id === s.id
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {s.course_name}
                            </span>
                          </span>
                        </button>
                      ))}
                      {students.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Sin resultados
                        </p>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {selected && (
            <Card className="glass-panel border-white/10 shadow-xl overflow-hidden rounded-3xl animate-scale-in">
              <CardHeader className="pb-3 bg-black/20 border-b border-white/5">
                <CardTitle className="text-base font-display text-white">Mini resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {profileLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Nivel de riesgo</span>
                      <Badge variant="outline" className={`${RISK_BADGE_CLASSES[riskLevel]} border-white/10`}>
                        {RISK_LEVEL_LABELS[riskLevel]}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Promedio</span>
                      <span className="font-semibold text-white">
                        {profile?.average_score != null
                          ? profile.average_score.toFixed(2)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Ausencias</span>
                      <span className="font-semibold text-white">{profile?.absence_count ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-400">Asistencia</span>
                      <span className="font-semibold text-white">
                        {profile?.attendance_rate != null ? `${profile.attendance_rate}%` : '—'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="glass-panel border-white/10 shadow-2xl flex min-h-[min(640px,calc(100dvh-10rem))] flex-col overflow-hidden lg:h-[calc(100dvh-10rem)] rounded-3xl animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="border-b border-white/5 bg-black/20 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <AssistantAvatar className="h-10 w-10 shadow-lg shadow-purple-500/20" />
                <div>
                  <CardTitle className="text-base font-display text-white">
                    {selected
                      ? `Análisis de ${selected.first_name} ${selected.last_name}`
                      : 'Asistente DECE'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
                    </span>
                    En línea · el historial se limpia al cambiar
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:p-6 bg-gradient-to-b from-transparent to-black/10">
            <div className="min-h-0 flex-1 overflow-y-auto pr-3">
              {!selected ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center text-slate-400 animate-fade-in">
                  <AssistantAvatar className="mb-6 h-16 w-16 opacity-50 grayscale" />
                  <p className="font-display text-lg text-white mb-2">
                    Selecciona un estudiante para comenzar
                  </p>
                  <p className="max-w-xs text-sm leading-relaxed">
                    Luego escribe tu pregunta o usa una de las sugerencias predefinidas.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-6 py-6 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AssistantAvatar className="h-10 w-10 shrink-0 shadow-lg shadow-purple-500/20" />
                    <div className="rounded-2xl rounded-tl-sm bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 text-sm text-slate-200 shadow-xl leading-relaxed">
                      Hola, soy el asistente del DECE. Puedo analizar la situación de{' '}
                      <span className="font-bold text-white">{selected.first_name}</span> con base en sus
                      datos académicos, de asistencia y conductuales. ¿Qué te gustaría saber?
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-400 pl-14">
                      Preguntas sugeridas
                    </p>
                    <div className="flex flex-wrap gap-2 pl-14">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={q}
                          onClick={() => void send(q)}
                          className="rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-left text-xs text-slate-300 transition-all hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-white hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-slide-up"
                          style={{ animationDelay: `${i * 50}ms` }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 py-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      } animate-scale-in`}
                    >
                      {message.role === 'assistant' && (
                        <AssistantAvatar className="h-10 w-10 shrink-0 shadow-lg shadow-purple-500/20" />
                      )}
                      <div
                        className={`group flex max-w-[85%] flex-col ${
                          message.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`rounded-3xl px-5 py-4 shadow-xl backdrop-blur-md ${
                            message.role === 'user'
                              ? 'rounded-tr-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white border border-blue-400/20'
                              : 'rounded-tl-sm border border-white/10 bg-white/10 text-slate-200'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <p className="whitespace-pre-line text-sm leading-relaxed">
                              {message.content}
                            </p>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10">
                              <RagMarkdown content={message.content} />
                            </div>
                          )}
                          {message.role === 'assistant' && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                              {message.intent === 'student_query' && message.riskLevel && (
                                <Badge
                                  variant="outline"
                                  className={
                                    RISK_BADGE_CLASSES[message.riskLevel as RiskLevel] ?? ''
                                  }
                                >
                                  Riesgo:{' '}
                                  {RISK_LEVEL_LABELS[message.riskLevel as RiskLevel] ??
                                    message.riskLevel}
                                </Badge>
                              )}
                              {message.latencyMs != null && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Clock className="h-3 w-3" />
                                  {(message.latencyMs / 1000).toFixed(1)}s
                                </Badge>
                              )}
                              {message.usedLlm === false && (
                                <Badge variant="outline" className="text-xs text-amber-700">
                                  {message.intent === 'greeting' || message.intent === 'too_vague'
                                    ? 'Respuesta rápida'
                                    : message.intent === 'off_topic'
                                      ? 'Reorientación'
                                      : 'Modo sin IA'}
                                </Badge>
                              )}
                            </div>
                          )}
                          {message.role === 'assistant' &&
                            message.intent === 'student_query' &&
                            message.sources &&
                            message.sources.length > 0 &&
                            selected && (
                              <RagSourceLinks
                                studentId={selected.id}
                                sources={message.sources}
                              />
                            )}
                        </div>
                        <div
                          className={`mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground ${
                            message.role === 'user' ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {message.role === 'assistant' && (
                            <button
                              onClick={() => void copyMessage(message)}
                              className="inline-flex items-center gap-1 rounded px-1 py-0.5 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                              title="Copiar respuesta"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check className="h-3 w-3" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" /> Copiar
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sending &&
                    messages[messages.length - 1]?.role === 'assistant' &&
                    !messages[messages.length - 1]?.content && (
                    <div className="flex justify-start gap-3 animate-fade-in">
                      <AssistantAvatar className="h-10 w-10 shrink-0 shadow-lg shadow-purple-500/20" />
                      <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-sm border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 shadow-xl">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" />
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
              className="flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl p-2 pl-6 shadow-2xl transition-all focus-within:border-purple-500/50 focus-within:ring-4 focus-within:ring-purple-500/10 focus-within:bg-black/60"
            >
              <Input
                placeholder={
                  selected
                    ? 'Escribe tu pregunta…'
                    : 'Primero selecciona un estudiante'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!selected || sending}
                className="flex-1 border-0 bg-transparent p-0 text-white placeholder:text-slate-500 shadow-none focus-visible:ring-0 text-base"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!selected || sending || !input.trim()}
                className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
