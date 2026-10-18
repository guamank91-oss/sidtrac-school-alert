from __future__ import annotations

import logging
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SIDTRAC API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/sidtrac"
    CORS_ORIGINS: str = "http://localhost:5173"
    OPENROUTER_API_KEY: str = ""
    RESEND_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""
    RAG_MODEL: str = "openai/gpt-4o-mini"
    CHROMA_COLLECTION: str = "sidtrac_documents_v2"
    AI_PROVIDER_ENABLED: bool = True
    AI_MINIMIZATION_ENABLED: bool = True
    FEATURE_DECE_CASES: bool = False
    FEATURE_ACTION_PLANS: bool = False
    STUDENT_REF_HMAC_SECRET: str = "change-me-student-ref"
    PROFESSIONAL_ACCESS_USER_IDS: str = ""

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() in {"production", "prod", "staging"}

    @property
    def sync_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self) -> Settings:
        if self.is_production:
            insecure_secrets = {"change-me", "change-me-in-production", "secret", "123456", ""}
            if self.SECRET_KEY in insecure_secrets:
                raise ValueError(
                    "[SECURITY FATAL] SECRET_KEY must be set to a strong random secret in production!"
                )
            if self.STUDENT_REF_HMAC_SECRET in insecure_secrets:
                raise ValueError(
                    "[SECURITY FATAL] STUDENT_REF_HMAC_SECRET must be set to a strong random secret in production!"
                )
        return self


settings = Settings()
