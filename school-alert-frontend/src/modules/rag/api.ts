import { apiClient } from '@/shared/lib/api'

export interface RagChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RagQueryResponse {
  answer: string
  detected_risk_level: string | null
  sources: string[]
  model: string
  latency_ms: number
  used_llm: boolean
  intent?: 'student_query' | 'greeting' | 'off_topic' | 'too_vague'
}

export interface RagHistoryEntry {
  id: number
  user_name: string
  student_name: string
  question: string
  answer: string
  model: string
  tokens_used: number | null
  latency_ms: number
  detected_risk: string | null
  created_at: string
}

export interface RagMetrics {
  total_queries: number
  queries_today: number
  avg_latency_ms: number
  queries_per_day: { day: string; count: number }[]
  models_used: { model: string; count: number }[]
}

export async function ragQuery(payload: {
  student_id: number
  question: string
  history?: RagChatHistoryMessage[]
}): Promise<RagQueryResponse> {
  const { data } = await apiClient.post<RagQueryResponse>('/rag/query', payload)
  return data
}

export interface RagStreamMeta {
  sources: string[]
  intent: RagQueryResponse['intent']
}

export interface RagStreamDone {
  detected_risk_level: string | null
  model: string
  used_llm: boolean
  intent: RagQueryResponse['intent']
  latency_ms: number
}

export interface RagStreamHandlers {
  onMeta?: (meta: RagStreamMeta) => void
  onDelta?: (text: string) => void
  onDone?: (done: RagStreamDone) => void
  onError?: (message: string) => void
}

export async function ragQueryStream(
  payload: { student_id: number; question: string; history?: RagChatHistoryMessage[] },
  handlers: RagStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'
  const token = localStorage.getItem('sidtrac_token')
  const res = await fetch(`${base}/rag/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok || !res.body) {
    handlers.onError?.('No se pudo iniciar la consulta')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let evt: Record<string, unknown>
    try {
      evt = JSON.parse(trimmed)
    } catch {
      return
    }
    switch (evt.type) {
      case 'meta':
        handlers.onMeta?.(evt as unknown as RagStreamMeta)
        break
      case 'delta':
        handlers.onDelta?.(String(evt.text ?? ''))
        break
      case 'done':
        handlers.onDone?.(evt as unknown as RagStreamDone)
        break
      case 'error':
        handlers.onError?.(String(evt.message ?? 'Error en la consulta'))
        break
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      dispatch(line)
    }
  }
  if (buffer.trim()) dispatch(buffer)
}

export async function getRagHistory(limit = 100): Promise<RagHistoryEntry[]> {
  const { data } = await apiClient.get<RagHistoryEntry[]>('/rag/history', { params: { limit } })
  return data
}

export async function getRagMetrics(): Promise<RagMetrics> {
  const { data } = await apiClient.get<RagMetrics>('/rag/metrics')
  return data
}
