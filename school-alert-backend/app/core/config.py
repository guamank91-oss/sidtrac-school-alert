from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "SIDTRAC API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/sidtrac"
    CORS_ORIGINS: str = "http://localhost:5173"
    OPENROUTER_API_KEY: str = ""
    RESEND_API_KEY: str = ""
    RAG_MODEL: str = "openai/gpt-4o-mini"
    CHROMA_COLLECTION: str = "sidtrac_documents_v2"
    AI_PROVIDER_ENABLED: bool = True
    AI_MINIMIZATION_ENABLED: bool = True
    FEATURE_DECE_CASES: bool = False
    FEATURE_ACTION_PLANS: bool = False
    STUDENT_REF_HMAC_SECRET: str = ""
    PROFESSIONAL_ACCESS_USER_IDS: str = ""

    @property
    def sync_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
