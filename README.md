# IslePlace Converter

Free private file converter: HEIC/JPG/PNG/WebP, PDF tools, voice messages to MP3 — on the web, as an installable app and in Telegram.

```
                       ┌──────────────────────────── apps/web (Astro + React + TS) ──────────────────────────┐
 Browser / Google ───► │ site convert.isleplace.com  ─ 13 tools × 5 languages, conversion in the browser (WASM) │
 "Install app"   ───► │ PWA: offline, Android Share sheet → /share/ → tool                                    │
 Google Play*    ───► │ android/ (Capacitor): same build inside an APK, results via the system share sheet    │
                       └──────────────────────────────────────────▲──────────────────────────────────────────────┘
                                                                  │ Mini App (WebView) + "Send to chat"
 Telegram ───► apps/bot (Python + aiogram) ─ files sent to the bot are converted on the server (ffmpeg, Pillow,
               PyMuPDF) and deleted; /api/send checks Telegram's signature and delivers Mini App results to the chat
```
\* the APK builds and runs; publishing to Google Play is a separate step.

| App | Path | Stack | Tests |
|---|---|---|---|
| Website + PWA + Android | [`apps/web`](apps/web) | Astro, React, TypeScript, WebAssembly, Capacitor | Vitest + Playwright (real conversions, offline, share target, Mini App) |
| Telegram bot | [`apps/bot`](apps/bot) | Python, aiogram, aiohttp, ffmpeg, Pillow, PyMuPDF, Docker | pytest (converters, handlers, signed endpoint) |

CI (`.github/workflows/ci.yml`) runs both apps on every push, including the bot tests inside its production Docker image.

**Privacy:** on the site, in the PWA and in the Android app files never leave the device. Files sent *to the bot* are processed on the server and deleted right after the reply; in the Mini App only the result you choose to "Send to chat" goes through the bot. Both are stated in the UI.

## License

MIT
