import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { floatTo16, decodeOggOpus, encodeMp3 } from '../../src/lib/audio';
import { formatBytes, parseRanges, renameTo, uniqueNames, zipFiles } from '../../src/lib/files';
import { fitSize, looksLikeHeic } from '../../src/lib/image';
import { imagesToPdf, mergePdfs, pageCount, splitPdf } from '../../src/lib/pdf';
import { autoType } from '../../src/lib/run';
import { DICTS } from '../../src/i18n';
import { TOOLS } from '../../src/tools';

const fx = (name: string, type = '') => new File([readFileSync(new URL(`../fixtures/${name}`, import.meta.url))], name, { type });

describe('files', () => {
  it('renames extension and adds suffix', () => {
    expect(renameTo('IMG_1.HEIC', 'image/jpeg')).toBe('IMG_1.jpg');
    expect(renameTo('a.b.png', 'image/webp', '-compressed')).toBe('a.b-compressed.webp');
    expect(renameTo('noext', 'application/pdf')).toBe('noext.pdf');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
  });

  it('makes zip names unique', () => {
    expect(uniqueNames(['a.jpg', 'a.jpg', 'b.jpg', 'a.jpg'])).toEqual(['a.jpg', 'a (2).jpg', 'b.jpg', 'a (3).jpg']);
  });

  it('parses page ranges', () => {
    expect(parseRanges('1-3, 5, 8-', 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
    expect(parseRanges('3,1,3', 5)).toEqual([2, 0]);
    expect(parseRanges('-2', 5)).toEqual([0, 1]);
    for (const bad of ['', '0', '6', '4-2', 'abc', '1-x']) expect(() => parseRanges(bad, 5)).toThrow();
  });

  it('zips outputs', async () => {
    const zip = await zipFiles([{ name: 'a.txt', blob: new Blob(['1']) }, { name: 'a.txt', blob: new Blob(['2']) }]);
    const { unzipSync } = await import('fflate');
    expect(Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer())))).toEqual(['a.txt', 'a (2).txt']);
  });
});

describe('image', () => {
  it('fits size without upscaling', () => {
    expect(fitSize(4000, 3000, { maxWidth: 1920 })).toEqual({ width: 1920, height: 1440 });
    expect(fitSize(4000, 3000, { maxWidth: 1920, maxHeight: 1080 })).toEqual({ width: 1440, height: 1080 });
    expect(fitSize(800, 600, { maxWidth: 1920 })).toEqual({ width: 800, height: 600 });
    expect(fitSize(800, 600, { scale: 0.5 })).toEqual({ width: 400, height: 300 });
    expect(fitSize(800, 600, { scale: 2 })).toEqual({ width: 800, height: 600 });
  });

  it('detects HEIC by content, not by name', async () => {
    expect(await looksLikeHeic(fx('photo.heic'))).toBe(true);
    expect(await looksLikeHeic(fx('photo.jpg'))).toBe(false);
  });

  it('picks output types', () => {
    const f = (type: string) => new File([], 'x', { type });
    expect(autoType(f('image/png'), 'compress')).toBe('image/jpeg');
    expect(autoType(f('image/png'), 'resize')).toBe('image/png');
    expect(autoType(f('image/webp'), 'compress')).toBe('image/webp');
    expect(autoType(f(''), 'compress')).toBe('image/jpeg'); // HEIC on Windows has no MIME type
  });
});

describe('pdf', () => {
  it('merges', async () => {
    const out = await mergePdfs([fx('text.pdf'), fx('scan.pdf')]);
    expect(await pageCount(out.blob)).toBe(5);
  });

  it('splits into pages and extracts ranges', async () => {
    const each = await splitPdf(fx('text.pdf'), 'each');
    expect(each.map((o) => o.name)).toEqual(['text-page-1.pdf', 'text-page-2.pdf', 'text-page-3.pdf']);
    const sel = await splitPdf(fx('text.pdf'), [2, 0]);
    expect(await pageCount(sel[0].blob)).toBe(2);
  });

  it('builds a PDF from images', async () => {
    const jpg = { blob: fx('photo.jpg'), type: 'image/jpeg' as const };
    const png = { blob: fx('photo.png'), type: 'image/png' as const };
    const a4 = await imagesToPdf([jpg, png], 'a4');
    const doc = await PDFDocument.load(await a4.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    // landscape photo -> landscape A4
    expect(Math.round(doc.getPage(0).getWidth())).toBe(842);
  });
});

describe('audio', () => {
  it('converts float PCM to int16 with clipping', () => {
    expect(Array.from(floatTo16(new Float32Array([0, 1, -1, 2, -2, 0.5])))).toEqual([0, 32767, -32768, 32767, -32768, 16383]);
  });

  it('decodes Ogg/Opus and encodes MP3', async () => {
    const { channels, sampleRate } = await decodeOggOpus(new Uint8Array(readFileSync(new URL('../fixtures/voice.ogg', import.meta.url))));
    expect(sampleRate).toBe(48000);
    expect(channels[0].length / sampleRate).toBeCloseTo(3, 0); // 3 s sine
    const mp3 = await encodeMp3(channels, sampleRate, 64);
    // MP3 frame sync: 0xFFE (11 bits set)
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    // 64 kbps * 3 s ~ 24 KB
    expect(mp3.length).toBeGreaterThan(18_000);
    expect(mp3.length).toBeLessThan(30_000);
  });
});

describe('i18n', () => {
  it('has texts for every tool in every language, within SEO lengths', () => {
    for (const [lang, d] of Object.entries(DICTS)) {
      for (const tool of TOOLS) {
        const tx = d.tools[tool.slug];
        expect(tx, `${lang}/${tool.slug}`).toBeDefined();
        expect(tx.title.length, `${lang}/${tool.slug} title`).toBeLessThanOrEqual(65);
        expect(tx.desc.length, `${lang}/${tool.slug} desc`).toBeLessThanOrEqual(170);
        expect(tx.faq.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
