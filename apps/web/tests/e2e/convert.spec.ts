import { expect, test, type Page } from '@playwright/test';

const fx = (name: string) => `tests/fixtures/${name}`;

/** Upload, convert, return [name, size, first bytes as hex] of every output link. */
async function convert(page: Page, path: string, files: string[], setup?: () => Promise<void>) {
  await page.goto(path);
  // Astro removes the "ssr" attribute once React has hydrated the island
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.getByTestId('file-input').setInputFiles(files.map(fx));
  await setup?.();
  await page.locator('.actions .btn.primary').click();
  const results = page.getByTestId('results');
  await expect(results).toBeVisible({ timeout: 45_000 });
  return results.locator('a[download]').evaluateAll(async (links) =>
    Promise.all(
      (links as HTMLAnchorElement[]).map(async (a) => {
        const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
        const head = Array.from(buf.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
        return { name: a.download, size: buf.length, head };
      }),
    ),
  );
}

const JPG = 'ffd8ff';
const PNG = '89504e47';
const PDF = '25504446';
const RIFF = '52494646'; // WebP container

test('HEIC to JPG', async ({ page }) => {
  const [out] = await convert(page, '/en/heic-to-jpg/', ['photo.heic']);
  expect(out.name).toBe('photo.jpg');
  expect(out.head.startsWith(JPG)).toBe(true);
});

test('compress image makes it smaller and shows the saving', async ({ page }) => {
  const [out] = await convert(page, '/en/compress-image/', ['photo.png']);
  expect(out.name).toBe('photo-compressed.jpg');
  expect(out.size).toBeLessThan(191_228);
  // per-file status, summary "Done: 1 of 1" and "187 KB → ... (−NN%)"
  await expect(page.locator('.files li[data-status=done]')).toHaveCount(1);
  await expect(page.getByTestId('summary')).toContainText('Done: 1 of 1');
  await expect(page.getByTestId('summary')).toContainText(/Total size: 187 KB → .+ \(−\d+%\)/);
  await expect(page.getByTestId('results').locator('.badge.ok')).toHaveText(/^−\d+%$/);
});

test('after choosing files the drop zone collapses into "Add more files"', async ({ page }) => {
  await page.goto('/en/heic-to-jpg/');
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.getByTestId('file-input').setInputFiles(fx('photo.heic'));
  await expect(page.getByTestId('add-more')).toHaveText(/Add more files/);
  await expect(page.locator('.drop-title')).toHaveCount(0);
  await page.getByTestId('file-input').setInputFiles(fx('photo.jpg'));
  await expect(page.locator('.files li')).toHaveCount(2);
});

test('icon buttons and language picker are at least 44px', async ({ page }) => {
  await page.goto('/en/merge-pdf/');
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.getByTestId('file-input').setInputFiles([fx('text.pdf'), fx('scan.pdf')]);
  for (const box of [await page.locator('.icon').first().boundingBox(), await page.locator('.lang-trigger').boundingBox()]) {
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.lang-trigger').click();
  await expect(page.locator('.lang-menu a')).toHaveCount(60);
  const itemBox = await page.locator('.lang-menu a').first().boundingBox();
  expect(itemBox!.height).toBeGreaterThanOrEqual(44);
  const panelBox = await page.locator('.lang-panel').boundingBox();
  const vp = page.viewportSize()!;
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(vp.width);
  await page.locator('.lang-search').fill('zh');
  await expect(page.locator('.lang-menu a:visible')).toHaveCount(2);
  await expect(page.locator('.lang-menu a:visible').nth(0)).toContainText('简体中文');
  await expect(page.locator('.lang-menu a:visible').nth(1)).toContainText('繁體中文');
  await page.locator('.lang-search').fill('bengali');
  await expect(page.locator('.lang-menu a:visible')).toHaveCount(1);
  await expect(page.locator('.lang-menu a:visible')).toContainText('বাংলা');
  await page.locator('.lang-tab[data-region="mea"]').click();
  await expect(page.locator('.lang-menu a:visible')).toHaveCount(9);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobBox = await page.locator('.lang-panel').boundingBox();
  expect(mobBox!.x).toBeGreaterThanOrEqual(0);
  expect(mobBox!.x + mobBox!.width).toBeLessThanOrEqual(390);
});

test('resize image by pixels', async ({ page }) => {
  await convert(page, '/en/resize-image/', ['photo.jpg'], async () => {
    await page.locator('.options select').selectOption('px');
    await page.locator('.options input[type=number]').first().fill('400');
  });
  const dims = await page.getByTestId('results').locator('a[download]').first().evaluate(async (a: HTMLAnchorElement) => {
    const bmp = await createImageBitmap(await (await fetch(a.href)).blob());
    return [bmp.width, bmp.height];
  });
  expect(dims).toEqual([400, 300]);
});

for (const [slug, input, head] of [
  ['png-to-jpg', 'photo.png', JPG],
  ['webp-to-jpg', 'photo.webp', JPG],
  ['jpg-to-png', 'photo.jpg', PNG],
  ['jpg-to-webp', 'photo.jpg', RIFF],
] as const) {
  test(`format ${slug}`, async ({ page }) => {
    const [out] = await convert(page, `/en/${slug}/`, [input]);
    expect(out.head.startsWith(head)).toBe(true);
  });
}

test('images to PDF', async ({ page }) => {
  const outs = await convert(page, '/en/jpg-to-pdf/', ['photo.jpg', 'photo.heic', 'photo.webp']);
  expect(outs).toHaveLength(1);
  expect(outs[0].head).toBe(PDF);
});

test('merge PDF', async ({ page }) => {
  const outs = await convert(page, '/en/merge-pdf/', ['text.pdf', 'scan.pdf']);
  expect(outs[0].name).toBe('merged.pdf');
  expect(outs[0].head).toBe(PDF);
});

test('split PDF into pages', async ({ page }) => {
  const outs = await convert(page, '/en/split-pdf/', ['text.pdf']);
  expect(outs.map((o) => o.name)).toEqual(['text-page-1.pdf', 'text-page-2.pdf', 'text-page-3.pdf']);
  await expect(page.getByText('Download all (ZIP)')).toBeVisible();
});

test('split PDF: bad range shows an error', async ({ page }) => {
  await convert(page, '/en/split-pdf/', ['text.pdf'], async () => {
    await page.locator('.options select').selectOption('ranges');
    await page.locator('.options input[type=text]').fill('7-9');
  });
  await expect(page.getByText('Check the page numbers')).toBeVisible();
  await expect(page.locator('.files li[data-status=error] .badge.bad')).toHaveCount(1);
});

test('PDF to JPG', async ({ page }) => {
  const outs = await convert(page, '/en/pdf-to-jpg/', ['text.pdf']);
  expect(outs).toHaveLength(3);
  expect(outs.every((o) => o.head.startsWith(JPG))).toBe(true);
});

test('compress PDF', async ({ page }) => {
  const [out] = await convert(page, '/en/compress-pdf/', ['scan.pdf'], async () => {
    await page.locator('.options select').selectOption('strong');
  });
  expect(out.name).toBe('scan-compressed.pdf');
  expect(out.size).toBeLessThan(388_047);
});

test('compress PDF: text-only PDF is kept as is', async ({ page }) => {
  await convert(page, '/en/compress-pdf/', ['text.pdf']);
  await expect(page.getByText('could not be made smaller')).toBeVisible();
});

test('voice message to MP3', async ({ page }) => {
  const [out] = await convert(page, '/en/ogg-to-mp3/', ['voice.ogg']);
  expect(out.name).toBe('voice.mp3');
  expect(out.head.startsWith('fff')).toBe(true);
});

test('pages: SEO tags, hreflang, other languages render', async ({ page }) => {
  await page.goto('/ru/heic-to-jpg/');
  await expect(page.locator('h1')).toHaveText('Конвертировать HEIC в JPG');
  await expect(page.locator('link[rel=alternate][hreflang]')).toHaveCount(61);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(3);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-cover\.png$/);
  await page.goto('/id/');
  await expect(page.locator('.cards a')).toHaveCount(20);
  await page.goto('/zh/heic-to-jpg/');
  await expect(page.locator('h1')).toHaveText('将 HEIC 转换为 JPG');
  await page.goto('/zh-tw/');
  await expect(page.locator('.cards a')).toHaveCount(20);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  await page.goto('/bn/');
  await expect(page.locator('.cards a')).toHaveCount(20);
  await page.goto('/hi/');
  await expect(page.locator('.cards a')).toHaveCount(20);
  for (const rtlLang of ['ar', 'ur', 'fa', 'he']) {
    await page.goto(`/${rtlLang}/`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  }
});

test('WebP error offers a way out: "Save as JPG instead"', async ({ page }) => {
  // emulate Safari: canvas silently returns PNG when asked for WebP
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
      return orig.call(this, cb, type === 'image/webp' ? 'image/png' : type, q);
    };
  });
  await convert(page, '/en/jpg-to-webp/', ['photo.jpg']);
  await expect(page.locator('.files li[data-status=error]')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText('cannot save WebP');
  await page.getByRole('button', { name: 'Save as JPG instead' }).click();
  await expect(page.locator('.files li[data-status=done]')).toHaveCount(1);
  const name = await page.getByTestId('results').locator('a[download]').first().getAttribute('download');
  expect(name).toBe('photo.jpg');
});

