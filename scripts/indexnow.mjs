// Tell Yandex and Bing (IndexNow) about every page in the built sitemap. Run after `npm run deploy`.
import { readdirSync, readFileSync } from 'node:fs';

const host = new URL(process.env.SITE_URL ?? 'https://convert.isleplace.com').host;
const key = readdirSync(new URL('../public/', import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4);
if (!key) throw new Error('no IndexNow key file in public/');

const xml = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const body = JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList });
for (const endpoint of ['https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow']) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
  console.log(`${endpoint}: ${r.status} ${r.statusText} (${urlList.length} URLs)`, r.ok ? '' : (await r.text()).slice(0, 200));
}
