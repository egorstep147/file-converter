"""Telegram handlers: receive a file → (choose an action) → convert in a worker thread → send back."""

from __future__ import annotations

import asyncio
import io
import logging
import secrets
import time
from collections import OrderedDict
from dataclasses import dataclass

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputMediaDocument,
    Message,
    WebAppInfo,
)

from . import convert
from .config import Config
from .texts import site_lang, t

log = logging.getLogger(__name__)
router = Router()


@dataclass
class Pending:
    file_id: str
    name: str
    kind: str
    size: int
    created: float


class PendingStore:
    """Files waiting for the user's choice. callback_data is limited to 64 bytes, so buttons carry a short key."""

    def __init__(self, limit: int = 2000, ttl: float = 6 * 3600):
        self.items: OrderedDict[str, Pending] = OrderedDict()
        self.limit, self.ttl = limit, ttl

    def put(self, p: Pending) -> str:
        key = secrets.token_urlsafe(6)
        self.items[key] = p
        while len(self.items) > self.limit:
            self.items.popitem(last=False)
        return key

    def get(self, key: str) -> Pending | None:
        p = self.items.get(key)
        if p and time.time() - p.created > self.ttl:
            del self.items[key]
            return None
        return p


pending = PendingStore()


def app_button(cfg: Config, code: str | None, tool: str = "") -> InlineKeyboardButton:
    url = f"{cfg.webapp_url}/{site_lang(code)}/{tool + '/' if tool else ''}"
    return InlineKeyboardButton(text=t(code, "open_app"), web_app=WebAppInfo(url=url))


def actions_keyboard(code: str | None, key: str, kind: str) -> InlineKeyboardMarkup:
    if kind == "image":
        row = [("to_jpg", "jpg"), ("compress", "cmp")]
    else:  # pdf
        row = [("compress", "pcmp"), ("pdf_jpg", "pjpg"), ("pdf_split", "psplit")]
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=t(code, label), callback_data=f"do:{act}:{key}") for label, act in row]
        ]
    )


@router.message(CommandStart())
async def start(m: Message, cfg: Config) -> None:
    code = m.from_user.language_code if m.from_user else None
    await m.answer(t(code, "start"), reply_markup=InlineKeyboardMarkup(inline_keyboard=[[app_button(cfg, code)]]))


async def too_big(m: Message, cfg: Config, size: int, tool: str) -> bool:
    if size <= cfg.max_download_mb * 1024 * 1024:
        return False
    code = m.from_user.language_code if m.from_user else None
    await m.answer(
        t(code, "too_big", size=convert.human(size)),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[app_button(cfg, code, tool)]]),
    )
    return True


async def download(bot: Bot, file_id: str) -> bytes:
    buf = io.BytesIO()
    await bot.download(file_id, destination=buf)
    return buf.getvalue()


async def run_cpu(sem: asyncio.Semaphore, fn, *args):
    async with sem:
        return await asyncio.to_thread(fn, *args)


@router.message(F.voice | F.audio)
async def on_audio(m: Message, bot: Bot, cfg: Config, sem: asyncio.Semaphore) -> None:
    f = m.voice or m.audio
    code = m.from_user.language_code if m.from_user else None
    name = getattr(f, "file_name", None) or "voice.ogg"
    if await too_big(m, cfg, f.file_size or 0, "ogg-to-mp3"):
        return
    await process(m, bot, sem, code, "audio", f.file_id, name, "mp3")


@router.message(F.photo)
async def on_photo(m: Message, cfg: Config) -> None:
    photo = m.photo[-1]
    code = m.from_user.language_code if m.from_user else None
    key = pending.put(Pending(photo.file_id, "photo.jpg", "image", photo.file_size or 0, time.time()))
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=t(code, "compress"), callback_data=f"do:cmp:{key}")]]
    )
    await m.answer(t(code, "photo_hint"), reply_markup=kb)


