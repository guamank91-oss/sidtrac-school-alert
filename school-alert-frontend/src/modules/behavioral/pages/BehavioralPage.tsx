import { useSearchParams } from 'react-router-dom'
import { getUser } from '@/modules/auth/lib/session'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeceReportPanel } from '../components/DeceReportPanel'
import { DisciplinaryPanel } from '../components/DisciplinaryPanel'
import { TutorNotePanel } from '../components/TutorNotePanel'

const VALID_TABS = ['dece', 'tutor', 'disciplinary'] as const

export function BehavioralPage() {
  const role = getUser()?.active_role
  const [searchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const studentParam = searchParams.get('student') ?? undefined
  const reportParam = searchParams.get('report')
  const noteParam = searchParams.get('note')

  const highlightDeceReportId = reportParam && tabParam === 'dece' ? Number(reportParam) : undefined
  const highlightNoteId = noteParam && tabParam === 'tutor' ? Number(noteParam) : undefined
  const highlightDisciplinaryId =
    reportParam && tabParam === 'disciplinary' ? Number(reportParam) : undefined

  const defaultTab = role === 'dece' || role === 'administrador' ? 'dece' : 'tutor'
  const activeTab =
    tabParam && VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
      ? tabParam
      : defaultTab


  if (role === 'tutor') {
    return (
      <div className="space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden animate-slide-up">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10" aria-hidden />
          <div className="relative z-10">
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                <span className="text-blue-400 text-xl font-bold">#</span>
              </div>
              Seguimiento conductual
            </h1>
            <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-2xl">
              Anotaciones y reportes disciplinarios de su paralelo
            </p>
          </div>
        </div>
        <Tabs defaultValue={activeTab === 'disciplinary' ? 'disciplinary' : 'tutor'} className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <TabsList className="h-14 w-full justify-start gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 sm:w-auto shadow-inner overflow-x-auto">
            <TabsTrigger value="tutor" className="rounded-xl px-5 h-full data-[state=active]:bg-white/10 data-[state=active]:text-blue-400 data-[state=active]:shadow-lg transition-all font-medium">Anotaciones</TabsTrigger>
            <TabsTrigger value="disciplinary" className="rounded-xl px-5 h-full data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 data-[state=active]:shadow-lg transition-all font-medium">Disciplinarios</TabsTrigger>
          </TabsList>
          <TabsContent value="tutor" className="mt-4">
            <TutorNotePanel
              initialStudentFilter={studentParam}
              highlightNoteId={highlightNoteId}
            />
          </TabsContent>
          <TabsContent value="disciplinary" className="mt-4">
            <DisciplinaryPanel
              initialStudentFilter={studentParam}
              highlightReportId={highlightDisciplinaryId}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-white/10 relative overflow-hidden animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10" aria-hidden />
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <span className="text-blue-400 text-xl font-bold">#</span>
            </div>
            Seguimiento conductual
          </h1>
          <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-2xl">
            Reportes DECE, anotaciones de tutores y registros disciplinarios
          </p>
        </div>
      </div>

      <Tabs defaultValue={activeTab} className="animate-slide-up" style={{ animationDelay: '100ms' }}>
        <TabsList className="h-14 w-full justify-start gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 sm:w-auto shadow-inner overflow-x-auto">
          <TabsTrigger value="dece" className="rounded-xl px-5 h-full data-[state=active]:bg-white/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-lg transition-all font-medium">Reportes DECE</TabsTrigger>
          <TabsTrigger value="tutor" className="rounded-xl px-5 h-full data-[state=active]:bg-white/10 data-[state=active]:text-blue-400 data-[state=active]:shadow-lg transition-all font-medium">Anotaciones tutor</TabsTrigger>
          <TabsTrigger value="disciplinary" className="rounded-xl px-5 h-full data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 data-[state=active]:shadow-lg transition-all font-medium">Disciplinarios</TabsTrigger>
        </TabsList>
        <TabsContent value="dece" className="mt-4">
          <DeceReportPanel
            initialStudentFilter={studentParam}
            highlightReportId={highlightDeceReportId}
          />
        </TabsContent>
        <TabsContent value="tutor" className="mt-4">
          <TutorNotePanel
            initialStudentFilter={studentParam}
            highlightNoteId={highlightNoteId}
          />
        </TabsContent>
        <TabsContent value="disciplinary" className="mt-4">
          <DisciplinaryPanel
            initialStudentFilter={studentParam}
            highlightReportId={highlightDisciplinaryId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
