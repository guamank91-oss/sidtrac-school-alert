import { useEffect, useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getStudentAcademicProfile } from '../api'
import type { StudentAcademicProfile } from '../types'
import { StudentAcademicSnapshot } from './StudentAcademicSnapshot'

interface StudentAcademicDetailDialogProps {
  studentId: number | null
  studentName: string
  courseName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentAcademicDetailDialog({
  studentId,
  studentName,
  courseName,
  open,
  onOpenChange,
}: StudentAcademicDetailDialogProps) {
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !studentId) {
      setProfile(null)
      return
    }
    setLoading(true)
    getStudentAcademicProfile(studentId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [open, studentId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 pb-4 pt-6 pr-12">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 shrink-0" />
              <span className="truncate">{studentName}</span>
            </DialogTitle>
            <DialogDescription>
              {courseName ? `${courseName} · ` : ''}
              Vista académica consolidada
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StudentAcademicSnapshot profile={profile} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
