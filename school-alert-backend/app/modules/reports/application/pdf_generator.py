from __future__ import annotations

from datetime import datetime
from typing import Any, Optional


def generate_official_action_plan_html(
    *,
    institution_name: str,
    student_name: str,
    course_name: str,
    national_id: str,
    plan_title: str,
    general_objective: str,
    tasks: list[dict[str, Any]],
    normative_articles: list[dict[str, Any]],
    created_at: datetime,
    psychologist_name: str,
) -> str:
    """Generate printable HTML/PDF of the DECE Action Plan formatted for physical printing & signature."""
    date_str = created_at.strftime("%d/%m/%Y")
    
    task_rows = ""
    for idx, task in enumerate(tasks, 1):
        status_label = "COMPLETADO" if task.get("completed") or task.get("status") == "completado" else "PENDIENTE"
        status_color = "#16a34a" if status_label == "COMPLETADO" else "#dc2626"
        task_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">{idx}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                <strong>{task.get('title', '')}</strong><br/>
                <span style="color: #64748b; font-size: 12px;">{task.get('description', '')}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">{task.get('responsible_role', 'DECE')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: {status_color};">{status_label}</td>
        </tr>
        """

    norm_items = ""
    for art in normative_articles:
        norm_items += f"""
        <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
            <strong>Art. {art.get('article', '')} — {art.get('title', '')}</strong>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">{art.get('body', '')}</p>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Plan de Acción DECE — {student_name}</title>
    <style>
        @page {{ size: A4; margin: 20mm; }}
        body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; font-size: 13px; }}
        .header {{ text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }}
        .header h1 {{ margin: 0; font-size: 20px; color: #07152f; text-transform: uppercase; letter-spacing: 1px; }}
        .header h2 {{ margin: 4px 0 0 0; font-size: 14px; color: #2563eb; font-weight: 600; }}
        .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f1f5f9; padding: 14px; border-radius: 8px; margin-bottom: 20px; }}
        .meta-item label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; }}
        .meta-item span {{ font-size: 14px; font-weight: 600; color: #0f172a; }}
        .section-title {{ font-size: 14px; font-weight: bold; color: #07152f; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th {{ background: #07152f; color: #ffffff; padding: 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }}
        .signatures {{ margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; }}
        .sig-line {{ border-top: 1px solid #0f172a; padding-top: 8px; font-weight: bold; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{institution_name}</h1>
        <h2>DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL (DECE)</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">PLAN DE ACCIÓN DE ACOMPAÑAMIENTO INTEGRAL</p>
    </div>

    <div class="meta-grid">
        <div class="meta-item"><label>Estudiante</label><span>{student_name}</span></div>
        <div class="meta-item"><label>Cédula / ID</label><span>{national_id or 'S/N'}</span></div>
        <div class="meta-item"><label>Curso / Paralelo</label><span>{course_name}</span></div>
        <div class="meta-item"><label>Fecha de Emisión</label><span>{date_str}</span></div>
    </div>

    <div class="section-title">1. Objetivo General de la Intervención</div>
    <p style="background: #ffffff; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 13px; font-weight: 500;">
        {general_objective}
    </p>

    <div class="section-title">2. Matriz de Compromisos y Tareas</div>
    <table>
        <thead>
            <tr>
                <th style="width: 8%;">N°</th>
                <th style="width: 52%;">Actividad / Compromiso</th>
                <th style="width: 20%;">Responsable</th>
                <th style="width: 20%;">Estado</th>
            </tr>
        </thead>
        <tbody>
            {task_rows}
        </tbody>
    </table>

    <div class="section-title">3. Sustento Normativo Legal (RGLOEI)</div>
    {norm_items or '<p style="color: #64748b;">No se asociaron artículos específicos.</p>'}

    <div class="signatures">
        <div>
            <div class="sig-line">{psychologist_name}<br/><span style="font-weight: normal; color: #64748b;">Profesional DECE / Psicólogo</span></div>
        </div>
        <div>
            <div class="sig-line">Representante Legal<br/><span style="font-weight: normal; color: #64748b;">Padre / Madre de Familia / Tutor</span></div>
        </div>
    </div>
</body>
</html>
    """


def generate_official_parent_communication_html(
    *,
    institution_name: str,
    student_name: str,
    course_name: str,
    representative_name: str,
    issue_date: datetime,
    reason: str,
    citation_date: str,
    psychologist_name: str,
) -> str:
    """Generate printable citation/official notice to parents for physical handover or print."""
    return f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Comunicado Oficial — {student_name}</title>
    <style>
        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 30px; max-width: 700px; margin: 0 auto; line-height: 1.6; }}
        .header {{ border-bottom: 3px double #2563eb; text-align: center; padding-bottom: 15px; margin-bottom: 30px; }}
        .header h1 {{ margin: 0; font-size: 22px; color: #07152f; }}
        .header p {{ margin: 4px 0 0 0; color: #2563eb; font-weight: 600; font-size: 13px; }}
        .content {{ background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; font-size: 14px; }}
        .box {{ background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px; margin: 15px 0; font-weight: 600; }}
        .footer {{ margin-top: 60px; text-align: center; }}
        .sig-line {{ border-top: 1px solid #0f172a; width: 260px; margin: 0 auto; padding-top: 8px; font-weight: bold; font-size: 13px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{institution_name}</h1>
        <p>CITACIÓN OFICIAL DEL DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL (DECE)</p>
    </div>

    <div class="content">
        <p><strong>Señor(a) Representante:</strong> {representative_name}</p>
        <p><strong>Estudiante:</strong> {student_name} ({course_name})</p>
        <p><strong>Fecha de Emisión:</strong> {issue_date.strftime("%d/%m/%Y")}</p>

        <p>Por medio de la presente, solicitamos de manera atenta y obligatoria su presencia en las instalaciones de la institución educativa para tratar asuntos referentes al acompañamiento escolar y bienestar de su representado(a).</p>

        <div class="box">
            📌 <strong>Motivo de la Cita:</strong> {reason}<br/>
            ⏰ <strong>Fecha y Hora Programada:</strong> {citation_date}
        </div>

        <p>Agradecemos de antemano su puntualidad y compromiso con el desarrollo integral de su representado.</p>
    </div>

    <div class="footer">
        <div class="sig-line">
            {psychologist_name}<br/>
            <span style="font-weight: normal; color: #64748b;">DECE — {institution_name}</span>
        </div>
    </div>
</body>
</html>
    """
