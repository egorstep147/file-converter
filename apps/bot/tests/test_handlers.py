"""Handlers with fake Telegram objects: routing, limits, pending buttons, what gets sent back."""

import asyncio
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from aiogram.types import BufferedInputFile, Message

from bot import handlers
from bot.config import Config
from bot.texts import lang_of, site_lang, t

FX = Path(__file__).parent / "fixtures"
CFG = Config(bot_token="test")


def fake_message(lang="ru", **fields):
    m = MagicMock(spec=Message)
    m.from_user = SimpleNamespace(language_code=lang)
    status = MagicMock()
    status.delete = AsyncMock()
    m.answer = AsyncMock(return_value=status)
    m.answer_document = AsyncMock()
    m.answer_media_group = AsyncMock()
    for k, v in fields.items():
        setattr(m, k, v)
    return m


@pytest.fixture
def files(monkeypatch):
    """bot.download returns the fixture whose name is used as file_id."""

    async def fake_download(bot, file_id):
        return (FX / file_id).read_bytes()

    monkeypatch.setattr(handlers, "download", fake_download)


def sent_names(m) -> list[str]:
    names = []
    for call in m.answer_document.call_args_list:
        f = call.args[0]
        assert isinstance(f, BufferedInputFile)
        names.append(f.filename)
    for call in m.answer_media_group.call_args_list:
        names += [x.media.filename for x in call.args[0]]
    return names


def test_texts_and_languages():
    assert lang_of("uk") == "ru" and lang_of("de") == "en" and lang_of(None) == "en"
    assert site_lang("pt-br") == "pt" and site_lang("kk") == "ru" and site_lang("fr") == "en"
    assert "IslePlace" in t("ru", "start") and "IslePlace" in t("en", "start")


def test_pending_store_short_keys_ttl_and_limit():
    s = handlers.PendingStore(limit=2, ttl=10)
    k1 = s.put(handlers.Pending("a", "a.pdf", "pdf", 1, time.time()))
    assert len(f"do:psplit:{k1}".encode()) <= 64  # Telegram callback_data limit
    k2 = s.put(handlers.Pending("b", "b.pdf", "pdf", 1, time.time() - 100))
    assert s.get(k2) is None  # expired
    s.put(handlers.Pending("c", "c.pdf", "pdf", 1, time.time()))
    s.put(handlers.Pending("d", "d.pdf", "pdf", 1, time.time()))
    assert s.get(k1) is None  # evicted by the limit


async def test_heic_to_jpg(files):
    m = fake_message()
    await handlers.process(m, None, asyncio.Semaphore(1), "ru", "image", "photo.heic", "IMG_2870.HEIC", "jpg")
    assert sent_names(m) == ["IMG_2870.jpg"]
    assert "Готово" in m.answer_document.call_args.kwargs["caption"]


async def test_voice_to_mp3(files):
    import shutil

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    m = fake_message("en")
    await handlers.process(m, None, asyncio.Semaphore(1), "en", "audio", "voice.ogg", "voice.ogg", "mp3")
    assert sent_names(m) == ["voice.mp3"]


async def test_pdf_split_is_sent_as_album(files):
    m = fake_message()
    await handlers.process(m, None, asyncio.Semaphore(1), "ru", "pdf", "text.pdf", "text.pdf", "psplit")
    assert sent_names(m) == ["text-page-1.pdf", "text-page-2.pdf", "text-page-3.pdf"]


async def test_pdf_compress_not_smaller_says_so(files):
    m = fake_message()
    await handlers.process(m, None, asyncio.Semaphore(1), "ru", "pdf", "text.pdf", "text.pdf", "pcmp")
    assert sent_names(m) == []
    assert any("оптимизирован" in c.args[0] for c in m.answer.call_args_list)


async def test_broken_file_gives_error_and_removes_status(files, tmp_path, monkeypatch):
    async def broken(bot, file_id):
        return b"not a pdf"

    monkeypatch.setattr(handlers, "download", broken)
    m = fake_message()
    await handlers.process(m, None, asyncio.Semaphore(1), "ru", "pdf", "x", "x.pdf", "pjpg")
    assert any("Не получилось" in c.args[0] for c in m.answer.call_args_list)
    m.answer.return_value.delete.assert_awaited()  # "Обрабатываю…" is always removed


async def test_document_too_big_offers_mini_app():
    doc = SimpleNamespace(file_name="big.pdf", mime_type="application/pdf", file_size=30 * 1024 * 1024, file_id="x")
    m = fake_message(document=doc)
    await handlers.on_document(m, None, CFG, asyncio.Semaphore(1))
    text = m.answer.call_args.args[0]
    kb = m.answer.call_args.kwargs["reply_markup"]
    assert "20 MB" in text
    assert kb.inline_keyboard[0][0].web_app.url == "https://convert.isleplace.com/ru/compress-pdf/"


async def test_pdf_document_shows_actions():
    doc = SimpleNamespace(file_name="scan.pdf", mime_type="application/pdf", file_size=1000, file_id="scan.pdf")
    m = fake_message("en", document=doc)
    await handlers.on_document(m, None, CFG, asyncio.Semaphore(1))
    kb = m.answer.call_args.kwargs["reply_markup"]
    assert [b.text for b in kb.inline_keyboard[0]] == ["🗜 Compress", "🖼 To images", "✂️ Split pages"]
