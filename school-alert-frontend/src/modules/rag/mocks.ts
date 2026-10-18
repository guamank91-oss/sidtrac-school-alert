import type { ChatMessage } from './types'

export const mockChatHistory: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: '¿Cuál es el protocolo a seguir cuando un estudiante presenta tres reportes conductuales en una semana?',
  },
  {
    id: '2',
    role: 'assistant',
    content:
      'Según el Artículo 330 del Reglamento General a la LOEI, cuando un estudiante presenta múltiples reportes conductuales en un período corto, se debe: 1) Convocar al representante legal, 2) Realizar un diagnóstico integral con el DECE, 3) Establecer un plan de acompañamiento. El plazo máximo para la primera acción es de 48 horas.',
    confidence: 98,
    source: 'Art. 330 LOEI',
  },
]
