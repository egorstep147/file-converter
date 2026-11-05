# Local File Converter

Free online file converter that **runs entirely in the browser**: files never leave the user's device.
Static site, 13 tools × 5 languages (EN, ES, PT, RU, ID) = 65 SEO pages.

| Images | PDF | Audio |
|---|---|---|
| HEIC → JPG, compress, resize, PNG → JPG, WebP → JPG, JPG → PNG, JPG → WebP | Images → PDF, merge, split, PDF → JPG, compress | Voice message (OGG/Opus) → MP3 |

## How it works

```
Astro (build time)                          Browser (run time)
src/pages/[lang]/[tool].astro  ──build──▶   static HTML per tool and language (SEO)
src/components/Converter.tsx   ─island──▶   React UI hydrated only on tool pages
src/lib/*.ts                   ─lazy────▶   converters loaded on demand (WASM)
```

- **Astro** generates plain HTML for every `language × tool` page: titles, descriptions, `hreflang`, JSON-LD (WebApplication + FAQPage), `sitemap-index.xml`.
- **React island** (`Converter.tsx`) is the only interactive part: file picker, options, progress, downloads, ZIP.
- **Converters** (`src/lib/`) are imported dynamically, so the HEIC decoder (3 MB WASM) loads only on pages that need it.

| Task | Library | Where |
|---|---|---|
| JPG / PNG / WebP encode, resize | Canvas API (`createImageBitmap`, `toBlob`) | `lib/image.ts` |
| HEIC decode | [heic-to](https://github.com/hoppergee/heic-to) (libheif → WASM) | `lib/image.ts` |
| Merge / split / images → PDF | [pdf-lib](https://pdf-lib.js.org) | `lib/pdf.ts` |
| PDF → images, PDF compression | [pdf.js](https://mozilla.github.io/pdf.js/) (render) + pdf-lib (rebuild) | `lib/pdf.ts` |
| Ogg/Opus decode | [ogg-opus-decoder](https://github.com/eshaz/wasm-audio-decoders) (WASM, works in Safari) | `lib/audio.ts` |
| MP3 encode | [@breezystack/lamejs](https://github.com/breezystack/lamejs) | `lib/audio.ts` |
| ZIP | [fflate](https://github.com/101arrowz/fflate) | `lib/files.ts` |

Known limits: PDF compression rasterizes pages (text stops being selectable — the UI says so, and the original is kept if the result is not smaller); Safari may not encode WebP (the UI shows a clear error).

## Run locally

```bash
npm install
npm run dev          # http://localhost:4321
```

## Tests

```bash
npm test             # unit: ranges, sizes, PDF merge/split, Opus → MP3, i18n completeness and SEO lengths
npx playwright install chromium
npm run test:e2e     # real conversions in Chromium for every tool + SEO tags
npm run check        # TypeScript / Astro type check
```

Fixtures live in `tests/fixtures/`. Images and audio were generated with ffmpeg (`testsrc2`, `sine` → libopus), the HEIC with pillow-heif, PDFs with `npm run fixtures`.

CI (`.github/workflows/ci.yml`) runs type check, unit and e2e tests on every push.

## Add a tool or a language

- **Tool:** add an entry to `src/tools.ts`, a runner case in `src/lib/run.ts` (and options UI in `Converter.tsx` if needed), texts in every `src/i18n/*.ts`. TypeScript fails the build until every language has the texts.
- **Language:** copy `src/i18n/en.ts` to `src/i18n/<code>.ts` (typed as `Dict`), register it in `src/i18n/index.ts` and in the sitemap `locales` in `astro.config.mjs`.

## Deploy (Cloudflare Pages)

The site is fully static (`dist/`).

```bash
npx wrangler login   # once, opens the browser
npm run deploy       # build + upload to the "local-file-converter" Pages project
```

Set `SITE_URL` when building for a custom domain (used in canonical/hreflang links and the sitemap), and update `public/robots.txt`.

## License

MIT
