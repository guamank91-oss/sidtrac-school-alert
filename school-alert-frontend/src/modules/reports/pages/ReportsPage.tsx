import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Download,
  FileBarChart2,
  FileCheck2,
  FileText,
  Mail,
  Minus,
  Printer,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTermId } from '@/shared/context/PeriodContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isAdmin } from '@/modules/auth/lib/session'
import { ALERT_TYPE_LABELS } from '@/modules/alerts/labels'
import { RISK_BADGE_CLASSES, RISK_LEVEL_LABELS } from '@/modules/alerts/labels'
import { listStudents } from '@/modules/students/api'
import type { StudentRecord } from '@/modules/students/types'
import type { RiskLevel } from '@/shared/types/roles'
import {
  downloadCsv,
  getInstitutionalReport,
  getStudentFullReport,
  type InstitutionalReport,
  type StudentFullReport,
} from '../api'
import { PeriodComparisonPanel } from '../components/PeriodComparisonPanel'

const LEVEL_COLORS: Record<string, string> = {
  critico: '#dc2626',
  alto: '#ea580c',
  medio: '#f59e0b',
  bajo: '#10b981',
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (current > previous)
    return (
      <span className="inline-flex items-center text-xs text-rose-600">
        <ArrowUpRight className="h-3 w-3" /> +{current - previous} vs mes anterior
      </span>
    )
  if (current < previous)
    return (
      <span className="inline-flex items-center text-xs text-emerald-600">
        <ArrowDownRight className="h-3 w-3" /> {current - previous} vs mes anterior
      </span>
    )
  return (
    <span className="inline-flex items-center text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> sin cambio
    </span>
  )
}

