"""HTTP endpoint for the Mini App: "Send to chat".

Inside Telegram the WebView often can't download blob: files, so the converter page POSTs the
result here; we check that the request really comes from our Mini App (Telegram-signed initData)
and send the file to that user's chat. The file lives only in memory during the request.
"""

from __future__ import annotations

import logging
import time

from aiogram import Bot
from aiogram.types import BufferedInputFile
from aiogram.utils.web_app import safe_parse_webapp_init_data
from aiohttp import web

from .config import Config
from .texts import t

log = logging.getLogger(__name__)
MAX_AGE = 24 * 3600  # initData older than a day is refused


def cors_headers(cfg: Config) -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": cfg.webapp_url,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "X-Telegram-Init-Data",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }


def make_app(bot: Bot, cfg: Config) -> web.Application:
    app = web.Application(client_max_size=cfg.max_upload_mb * 1024 * 1024)
    headers = cors_headers(cfg)

    async def preflight(_: web.Request) -> web.Response:
        return web.Response(status=204, headers=headers)

    async def send(request: web.Request) -> web.Response:
        def fail(status: int, msg: str) -> web.Response:
            return web.json_response({"ok": False, "error": msg}, status=status, headers=headers)

        try:
            data = safe_parse_webapp_init_data(cfg.bot_token, request.headers.get("X-Telegram-Init-Data", ""))
        except ValueError:
            return fail(401, "bad init data")
        if not data.user or time.time() - data.auth_date.timestamp() > MAX_AGE:
            return fail(401, "expired")
        if not request.content_type.startswith("multipart/"):
            return fail(400, "multipart/form-data expected")
        reader = await request.multipart()
        field = await reader.next()
        if field is None or field.name != "file":
            return fail(400, "no file")
        name = (field.filename or "file").replace("/", "_")[:120]
        content = await field.read(decode=False)
        await bot.send_document(
            data.user.id,
            BufferedInputFile(bytes(content), filename=name),
            caption=t(data.user.language_code, "from_app"),
        )
        log.info("mini app: sent %s (%d bytes) to user", name, len(content))
        return web.json_response({"ok": True}, headers=headers)

    app.router.add_route("OPTIONS", "/api/send", preflight)
    app.router.add_post("/api/send", send)

    async def health(_: web.Request) -> web.Response:
        return web.json_response({"ok": True})

    app.router.add_get("/health", health)
    return app
