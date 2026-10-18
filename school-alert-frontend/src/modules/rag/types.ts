export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  confidence?: number
  source?: string
}
