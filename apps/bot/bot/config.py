"""Settings from environment variables (see .env.example). Never log the token."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    bot_token: str
    webapp_url: str = "https://convert.isleplace.com"
    # Bot API (cloud) limits: download up to 20 MB, upload up to 50 MB
    max_download_mb: int = 20
    max_upload_mb: int = 50
    # CPU-heavy work (PDF rendering, ffmpeg) at once; the VPS has 1 vCPU
    workers: int = 2


def load() -> Config:
    token = os.environ.get("BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("BOT_TOKEN is not set (copy .env.example to .env and fill it in)")
    return Config(
        bot_token=token,
        webapp_url=os.environ.get("WEBAPP_URL", Config.webapp_url).rstrip("/"),
        workers=int(os.environ.get("WORKERS", Config.workers)),
    )
