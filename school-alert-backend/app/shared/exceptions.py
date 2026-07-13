from __future__ import annotations

class DomainError(Exception):
    def __init__(self, message: str, code: str = "domain_error"):
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(DomainError):
    def __init__(self, resource: str):
        super().__init__(f"{resource} no encontrado", code="not_found")


class UnauthorizedError(DomainError):
    def __init__(self, message: str = "No autorizado"):
        super().__init__(message, code="unauthorized")


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Acceso denegado"):
        super().__init__(message, code="forbidden")


class ValidationError(DomainError):
    def __init__(self, message: str):
        super().__init__(message, code="validation_error")


def http_status_for(exc: DomainError) -> int:
    return {
        "not_found": 404,
        "unauthorized": 401,
        "forbidden": 403,
        "AI_PROVIDER_DISABLED": 503,
    }.get(exc.code, 400)