@router.message(F.document)
async def on_document(m: Message, bot: Bot, cfg: Config, sem: asyncio.Semaphore) -> None:
    d = m.document
    code = m.from_user.language_code if m.from_user else None
    kind = convert.kind_of(d.file_name or "", d.mime_type)
    if kind is None:
        await m.answer(
            t(code, "unsupported"), reply_markup=InlineKeyboardMarkup(inline_keyboard=[[app_button(cfg, code)]])
        )
        return
    tool = {"image": "compress-image", "pdf": "compress-pdf", "audio": "ogg-to-mp3"}[kind]
    if await too_big(m, cfg, d.file_size or 0, tool):
        return
    if kind == "audio":  # one obvious action: convert right away
        await process(m, bot, sem, code, "audio", d.file_id, d.file_name or "audio", "mp3")
        return
    key = pending.put(Pending(d.file_id, d.file_name or "file", kind, d.file_size or 0, time.time()))
    await m.answer(t(code, "choose", name=d.file_name or "file"), reply_markup=actions_keyboard(code, key, kind))


@router.callback_query(F.data.startswith("do:"))
async def on_action(cb: CallbackQuery, bot: Bot, sem: asyncio.Semaphore) -> None:
    _, act, key = (cb.data or "::").split(":", 2)
    code = cb.from_user.language_code
    p = pending.get(key)
    await cb.answer()
    if not p or not isinstance(cb.message, Message):
        if isinstance(cb.message, Message):
            await cb.message.answer(t(code, "expired"))
        return
    await cb.message.edit_reply_markup(reply_markup=None)  # one action per press, no double clicks
    await process(cb.message, bot, sem, code, p.kind, p.file_id, p.name, act)


async def process(
    m: Message, bot: Bot, sem: asyncio.Semaphore, code: str | None, kind: str, file_id: str, name: str, act: str
) -> None:
    status = await m.answer(t(code, "working"))
    base = convert.stem(name)
    try:
        data = await download(bot, file_id)
        before = len(data)
        if act == "mp3":
            out = await run_cpu(sem, convert.audio_to_mp3, data)
            await send_one(m, code, f"{base}.mp3", out, before)
        elif act in ("jpg", "cmp"):
            fn = convert.to_jpeg if act == "jpg" else convert.compress_image
            out = await run_cpu(sem, fn, data)
            await send_one(m, code, f"{base}{'' if act == 'jpg' else '-compressed'}.jpg", out, before)
        elif act == "pcmp":
            out = await run_cpu(sem, convert.pdf_compress, data)
            if out is None:
                await m.answer(t(code, "not_smaller"))
            else:
                await send_one(m, code, f"{base}-compressed.pdf", out, before)
        elif act in ("pjpg", "psplit"):
            if act == "pjpg":
                pages = await run_cpu(sem, convert.pdf_to_jpegs, data)
                files = [(f"{base}-{i + 1}.jpg", b) for i, b in enumerate(pages)]
            else:
                pages = await run_cpu(sem, convert.pdf_split, data)
                files = [(f"{base}-page-{i + 1}.pdf", b) for i, b in enumerate(pages)]
            await send_many(m, code, base, files)
        else:
            raise ValueError(act)
    except Exception:
        # never log file contents; the name is enough to debug
        log.exception("conversion failed: act=%s name=%s", act, name)
        await m.answer(t(code, "error"))
    finally:
        await status.delete()


async def send_one(m: Message, code: str | None, name: str, data: bytes, before: int) -> None:
    caption = t(
        code,
        "done",
        before=convert.human(before),
        after=convert.human(len(data)),
        pct=convert.change(before, len(data)),
    )
    await m.answer_document(BufferedInputFile(data, filename=name), caption=caption)


async def send_many(m: Message, code: str | None, base: str, files: list[tuple[str, bytes]]) -> None:
    if len(files) == 1:
        await m.answer_document(BufferedInputFile(files[0][1], filename=files[0][0]), caption=t(code, "done_plain"))
    elif len(files) <= 10:  # an album of documents opens right in the chat
        # aiogram types are immutable: the caption (shown under the album) goes on the last item at creation
        last = len(files) - 1
        media = [
            InputMediaDocument(
                media=BufferedInputFile(b, filename=n), caption=t(code, "done_plain") if i == last else None
            )
            for i, (n, b) in enumerate(files)
        ]
        await m.answer_media_group(media)
    else:
        await m.answer(t(code, "pages_zip"))
        await m.answer_document(
            BufferedInputFile(convert.zip_files(files), filename=f"{base}.zip"), caption=t(code, "done_plain")
        )
