# IslePlace Converter — Telegram bot

Python + aiogram 3. Converts files sent to the bot **on the server** and deletes them right after the reply;
the "Open converter" button (Mini App) opens [convert.isleplace.com](https://convert.isleplace.com) inside Telegram,
where files never leave the phone.

| User sends | Bot does | Library |
|---|---|---|
| Voice message / audio file (OGG/Opus, M4A, WAV…) | → MP3 64 kbps, right away | ffmpeg |
| Photo as a file (HEIC, PNG, WebP, JPG) | buttons: To JPG / Compress (q75, ≤ 2560 px) | Pillow + pillow-heif |
| Photo (already compressed by Telegram) | hint "send as a file" + Compress | Pillow |
| PDF | buttons: Compress (rasterize, only if smaller) / To images / Split pages | PyMuPDF |
| File > 20 MB (Bot API limit) | explains the limit, opens the Mini App on the right tool | — |

Results come back with "2,4 MB → 640 KB (−73%)"; several pages come as an album (≤ 10) or a ZIP.

## Structure

```
bot/
  __main__.py   start polling, Mini App menu button
  config.py     settings from env (BOT_TOKEN, WEBAPP_URL, WORKERS)
  handlers.py   aiogram router: receive → choose action → convert in a thread → send
  convert.py    pure converters on bytes (unit-tested, no Telegram)
  texts.py      ru / en texts by Telegram language
tests/          converters on real files + handlers with fake Telegram messages
```

CPU-heavy work runs in `asyncio.to_thread` behind a semaphore (`WORKERS`), so the bot keeps answering while a PDF renders.
Buttons carry a short key (`callback_data` ≤ 64 bytes); the file id waits in a small in-memory store (6 h TTL).

## Run locally

```bash
cp .env.example .env      # put the token from @BotFather into BOT_TOKEN
uv sync
uv run python -m bot
```

Needs `ffmpeg` in PATH for audio.

## Tests

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
docker build --target test .   # the same tests inside the production image
```

## Deploy (Docker)

```bash
docker compose up -d --build   # reads .env, 400 MB memory limit, read-only filesystem, /tmp in RAM
docker compose logs -f
```
