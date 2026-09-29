"""Nexa Quant Engine — Centralized Environment & Configuration.

Tracks, validates, and exports all engine settings and credentials
to prevent scattered hardcoded values and maintain high security.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly load .env from engine directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


class Config:
    """Centralized configuration for Nexa Quant Engine."""

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "3002"))

    # CORS Allowed Origins
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,*",
        ).split(",")
        if origin.strip()
    ]

    # Railway deployment: use PORT env injected by Railway
    # No changes needed — PORT already reads from os.getenv("PORT", "3002")

    # Binance API credentials (optional for public endpoints)
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "")
    BINANCE_SECRET_KEY: str = os.getenv("BINANCE_SECRET_KEY", "")

    # Market data provider endpoints
    FEAR_GREED_URL: str = os.getenv(
        "FEAR_GREED_URL", "https://api.alternative.me/fng/?limit=1"
    )

    @classmethod
    def get_binance_headers(cls) -> dict[str, str]:
        """Return headers with API key if configured."""
        headers: dict[str, str] = {}
        if cls.BINANCE_API_KEY:
            headers["X-MBX-APIKEY"] = cls.BINANCE_API_KEY
        return headers


config = Config()
