from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    secret_key: str = "dev-secret-key-change-in-production"
    base_url: str = "http://localhost:8000"
    environment: str = "development"

    database_url: str = "sqlite+aiosqlite:///./busalert.db"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        # Render gives postgres://, SQLAlchemy async needs postgresql+asyncpg://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    anthropic_api_key: str = ""

    frontend_url: str = ""  # e.g. https://bus-alert-web.onrender.com

    owner_name: str = "Shikha Chaudhary"
    owner_title: str = "Transport Manager"

    school_name: str = "Seth M R Jaipuria School Bhiwadi"
    school_phone: str = "+91XXXXXXXXXX"

    max_retry_attempts: int = 5
    retry_delay_seconds: int = 30
    call_timeout_seconds: int = 30

    # call_provider: "mock" | "twilio" | "exotel"
    call_provider: str = "mock"

    # Exotel (Indian telephony)
    exotel_account_sid: str = ""
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_phone_number: str = ""  # ExoPhone e.g. 09XXXXXXXXX

    # Bolna AI (Indian AI voice agent)
    bolna_api_key: str = ""
    bolna_agent_id: str = ""
    bolna_phone_number: str = ""  # from_phone_number registered on Bolna

    sentry_dsn: str = ""  # Set to enable error monitoring

    local_mode: bool = False  # True = no Twilio, no Redis, no Anthropic needed

    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
