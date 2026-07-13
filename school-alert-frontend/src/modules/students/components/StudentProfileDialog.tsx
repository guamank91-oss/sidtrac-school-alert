import { useEffect, useState } from 'react'
import { Loader2, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getStudentAcademicProfile } from '@/modules/academic/api'
import { StudentAcademicCharts } from '@/modules/academic/components/StudentAcademicCharts'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import type { Alert } from '@/modules/alerts/types'
import { getStudentTimeline } from '@/modules/behavioral/api'
import { BehavioralTimeline } from '@/modules/behavioral/components/BehavioralTimeline'
import type { TimelineEntry } from '@/modules/behavioral/types'
import type { Student } from '../types'
import { getRiskBadge, getRiskIcon } from '../utils/risk'
import {
  StudentInterventionsPanel,
  fetchAttendedAlertsForStudent,
} from './StudentInterventionsPanel'
import { AttentionPlanPanel } from '@/modules/action-plans/components/AttentionPlanPanel'
import { getUser } from '@/modules/auth/lib/session'

interface StudentProfileDialogProps {
  student: Student
  defaultOpen?: boolean
  defaultTab?: 'overview' | 'interventions' | 'attention-plan'
}

export function StudentProfileDialog({
  student,
  defaultOpen = false,
  defaultTab = 'overview',
}: StudentProfileDialogProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [attendedAlerts, setAttendedAlerts] = useState<Alert[]>([])
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const role = getUser()?.active_role
  const showAttentionTab =
    role === 'dece' || role === 'administrador' || role === 'tutor' || role === 'docente'

  const initials = student.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    if (!open) return

    setLoading(true)
    Promise.all([
      getStudentTimeline(Number(student.id)),
      getStudentAcademicProfile(Number(student.id)),
      fetchAttendedAlertsForStudent(Number(student.id)),
    ])
      .then(([entries, academicProfile, alerts]) => {
        setTimeline(entries)
        setProfile(academicProfile)
        setAttendedAlerts(alerts)
      })
      .catch(() => {
        setTimeline([])
        setProfile(null)
        setAttendedAlerts([])
      })
      .finally(() => setLoading(false))
  }, [open, student.id])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Perfil 360
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="shrink-0 space-y-2 border-b px-6 pb-4 pt-6 pr-12">
          <DialogHeader className="space-y-2 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Perfil 360°</p>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate">{student.displayName}</span>
                <p className="truncate text-sm font-normal text-muted-foreground">{student.course}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 pt-0">
              {getRiskIcon(student.risk)}
              <span>Estado actual: {getRiskBadge(student.risk)}</span>
            </DialogDescription>
            {student.guardianName && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Representante: {student.guardianName}</span>
              </p>
            )}
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as 'overview' | 'interventions' | 'attention-plan')
            }
          >
            <TabsList
              className={`grid h-auto w-full ${showAttentionTab ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Resumen 360
              </TabsTrigger>
              <TabsTrigger value="interventions" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Intervenciones y acciones</span>
                <span className="sm:hidden">Intervenciones</span>
              </TabsTrigger>
              {showAttentionTab ? (
                <TabsTrigger value="attention-plan" className="text-xs sm:text-sm">
                  Plan de atención
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="overview" className="mt-4 focus-visible:outline-none">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Cargando perfil integral...
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  <div className="min-w-0">
                    <StudentAcademicCharts
                      profile={profile}
                      subjectScores={profile?.subject_scores ?? []}
                      attendanceTrend={profile?.attendance_trend ?? []}
                      compact
                      subjectsView="radar"
                    />
                  </div>
                  <Card className="min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Historial conductual</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <BehavioralTimeline entries={timeline} maxHeight="360px" />
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="interventions" className="mt-4 focus-visible:outline-none">
              <StudentInterventionsPanel
                timeline={timeline}
                attendedAlerts={attendedAlerts}
                loading={loading}
              />
            </TabsContent>

            {showAttentionTab ? (
              <TabsContent value="attention-plan" className="mt-4 focus-visible:outline-none">
                <AttentionPlanPanel studentId={Number(student.id)} />
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
