"""Mini App "Send to chat": signature check, CORS, file goes to the right user."""

import hashlib
import hmac
import json
import time
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import urlencode

import aiohttp
from aiohttp.test_utils import TestClient, TestServer

from bot.config import Config
from bot.webapp import make_app

TOKEN = "123456:TEST"
CFG = Config(bot_token=TOKEN)


def sign(user_id=42, lang="ru", age=0, token=TOKEN) -> str:
    """initData exactly as Telegram builds it (HMAC with key derived from the bot token)."""
    fields = {
        "auth_date": str(int(time.time()) - age),
        "query_id": "AAE",
        "user": json.dumps({"id": user_id, "first_name": "E", "language_code": lang}),
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


async def client(bot):
    c = TestClient(TestServer(make_app(bot, CFG)))
    await c.start_server()
    return c


def form(data=b"%PDF-1.4 test", name="result.pdf"):
    fd = aiohttp.FormData()
    fd.add_field("file", data, filename=name, content_type="application/pdf")
    return fd


async def test_valid_request_sends_document_to_that_user():
    bot = MagicMock()
    bot.send_document = AsyncMock()
    c = await client(bot)
    try:
        r = await c.post("/api/send", data=form(), headers={"X-Telegram-Init-Data": sign(user_id=777)})
        assert r.status == 200 and (await r.json())["ok"]
        assert r.headers["Access-Control-Allow-Origin"] == "https://convert.isleplace.com"
        chat_id, doc = bot.send_document.call_args.args
        assert chat_id == 777
        assert doc.filename == "result.pdf" and doc.data == b"%PDF-1.4 test"
        assert "IslePlace" in bot.send_document.call_args.kwargs["caption"]
    finally:
        await c.close()


async def test_forged_or_old_init_data_is_refused():
    bot = MagicMock()
    bot.send_document = AsyncMock()
    c = await client(bot)
    try:
        for init in ["", sign(token="999:OTHER"), sign(age=3 * 24 * 3600), sign() + "x"]:
            r = await c.post("/api/send", data=form(), headers={"X-Telegram-Init-Data": init})
            assert r.status == 401
        bot.send_document.assert_not_called()
    finally:
        await c.close()


async def test_cors_preflight_and_missing_file():
    bot = MagicMock()
    bot.send_document = AsyncMock()
    c = await client(bot)
    try:
        r = await c.options("/api/send")
        assert r.status == 204 and "X-Telegram-Init-Data" in r.headers["Access-Control-Allow-Headers"]
        fd = aiohttp.FormData()
        fd.add_field("other", "x")
        r = await c.post("/api/send", data=fd, headers={"X-Telegram-Init-Data": sign()})
        assert r.status == 400
    finally:
        await c.close()
