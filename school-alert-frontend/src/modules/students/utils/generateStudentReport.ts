import type { Student } from '../types'
import type { StudentAcademicProfile } from '@/modules/academic/types'
import type { TimelineEntry } from '@/modules/behavioral/types'
import type { Alert } from '@/modules/alerts/types'

interface ReportData {
  student: Student
  profile: StudentAcademicProfile | null
  timeline: TimelineEntry[]
  alerts: Alert[]
  institutionName?: string
}

const RISK_LABELS: Record<string, string> = {
  green:  'Estable',
  yellow: 'En observación',
  red:    'Requiere atención',
  purple: 'Crítico',
}

const RISK_COLORS: Record<string, string> = {
  green:  '#16a34a',
  yellow: '#d97706',
  red:    '#dc2626',
  purple: '#7c3aed',
}

function initials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function generateStudentPDF({
  student,
  profile,
  timeline,
  alerts,
  institutionName = 'Institución Educativa',
}: ReportData): void {
  const today = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const riskColor = RISK_COLORS[student.risk] ?? '#64748b'
  const riskLabel = RISK_LABELS[student.risk]  ?? 'Sin clasificar'

  /* ── Subject rows ──────────────────────────────────────────────── */
  const subjectRows = (profile?.subject_scores ?? []).map((s) => {
    const pass  = (s.value ?? 0) >= 7
    const color = pass ? '#16a34a' : '#dc2626'
    const note  = pass ? '✓ Aprobado' : '⚠ Por debajo del umbral'
    return `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${s.subject}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-weight:700;color:${color};">${s.value?.toFixed(1) ?? '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:${color};">${note}</td>
      </tr>`
  }).join('')

  /* ── Timeline entries ──────────────────────────────────────────── */
  const sourcePill: Record<string, string> = {
    dece:         'background:#ede9fe;color:#7c3aed;',
    tutor:        'background:#dbeafe;color:#1d4ed8;',
    disciplinary: 'background:#fee2e2;color:#dc2626;',
  }
  const timelineHtml = timeline.slice(0, 20).map((e) => `
    <div style="display:flex;gap:12px;padding-bottom:14px;page-break-inside:avoid;">
      <div style="width:10px;height:10px;border-radius:50%;background:#0ea5e9;border:2px solid white;margin-top:4px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <strong style="font-size:13px;">${e.type_label}</strong>
          <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;${sourcePill[e.source] ?? ''}">
            ${e.source}
          </span>
        </div>
        <p style="font-size:12px;color:#334155;line-height:1.55;margin:0 0 3px;">${e.description}</p>
        <p style="font-size:10px;color:#94a3b8;margin:0;">${fmt(e.date)} · ${e.author_name}</p>
        ${e.actions_taken ? `<p style="font-size:11px;color:#475569;margin-top:4px;"><strong>Acciones:</strong> ${e.actions_taken}</p>` : ''}
      </div>
    </div>`).join('')

  /* ── Alert cards ───────────────────────────────────────────────── */
  const levelBg: Record<string, string> = {
    critico: 'background:#fef2f2;border-color:#fca5a5;',
    alto:    'background:#fff7ed;border-color:#fed7aa;',
    medio:   'background:#fefce8;border-color:#fde68a;',
    bajo:    'background:#f0fdf4;border-color:#bbf7d0;',
  }
  const levelBadge: Record<string, string> = {
    critico: 'background:#dc2626;color:white;',
    alto:    'background:#ea580c;color:white;',
    medio:   'background:#d97706;color:white;',
    bajo:    'background:#16a34a;color:white;',
  }
  const alertHtml = alerts.slice(0, 10).map((a) => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid;${levelBg[a.level] ?? ''}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;${levelBadge[a.level] ?? ''}">${a.level.toUpperCase()}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;background:#e0f2fe;color:#0369a1;">${a.alert_type}</span>
        <span style="margin-left:auto;font-size:10px;color:#94a3b8;">${fmt(a.created_at)}</span>
      </div>
      <p style="font-size:12px;color:#334155;line-height:1.5;margin:0;">${a.description}</p>
      ${a.actions_taken ? `<p style="font-size:11px;color:#16a34a;margin-top:4px;"><strong>Atención:</strong> ${a.actions_taken}</p>` : ''}
    </div>`).join('')

  /* ── Stat card helper ──────────────────────────────────────────── */
  const statCard = (value: string, label: string, warn = false) => `
    <div style="border:1px solid ${warn ? '#fca5a5' : '#e2e8f0'};background:${warn ? '#fef2f2' : '#f8fafc'};border-radius:10px;padding:12px 14px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:${warn ? '#dc2626' : '#0f172a'};line-height:1;">${value}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.8px;">${label}</div>
    </div>`

  const avg    = profile?.average_score ?? (student.average > 0 ? student.average : null)
  const absNum = profile?.absence_count ?? 0

  /* ── Full HTML ─────────────────────────────────────────────────── */
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Expediente — ${student.displayName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#fff;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%);color:white;padding:32px 40px 24px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
    <div>
      <div style="font-size:22px;font-weight:800;color:#38bdf8;letter-spacing:-0.5px;">SIDTRAC</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px;text-transform:uppercase;letter-spacing:1px;">${institutionName}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#94a3b8;line-height:1.8;">
      <div>Expediente Académico y Conductual</div>
      <div>Generado: ${today}</div>
      <div style="margin-top:4px;font-size:9px;color:#64748b;">CONFIDENCIAL — Uso exclusivo institucional</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:16px;background:rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;">
    <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#6366f1);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;flex-shrink:0;">${initials(student.displayName)}</div>
    <div style="flex:1;">
      <div style="font-size:24px;font-weight:800;color:white;">${student.displayName}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
        ${student.course}${student.nationalId ? ` &nbsp;·&nbsp; C.I.: ${student.nationalId}` : ''}${student.guardianName ? ` &nbsp;·&nbsp; Repr.: ${student.guardianName}` : ''}
      </div>
    </div>
    <div style="padding:8px 18px;border-radius:999px;font-size:12px;font-weight:700;color:white;background:${riskColor};">🔔 ${riskLabel}</div>
  </div>
</div>

<!-- ══ BODY ══ -->
<div style="padding:32px 40px;">

  <!-- Stats -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0ea5e9;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px;">Indicadores Clave</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;">
    ${statCard(avg !== null ? Number(avg).toFixed(1) : '—', 'Promedio General', avg !== null && Number(avg) < 7)}
    ${statCard(String(absNum), 'Faltas', absNum > 5)}
    ${statCard(String(profile?.tardy_count ?? 0), 'Tardanzas')}
    ${statCard(String(timeline.length), 'Registros Conductuales')}
  </div>

  ${subjectRows ? `
  <!-- Subjects -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0ea5e9;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px;">Rendimiento por Materia</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:28px;">
    <thead><tr style="background:#f8fafc;">
      <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;">Materia</th>
      <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;">Nota</th>
      <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;">Estado</th>
    </tr></thead>
    <tbody>${subjectRows}</tbody>
  </table>
  ` : ''}

  ${alertHtml ? `
  <!-- Alerts -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0ea5e9;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px;">Alertas Tempranas (${alerts.length} registros)</div>
  <div style="margin-bottom:28px;">${alertHtml}</div>
  ` : ''}

  <!-- Timeline -->
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#0ea5e9;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px;">Historial Conductual (${timeline.length} registros)</div>
  <div style="position:relative;padding-left:20px;margin-bottom:28px;">
    <div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:#e2e8f0;"></div>
    ${timelineHtml || '<p style="color:#94a3b8;font-style:italic;padding-left:8px;">Sin registros conductuales para este período.</p>'}
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:20px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;">
    <p style="font-size:9px;color:#94a3b8;line-height:1.6;max-width:320px;">
      Este documento ha sido generado automáticamente por el Sistema SIDTRAC con base en los registros académicos y conductuales del período vigente. La información es confidencial y de uso exclusivo del personal autorizado.
    </p>
    <div style="display:flex;gap:48px;">
      <div style="text-align:center;min-width:160px;">
        <div style="height:48px;"></div>
        <div style="border-top:1px solid #334155;margin-bottom:6px;"></div>
        <div style="font-size:10px;color:#64748b;">Coordinador/a DECE</div>
      </div>
      <div style="text-align:center;min-width:160px;">
        <div style="height:48px;"></div>
        <div style="border-top:1px solid #334155;margin-bottom:6px;"></div>
        <div style="font-size:10px;color:#64748b;">Rector/a de la Institución</div>
      </div>
    </div>
  </div>

</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=750')
  if (!win) {
    alert('Permite ventanas emergentes para generar el reporte PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
}
