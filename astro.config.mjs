// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Public URL of the site: used for canonical/hreflang links and sitemap.xml.
// Override with SITE_URL when the site gets its own domain.
const site = process.env.SITE_URL ?? 'https://local-file-converter.file-converter.workers.dev';

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page) && new URL(page).pathname !== '/',
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', pt: 'pt', ru: 'ru', id: 'id' } },
    }),
  ],
  vite: {
    // WASM decoders are loaded on demand; keep them out of dependency pre-bundling
    optimizeDeps: { exclude: ['heic-to', 'ogg-opus-decoder'] },
  },
});
