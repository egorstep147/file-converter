// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Public URL of the site: used for canonical/hreflang links and sitemap.xml.
// Override with SITE_URL to build for another domain.
const site = process.env.SITE_URL ?? 'https://convert.isleplace.com';

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/(404|share)\/?$/.test(page) && new URL(page).pathname !== '/',
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en', es: 'es', pt: 'pt', ru: 'ru', id: 'id',
          de: 'de', fr: 'fr', ja: 'ja', ko: 'ko', tr: 'tr',
          zh: 'zh-Hans', hi: 'hi', ar: 'ar', it: 'it', pl: 'pl',
          nl: 'nl', vi: 'vi', th: 'th', uk: 'uk', cs: 'cs',
          sv: 'sv', ro: 'ro', el: 'el', hu: 'hu', ms: 'ms',
        },
      },
    }),
  ],
  vite: {
    // WASM decoders are loaded on demand; keep them out of dependency pre-bundling
    optimizeDeps: { exclude: ['heic-to', 'ogg-opus-decoder'] },
  },
});
