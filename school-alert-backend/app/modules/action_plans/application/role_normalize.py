"""Normalize AI/free-text plan roles to SIDTRAC role codes."""
from __future__ import annotations

_ROLE_ALIASES: dict[str, str] = {
    "dece": "dece",
    "psicologo": "dece",
    "psicologo del dece": "dece",
    "psicóloga": "dece",
    "psicologa": "dece",
    "psicologa del dece": "dece",
    "orientador": "dece",
    "orientadora": "dece",
    "tutor": "tutor",
    "tutora": "tutor",
    "tutor del curso": "tutor",
    "docente": "docente",
    "profesor": "docente",
    "profesora": "docente",
    "maestro": "docente",
    "maestra": "docente",
    "inspector": "dece",
    "inspectora": "dece",
    "administrador": "administrador",
    "representante": "representante",
}

_ALLOWED = {"dece", "tutor", "docente", "administrador", "representante"}


def normalize_plan_role(raw: str | None, *, default: str = "dece") -> str:
    """Map labels like 'Tutor' / 'Psicólogo del DECE' to API role codes."""
    if not raw or not str(raw).strip():
        return default
    text = str(raw).strip().lower()
    # strip accents for alias lookup
    trans = str.maketrans("áéíóúüñ", "aeiouun")
    key = text.translate(trans)
    if key in _ROLE_ALIASES:
        return _ROLE_ALIASES[key]
    if key in _ALLOWED:
        return key
    for alias, code in _ROLE_ALIASES.items():
        if alias in key:
            return code
    return default


def normalize_supporting_roles(raw: list[str] | str | None) -> list[str]:
    if raw is None:
        return []
    values = raw if isinstance(raw, list) else [p.strip() for p in str(raw).split(",") if p.strip()]
    out: list[str] = []
    for v in values:
        code = normalize_plan_role(v, default="")
        if code and code not in out:
            out.append(code)
    return out
