# IslePlace Converter

Free private file converter: HEIC/JPG/PNG/WebP, PDF tools, voice messages to MP3.

| App | Path | Stack | Where |
|---|---|---|---|
| Website (+ PWA, + Android via Capacitor) | [`apps/web`](apps/web) | Astro + React + TypeScript, conversion in the browser (WebAssembly) | https://convert.isleplace.com |
| Telegram bot (+ Mini App) | [`apps/bot`](apps/bot) | Python + aiogram, server-side conversion | Telegram |

Each app has its own README with run, test and deploy instructions. CI runs both on every push.

## License

MIT
