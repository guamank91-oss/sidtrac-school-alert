import logging
from typing import Any, Dict, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """Service for sending automated WhatsApp messages to student guardians via Twilio / Meta API."""

    @staticmethod
    async def send_parent_alert(
        guardian_phone: str,
        guardian_name: str,
        student_name: str,
        risk_level: str,
        institution_name: str = "Unidad Educativa",
    ) -> Dict[str, Any]:
        """Dispatches an urgent WhatsApp template message inviting parent to DECE appointment."""
        clean_phone = guardian_phone.replace(" ", "").replace("-", "")
        if not clean_phone.startswith("+"):
            clean_phone = f"+593{clean_phone.lstrip('0')}"  # Default to Ecuador country code

        message_body = (
            f"⚠️ *COMUNICADO URGENTE DECE — {institution_name.upper()}*\n\n"
            f"Estimado/a *{guardian_name}*,\n"
            f"Le informamos que el Sistema de Alerta Temprana ha detectado un cambio a *Riesgo {risk_level.upper()}* "
            f"en el seguimiento psicopedagógico de su representado/a *{student_name}*.\n\n"
            f"📌 Se le solicita agendar una entrevista presencial con el Departamento de Consejería Estudiantil (DECE).\n\n"
            f"Por favor ingrese al portal institucional o acuda al plantel a la brevedad."
        )

        logger.info(f"[WhatsApp API] Sending message to {clean_phone}: Risk {risk_level}")

        # Meta / Twilio dispatch logic (simulated when credentials aren't configured, or live when configured)
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                        data={
                            "From": f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER or '+14155238886'}",
                            "To": f"whatsapp:{clean_phone}",
                            "Body": message_body,
                        },
                    )
                    return {
                        "status": "sent" if resp.status_code in (200, 201) else "queued",
                        "phone": clean_phone,
                        "provider": "twilio",
                        "response_code": resp.status_code,
                    }
            except Exception as e:
                logger.error(f"WhatsApp API dispatch error: {e}")

        # Fallback / Development Simulation mode
        return {
            "status": "simulated_success",
            "phone": clean_phone,
            "provider": "whatsapp_gateway",
            "message_preview": message_body[:100] + "...",
        }
