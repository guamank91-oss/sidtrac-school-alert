from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = settings.RAG_MODEL or "openai/gpt-4o-mini"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sidtrac.local",
        "X-Title": "SIDTRAC",
    }


async def chat_completion_stream(
    messages: list[dict],
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    timeout: float = 60.0,
) -> AsyncIterator[str]:
    """Yield text deltas from OpenRouter. Raises if the stream cannot be started."""
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY no configurada")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST", OPENROUTER_URL, json=payload, headers=_headers()
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or line.startswith(":"):
                    continue
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    obj = json.loads(data_str)
                    delta = obj["choices"][0]["delta"].get("content")
                except (KeyError, IndexError, ValueError, TypeError):
                    continue
                if delta:
                    yield delta


async def chat_completion(
    messages: list[dict],
    *,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    timeout: float = 30.0,
) -> tuple[str | None, int | None, str | None]:
    """Returns (content, total_tokens, error)."""
    if not settings.OPENROUTER_API_KEY:
        return None, None, "OPENROUTER_API_KEY no configurada"

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sidtrac.local",
        "X-Title": "SIDTRAC",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            tokens = (data.get("usage") or {}).get("total_tokens")
            return content, tokens, None
    except Exception as exc:
        logger.warning("OpenRouter call failed: %s", exc)
        return None, None, str(exc)
