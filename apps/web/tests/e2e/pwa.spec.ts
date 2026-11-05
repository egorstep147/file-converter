import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const swReady = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    // wait until this page is controlled (clients.claim on first install)
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    return true;
  });

test('manifest is installable: name, icons, standalone, share target', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.name).toBe('IslePlace Converter');
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(m.share_target.action).toBe('/share-target/');
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/en/compress-image/');
  await swReady(page);
  await page.reload(); // now served through the service worker, assets get cached
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await context.setOffline(true);
  await page.reload();
  await page.locator('astro-island:not([ssr])').waitFor({ state: 'attached' });
  await page.getByTestId('file-input').setInputFiles('tests/fixtures/photo.png');
  await page.locator('.actions .btn.primary').click();
  await expect(page.getByTestId('summary')).toBeVisible();
  await context.setOffline(false);
});

test('Android share target: shared files → choose a tool → files are in the converter', async ({ page }) => {
  await page.goto('/en/');
  await swReady(page);
  // what the Android share sheet does: POST multipart/form-data to the share_target action
  const png = [...readFileSync('tests/fixtures/photo.png')];
  const pdf = [...readFileSync('tests/fixtures/text.pdf')];
  const finalUrl = await page.evaluate(async ([png, pdf]) => {
    const fd = new FormData();
    fd.append('files', new File([new Uint8Array(png)], 'shot.png', { type: 'image/png' }));
    fd.append('files', new File([new Uint8Array(pdf)], 'doc.pdf', { type: 'application/pdf' }));
    const r = await fetch('/share-target/', { method: 'POST', body: fd });
    return new URL(r.url).pathname;
  }, [png, pdf]);
  expect(finalUrl).toBe('/share/');
  await page.goto('/share/?n=2');
  const share = page.getByTestId('share');
  await expect(share.locator('.files li')).toHaveCount(2);
  await expect(share.getByText('shot.png')).toBeVisible();
  await share.getByRole('link', { name: 'Compress image' }).click();
  await expect(page).toHaveURL(/\/en\/compress-image\/$/);
  await expect(page.locator('.files li')).toHaveCount(2);
  // files were taken once: the share cache is empty now
  expect(await page.evaluate(async () => (await (await caches.open('shared-files')).keys()).length)).toBe(0);
});
