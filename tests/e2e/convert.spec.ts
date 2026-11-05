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

test('compress image makes it smaller', async ({ page }) => {
  const [out] = await convert(page, '/en/compress-image/', ['photo.png']);
  expect(out.name).toBe('photo-compressed.jpg');
  expect(out.size).toBeLessThan(191_228);
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
  await expect(page.locator('link[rel=alternate][hreflang]')).toHaveCount(6);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  await page.goto('/id/');
  await expect(page.locator('.cards a')).toHaveCount(13);
});