export function ReportsPage() {
  const termId = useTermId()
  const [report, setReport] = useState<InstitutionalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [studentReport, setStudentReport] = useState<StudentFullReport | null>(null)
  const [studentLoading, setStudentLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [citationStudentId, setCitationStudentId] = useState('')
  const [citationReason, setCitationReason] = useState('')
  const [citationDate, setCitationDate] = useState('')
  const [planIdInput, setPlanIdInput] = useState('')
  const admin = isAdmin()

  const handlePrintActionPlan = (planId?: string) => {
    const id = planId || planIdInput
    if (!id) {
      toast.error('Ingrese un ID de Plan de Acción válido')
      return
    }
    const token = localStorage.getItem('sidtrac_token')
    window.open(`/api/v1/reports/action-plans/${id}/pdf-html?token=${token}`, '_blank')
  }

  const handlePrintParentCitation = () => {
    if (!citationStudentId || !citationReason.trim() || !citationDate.trim()) {
      toast.error('Complete el estudiante, el motivo y la fecha/hora de la cita')
      return
    }
    const student = students.find((s) => s.id.toString() === citationStudentId)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Citación Oficial DECE — ${student ? `${student.first_name} ${student.last_name}` : 'Estudiante'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 24px; }
          .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; color: #0f172a; }
          .header p { margin: 4px 0 0 0; color: #2563eb; font-weight: bold; font-size: 13px; }
          .box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
          .signatures { margin-top: 80px; display: flex; justify-content: space-around; text-align: center; }
          .sig-line { border-top: 1px solid #0f172a; width: 220px; padding-top: 8px; font-weight: bold; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>UNIDAD EDUCATIVA — DECE</h1>
          <p>CITACIÓN OFICIAL DE CONSEJERÍA ESTUDIANTIL Y SEGUIMIENTO INTEGRAL</p>
        </div>
        <p><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-EC')}</p>
        <p><strong>Estudiante:</strong> ${student ? `${student.first_name} ${student.last_name}` : 'Estudiante'}</p>
        <p><strong>Cédula:</strong> ${student?.national_id || 'S/N'}</p>
        <p>Por medio de la presente, se solicita de carácter obligatorio la presencia del Representante Legal en las oficinas del DECE del plantel.</p>
        <div class="box">
          📌 <strong>Motivo de la Cita:</strong> ${citationReason}<br/>
          ⏰ <strong>Fecha y Hora:</strong> ${citationDate}
        </div>
        <p>Su puntualidad es fundamental para garantizar el bienestar y acompañamiento psicopedagógico de su representado.</p>
        <div class="signatures">
          <div class="sig-line">DECE / Psicología Escolar</div>
          <div class="sig-line">Firma de Recepción del Padre</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  useEffect(() => {
    Promise.all([getInstitutionalReport(termId), listStudents({ term_id: termId })])
      .then(([institutional, studentList]) => {
        setReport(institutional)
        setStudents(studentList)
      })
      .catch(() => toast.error('No se pudo cargar el reporte institucional'))
      .finally(() => setLoading(false))
  }, [termId])

  useEffect(() => {
    if (!selectedStudent) return
    setStudentLoading(true)
    getStudentFullReport(Number(selectedStudent))
      .then(setStudentReport)
      .catch(() => toast.error('No se pudo generar el reporte del estudiante'))
      .finally(() => setStudentLoading(false))
  }, [selectedStudent])

  const chartData = useMemo(
    () =>
      (report?.distribution ?? []).map((d) => ({
        name: RISK_LEVEL_LABELS[d.level as RiskLevel] ?? d.level,
        Estudiantes: d.count,
        color: LEVEL_COLORS[d.level] ?? '#64748b',
      })),
    [report]
  )

  const handleDownload = async (dataset: 'students' | 'alerts' | 'grades' | 'attendance') => {
    setDownloading(dataset)
    try {
      await downloadCsv(dataset)
      toast.success('Descarga iniciada')
    } catch {
      toast.error('No se pudo exportar el CSV')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground text-sm">
            Situación de riesgo institucional y reportes individuales
          </p>
        </div>
{/*         {admin && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['students', 'Estudiantes'],
                ['alerts', 'Alertas'],
                ['grades', 'Calificaciones'],
                ['attendance', 'Asistencias'],
              ] as const
            ).map(([dataset, label]) => (
              <Button
                key={dataset}
                variant="outline"
                size="sm"
                disabled={downloading === dataset}
                onClick={() => void handleDownload(dataset)}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {label}
              </Button>
            ))}
          </div>
        )} */}
      </div>

      <Tabs defaultValue="institutional">
        <TabsList>
          <TabsTrigger value="institutional">
            <FileBarChart2 className="h-4 w-4 mr-1.5" />
            Institucional
          </TabsTrigger>
          <TabsTrigger value="period">
            <CalendarRange className="h-4 w-4 mr-1.5" />
            Por periodo
          </TabsTrigger>
          <TabsTrigger value="student">
            <FileText className="h-4 w-4 mr-1.5" />
            Individual
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileCheck2 className="h-4 w-4 mr-1.5 text-sky-400" />
            Generador de Documentos DECE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="institutional" className="space-y-4 mt-4">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : report ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {report.distribution.map((d) => (
                  <Card key={d.level}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          variant="outline"
                          className={RISK_BADGE_CLASSES[d.level as RiskLevel] ?? ''}
                        >
                          {RISK_LEVEL_LABELS[d.level as RiskLevel] ?? d.level}
                        </Badge>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-3xl font-bold">{d.count}</p>
                      <Trend current={d.count} previous={d.previous_month} />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Distribución de riesgo</CardTitle>
                    <CardDescription>
                      {report.total_students} estudiantes activos · generado{' '}
                      {new Date(report.generated_at).toLocaleString('es-EC')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="Estudiantes" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Alertas</CardTitle>
                    <CardDescription>Resumen del periodo actual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border p-4">
                        <p className="text-2xl font-bold">{report.active_alerts}</p>
                        <p className="text-xs text-muted-foreground">Alertas activas</p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-2xl font-bold">{report.attended_alerts_month}</p>
                        <p className="text-xs text-muted-foreground">Atendidas este mes</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Por tipo</p>
                      <div className="space-y-2">
                        {report.alerts_by_type.length === 0 && (
                          <p className="text-sm text-muted-foreground">Sin alertas registradas</p>
                        )}
                        {report.alerts_by_type.map((t) => (
                          <div key={t.type} className="flex items-center justify-between text-sm">
                            <span>
                              {ALERT_TYPE_LABELS[t.type as keyof typeof ALERT_TYPE_LABELS] ??
                                t.type}
                            </span>
                            <Badge variant="secondary">{t.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="period" className="space-y-4 mt-4">
          <PeriodComparisonPanel />
        </TabsContent>

        <TabsContent value="student" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reporte individual del estudiante</CardTitle>
              <CardDescription>
                Consolida datos personales, académicos, conductuales y alertas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue placeholder="Selecciona un estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.first_name} {s.last_name} — {s.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {studentLoading && <Skeleton className="h-64 w-full" />}

          {studentReport && !studentLoading && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>{studentReport.full_name}</CardTitle>
                      <CardDescription>
                        {studentReport.course_name}
                        {studentReport.national_id ? ` · CI ${studentReport.national_id}` : ''}
                        {studentReport.guardian_name
                          ? ` · Representante: ${studentReport.guardian_name}`
                          : ''}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={RISK_BADGE_CLASSES[studentReport.risk_level as RiskLevel] ?? ''}
                    >
                      Riesgo {RISK_LEVEL_LABELS[studentReport.risk_level as RiskLevel] ?? ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold">
                        {studentReport.average_score?.toFixed(2) ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Promedio general</p>
                    </div>
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold">
                        {studentReport.attendance_rate != null
                          ? `${studentReport.attendance_rate}%`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Asistencia</p>
                    </div>
                    <div className="rounded-xl border p-4 text-center">
                      <p className="text-2xl font-bold">{studentReport.absences_30d}</p>
                      <p className="text-xs text-muted-foreground">Ausencias (30 días)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Calificaciones por materia</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {studentReport.grades_by_subject.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin calificaciones</p>
                    )}
                    {studentReport.grades_by_subject.map((g) => (
                      <div key={g.subject} className="flex items-center justify-between text-sm">
                        <span>{g.subject}</span>
                        <Badge
                          variant="outline"
                          className={
                            g.average < 7
                              ? 'text-rose-600 border-rose-200'
                              : 'text-emerald-700 border-emerald-200'
                          }
                        >
                          {g.average.toFixed(2)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Alertas ({studentReport.alerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-auto">
                    {studentReport.alerts.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin alertas registradas</p>
                    )}
                    {studentReport.alerts.map((a, i) => (
                      <div key={i} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
                        <p className="text-xs text-muted-foreground">
                          {a.date} · {a.type}
                        </p>
                        <p className="line-clamp-2 whitespace-pre-line">{a.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {(
                [
                  ['Reportes DECE', studentReport.dece_reports],
                  ['Anotaciones del tutor', studentReport.tutor_annotations],
                  ['Reportes disciplinarios', studentReport.disciplinary_reports],
                ] as const
              ).map(([title, entries]) => (
                <Card key={title}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {title} ({entries.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-72 overflow-auto">
                    {entries.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin registros</p>
                    )}
                    {entries.map((entry, i) => (
                      <div key={i} className="border rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="secondary">{entry.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {entry.date}
                            {entry.author ? ` · ${entry.author}` : ''}
                          </span>
                        </div>
                        <p className="whitespace-pre-line">{entry.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Citaciones a Padres */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5 text-sky-400" />
                  Citación Oficial a Padres de Familia
                </CardTitle>
                <CardDescription>
                  Genere una citación formal membretada lista para imprimir y entregar al representante legal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Seleccionar Estudiante</Label>
                  <Select value={citationStudentId} onValueChange={setCitationStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estudiante..." />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.first_name} {s.last_name} ({s.national_id || 'S/N'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Motivo de la Citación DECE</Label>
                  <Input
                    placeholder="Ej. Entrevista de seguimiento psicopedagógico y rendimiento escolar"
                    value={citationReason}
                    onChange={(e) => setCitationReason(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fecha y Hora Programada</Label>
                  <Input
                    placeholder="Ej. Lunes 15 de Agosto a las 09:30 AM"
                    value={citationDate}
                    onChange={(e) => setCitationDate(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handlePrintParentCitation}
                  className="w-full gap-2 font-semibold shadow-md bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white"
                >
                  <Printer className="h-4 w-4" />
                  Generar Citación Imprimible (PDF)
                </Button>
              </CardContent>
            </Card>

            {/* Imprimir Plan de Acción */}
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Printer className="h-5 w-5 text-indigo-400" />
                  Impresión de Plan de Acción DECE
                </CardTitle>
                <CardDescription>
                  Imprima el documento oficial de Plan de Acción con membrete, sustento LOEI y firmas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ID del Plan de Acción</Label>
                  <Input
                    placeholder="Ej. 1"
                    type="number"
                    value={planIdInput}
                    onChange={(e) => setPlanIdInput(e.target.value)}
                  />
                </div>

                <Button
                  onClick={() => handlePrintActionPlan()}
                  disabled={!planIdInput}
                  variant="outline"
                  className="w-full gap-2 font-semibold border-indigo-400/30 text-indigo-400 hover:bg-indigo-500/10"
                >
                  <FileText className="h-4 w-4" />
                  Imprimir Plan de Acción (PDF)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