test('Telegram Mini App: results go to the chat through the bot', async ({ page }) => {
  const init = 'query_id=AAE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc';
  let seen: { header: string | null; body: string } | null = null;
  await page.route('**/api/send', async (route) => {
    const req = route.request();
    seen = { header: await req.headerValue('x-telegram-init-data'), body: req.postDataBuffer()?.toString('latin1') ?? '' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  // Telegram opens the page with the signed initData in the hash; it must survive navigation
  await page.goto(`/en/#tgWebAppData=${encodeURIComponent(init)}`);
  await convert(page, '/en/compress-image/', ['photo.png']);
  const tg = page.getByTestId('telegram');
  await tg.getByRole('button', { name: 'Send to chat' }).click();
  await expect(tg).toContainText('Sent to the chat ✓');
  expect(seen!.header).toBe(init);
  expect(seen!.body).toContain('filename="photo-compressed.jpg"');
});

test('outside Telegram there is no "Send to chat"', async ({ page }) => {
  await convert(page, '/en/compress-image/', ['photo.png']);
  await expect(page.getByTestId('telegram')).toHaveCount(0);
  await expect(page.getByTestId('before-after')).toBeVisible();
});

test('home search filters tool cards', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.cards a')).toHaveCount(20);
  await page.locator('#tool-search').fill('zip');
  await expect(page.locator('.cards li:visible')).toHaveCount(1);
  await expect(page.locator('.cards li:visible a')).toContainText('ZIP archive & extract');
});

test('rotate image swaps dimensions', async ({ page }) => {
  await convert(page, '/en/rotate-image/', ['photo.jpg']);
  const dims = await page.getByTestId('results').locator('a[download]').first().evaluate(async (a: HTMLAnchorElement) => {
    const bmp = await createImageBitmap(await (await fetch(a.href)).blob());
    return [bmp.width, bmp.height];
  });
  expect(dims[1]).toBeGreaterThan(dims[0]);
});

test('strip EXIF metadata produces clean JPG', async ({ page }) => {
  const [out] = await convert(page, '/en/strip-exif/', ['photo.jpg']);
  expect(out.name).toBe('photo-clean.jpg');
  expect(out.head.startsWith(JPG)).toBe(true);
});

test('any-to-jpg converts SVG to JPG', async ({ page }) => {
  await page.goto('/en/any-to-jpg/');
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#2563eb"/></svg>');
  await page.getByTestId('file-input').setInputFiles({ name: 'icon.svg', mimeType: 'image/svg+xml', buffer: svg });
  await page.locator('.actions .btn.primary').click();
  await expect(page.getByTestId('results')).toBeVisible();
  const out = await page.getByTestId('results').locator('a[download]').first().evaluate(async (a: HTMLAnchorElement) => {
    const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
    return { name: a.download, head: Array.from(buf.slice(0, 3), (b) => b.toString(16).padStart(2, '0')).join('') };
  });
  expect(out.name).toBe('icon.jpg');
  expect(out.head).toBe(JPG);
});

test('rotate PDF and PDF to PNG', async ({ page }) => {
  const [rot] = await convert(page, '/en/rotate-pdf/', ['text.pdf']);
  expect(rot.name).toBe('text-rotated.pdf');
  expect(rot.head).toBe(PDF);

  const pngs = await convert(page, '/en/pdf-to-png/', ['text.pdf']);
  expect(pngs).toHaveLength(3);
  expect(pngs.every((o) => o.head.startsWith(PNG))).toBe(true);
});

test('zip-files creates and extracts ZIP archive', async ({ page }) => {
  await convert(page, '/en/zip-files/', ['photo.png', 'text.pdf']);
  const zipBytes = await page.getByTestId('results').locator('a[download]').first().evaluate(async (a: HTMLAnchorElement) => {
    const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
    return Array.from(buf);
  });
  expect(zipBytes.slice(0, 4)).toEqual([0x50, 0x4b, 0x03, 0x04]);

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByTestId('file-input').setInputFiles({ name: 'bundle.zip', mimeType: 'application/zip', buffer: Buffer.from(zipBytes) });
  await page.locator('.options select').selectOption('extract');
  await page.locator('.actions .btn.primary').click();
  await expect(page.getByTestId('results').locator('a[download]')).toHaveCount(2);
});

test('audio-to-mp3 converts WAV to MP3', async ({ page }) => {
  await page.goto('/en/audio-to-mp3/');
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  const sr = 44100, len = 22050, wav = Buffer.alloc(44 + len * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + len * 2, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(len * 2, 40);
  for (let i = 0; i < len; i++) wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 10000), 44 + i * 2);

  await page.getByTestId('file-input').setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: wav });
  await page.locator('.actions .btn.primary').click();
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 30_000 });
  const out = await page.getByTestId('results').locator('a[download]').first().evaluate(async (a: HTMLAnchorElement) => {
    const buf = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
    return { name: a.download, head: Array.from(buf.slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('') };
  });
  expect(out.name).toBe('tone.mp3');
  expect(out.head.startsWith('fff')).toBe(true);
});
