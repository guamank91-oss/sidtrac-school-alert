import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface RagChatPanelProps {
  compact?: boolean
}

const SUGGESTIONS = [
  '¿Cuál es la situación actual de este estudiante?',
  '¿Qué factores de riesgo tiene y qué tan urgentes son?',
  '¿Existe riesgo de deserción? ¿Qué recomiendas hacer?',
]

export function RagChatPanel({ compact = false }: RagChatPanelProps) {
  const navigate = useNavigate()

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-accent" />
            <div>
              <CardTitle className="text-base">Consulta Inteligente</CardTitle>
              <CardDescription className="text-xs">
                Analiza estudiantes en lenguaje natural con IA
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate('/rag')}>
            Abrir asistente
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Consulta Inteligente (RAG)</CardTitle>
              <CardDescription>
                Pregunta en español sobre la situación de cualquier estudiante
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700">IA disponible</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => navigate('/rag')}
              className="w-full text-left text-sm rounded-lg border bg-card px-3 py-2 hover:bg-muted transition-colors"
            >
              “{q}”
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={() => navigate('/rag')}>
          Abrir consulta inteligente
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
