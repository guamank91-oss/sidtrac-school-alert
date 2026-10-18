import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getUser } from '@/modules/auth/lib/session'
import { listTerms } from '@/modules/institution/api'
import type { AcademicTerm } from '@/modules/institution/types'

const STORAGE_KEY = 'sidtrac_selected_term'

interface PeriodContextValue {
  terms: AcademicTerm[]
  selectedTermId: number | null
  selectedTerm: AcademicTerm | null
  activeTerm: AcademicTerm | null
  isViewingActiveTerm: boolean
  loading: boolean
  setSelectedTermId: (id: number) => void
  refreshTerms: () => Promise<void>
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const institutionId = getUser()?.institution_id
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [selectedTermId, setSelectedTermIdState] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshTerms = useCallback(async () => {
    if (!institutionId) {
      setTerms([])
      setSelectedTermIdState(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const termList = await listTerms(institutionId)
      setTerms(termList)
      const active = termList.find((t) => t.is_active)
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const storedId = stored ? Number(stored) : null
      const validStored = storedId && termList.some((t) => t.id === storedId)
      setSelectedTermIdState(validStored ? storedId : active?.id ?? termList[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [institutionId])

  useEffect(() => {
    void refreshTerms()
  }, [refreshTerms])

  const setSelectedTermId = useCallback((id: number) => {
    setSelectedTermIdState(id)
    sessionStorage.setItem(STORAGE_KEY, String(id))
  }, [])

  const activeTerm = useMemo(() => terms.find((t) => t.is_active) ?? null, [terms])
  const selectedTerm = useMemo(
    () => terms.find((t) => t.id === selectedTermId) ?? null,
    [terms, selectedTermId]
  )
  const isViewingActiveTerm = !activeTerm || selectedTermId === activeTerm.id

  const value = useMemo(
    () => ({
      terms,
      selectedTermId,
      selectedTerm,
      activeTerm,
      isViewingActiveTerm,
      loading,
      setSelectedTermId,
      refreshTerms,
    }),
    [
      terms,
      selectedTermId,
      selectedTerm,
      activeTerm,
      isViewingActiveTerm,
      loading,
      setSelectedTermId,
      refreshTerms,
    ]
  )

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) {
    throw new Error('usePeriod must be used within PeriodProvider')
  }
  return ctx
}

export function useTermId(): number | undefined {
  const { selectedTermId } = usePeriod()
  return selectedTermId ?? undefined
}
