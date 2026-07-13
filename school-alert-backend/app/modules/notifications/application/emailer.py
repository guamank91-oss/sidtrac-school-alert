from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_SENDER = "SIDTRAC <onboarding@resend.dev>"


def send_email_via_resend(
    *, recipient: str, subject: str, html: str, sender: str | None = None
) -> tuple[bool, str | None, str | None]:
    """Returns (success, resend_id, error_detail)."""
    if not settings.RESEND_API_KEY:
        return False, None, "RESEND_API_KEY no configurada"
    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        result = resend.Emails.send(
            {
                "from": sender or DEFAULT_SENDER,
                "to": [recipient],
                "subject": subject,
                "html": html,
            }
        )
        return True, result.get("id"), None
    except Exception as exc:
        logger.warning("Resend send failed: %s", exc)
        return False, None, str(exc)


RISK_COLORS = {
    "bajo": "#10b981",
    "medio": "#f59e0b",
    "alto": "#e11d48",
    "critico": "#7c3aed",
}

RISK_LABELS = {
    "bajo": "Bajo",
    "medio": "Medio",
    "alto": "Alto",
    "critico": "Crítico",
}


def build_alert_email_html(
    *,
    student_name: str,
    course_name: str,
    level: str,
    description: str,
    recommendations: str | None,
    institution_name: str,
) -> str:
    """RF-43: alert notification email body."""
    color = RISK_COLORS.get(level, "#64748b")
    label = RISK_LABELS.get(level, level)
    recs_html = ""
    if recommendations:
        items = "".join(
            f"<li style='margin-bottom:6px'>{line.strip('- ').strip()}</li>"
            for line in recommendations.splitlines()
            if line.strip()
        )
        recs_html = f"""
        <h3 style="color:#0f172a;margin-top:24px">Recomendaciones de intervención</h3>
        <ul style="color:#334155;line-height:1.6">{items}</ul>
        """

    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:{color};padding:20px 24px">
        <h1 style="color:#ffffff;margin:0;font-size:20px">Alerta de riesgo — Nivel {label}</h1>
        <p style="color:#ffffffcc;margin:4px 0 0 0;font-size:13px">{institution_name} · Sistema de Alerta Temprana</p>
      </div>
      <div style="padding:24px">
        <p style="color:#334155;font-size:15px">
          Se ha generado una alerta de nivel
          <strong style="color:{color}">{label.upper()}</strong> para el estudiante:
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:16px;color:#0f172a"><strong>{student_name}</strong></p>
          <p style="margin:4px 0 0 0;color:#64748b;font-size:14px">{course_name}</p>
        </div>
        <h3 style="color:#0f172a">Indicadores detectados</h3>
        <p style="color:#334155;line-height:1.6;white-space:pre-line">{description}</p>
        {recs_html}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="color:#94a3b8;font-size:12px">
          Este es un mensaje automático del sistema SIDTRAC generado el
          {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC.
          La información es confidencial y está dirigida únicamente al representante legal
          y al personal autorizado de la institución.
        </p>
      </div>
    </div>
    """
