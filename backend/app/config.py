import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env")


def _bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    APP_NAME: str = "Medicine Shortage Tracker"
    APP_VERSION: str = "1.0.0"

    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-9f8e7d6c5b4a3210")
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # SQLite by default; switch to MySQL/PostgreSQL via DATABASE_URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'backend' / 'medicine_shortage.db'}",
    )

    EXPIRY_WARNING_DAYS: int = int(os.getenv("EXPIRY_WARNING_DAYS", "30"))
    PREDICTION_HISTORY_DAYS: int = int(os.getenv("PREDICTION_HISTORY_DAYS", "120"))
    LEAD_TIME_DAYS: int = int(os.getenv("LEAD_TIME_DAYS", "7"))
    SAFETY_STOCK_FACTOR: float = float(os.getenv("SAFETY_STOCK_FACTOR", "1.5"))

    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]

    SEED_ON_STARTUP: bool = _bool(os.getenv("SEED_ON_STARTUP", "true"))

    DEMO_USERNAME: str = os.getenv("DEMO_USERNAME", "admin")
    DEMO_EMAIL: str = os.getenv("DEMO_EMAIL", "admin@medtrack.local")
    DEMO_PASSWORD: str = os.getenv("DEMO_PASSWORD", "admin123")

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


settings = Settings()
