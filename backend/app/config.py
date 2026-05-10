"""
Application configuration loaded from environment variables.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    KIMI_API_KEY: str = os.getenv("KIMI_API_KEY", "")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    VOLC_API_KEY: str = os.getenv("VOLC_API_KEY", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 168
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./backend/data/app.db"
    )


settings = Settings()
