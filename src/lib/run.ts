/** Glue between the UI and the converters: one function per tool slug. */
import type { ToolSlug } from '../tools';
import type { OutputFile } from './files';
import { bitmapToBlob, convertImage, decodeImage, UnsupportedOutputError, type ImageMime } from './image';

export interface Options {
  quality: number; // 1..100
  format: 'auto' | ImageMime;
  maxWidth: string;
  resizeMode: 'percent' | 'px';
  percent: number;
  width: string;
  height: string;
  pageSize: 'image' | 'a4';
  splitMode: 'each' | 'ranges';
  ranges: string;
  dpi: number;
  level: 'strong' | 'medium' | 'light';
  kbps: number;
}

export const DEFAULT_OPTIONS: Options = {
  quality: 75,
  format: 'auto',
  maxWidth: '',
  resizeMode: 'percent',
  percent: 50,
  width: '1920',
  height: '1080',
  pageSize: 'a4',
  splitMode: 'each',
  ranges: '',
  dpi: 150,
  level: 'medium',
  kbps: 64,
};

export interface Result {
  /** input file name(s) this result belongs to */
  source: string;
  outputs: OutputFile[];
  note?: 'notSmaller';
  error?: 'webp' | 'ranges' | 'generic';
  detail?: string;
}

export type Progress = (fraction: number) => void;

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Output type for compress/resize: keep JPG/WebP/PNG, HEIC and unknown -> JPG; compress turns PNG -> JPG (PNG has no quality). */
export function autoType(file: File, purpose: 'compress' | 'resize'): ImageMime {
  if (file.type === 'image/webp') return 'image/webp';
  if (file.type === 'image/png') return purpose === 'resize' ? 'image/png' : 'image/jpeg';
  return 'image/jpeg';
}

const FIXED: Partial<Record<ToolSlug, ImageMime>> = {
  'heic-to-jpg': 'image/jpeg',
  'png-to-jpg': 'image/jpeg',
  'webp-to-jpg': 'image/jpeg',
  'jpg-to-png': 'image/png',
  'jpg-to-webp': 'image/webp',
};

/** Tools that turn N inputs into one output. */
export const COMBINES: ToolSlug[] = ['merge-pdf', 'jpg-to-pdf'];

function classify(e: unknown): Pick<Result, 'error' | 'detail'> {
  if (e instanceof UnsupportedOutputError) return { error: 'webp' };
  return { error: 'generic', detail: String((e as Error)?.message ?? e) };
}

async function one(slug: ToolSlug, f: File, o: Options, progress: Progress): Promise<Omit<Result, 'source'>> {
  const fixed = FIXED[slug];
  if (fixed) return { outputs: [await convertImage(f, { type: fixed, quality: 0.92 })] };

  switch (slug) {
    case 'compress-image': {
      const type = o.format === 'auto' ? autoType(f, 'compress') : o.format;
      const out = await convertImage(f, { type, quality: o.quality / 100, maxWidth: num(o.maxWidth), suffix: '-compressed' });
      // never hand back a bigger file in the same format
      if (out.blob.size >= f.size && f.type === type) return { outputs: [{ name: f.name, blob: f }], note: 'notSmaller' };
      return { outputs: [out] };
    }
    case 'resize-image': {
      const type = autoType(f, 'resize');
      const size = o.resizeMode === 'percent' ? { scale: o.percent / 100 } : { maxWidth: num(o.width), maxHeight: num(o.height) };
      return { outputs: [await convertImage(f, { type, quality: 0.9, suffix: '-resized', ...size })] };
    }
    case 'split-pdf': {
      const { splitPdf, pageCount } = await import('./pdf');
      if (o.splitMode === 'each') return { outputs: await splitPdf(f, 'each') };
      const { parseRanges } = await import('./files');
      let pages: number[];
      try {
        pages = parseRanges(o.ranges, await pageCount(f));
      } catch {
        return { outputs: [], error: 'ranges' };
      }
      return { outputs: await splitPdf(f, pages) };
    }
    case 'pdf-to-jpg': {
      const { pdfToJpg } = await import('./pdf');
      return { outputs: await pdfToJpg(f, o.dpi, (d, t) => progress(d / t)) };
    }
    case 'compress-pdf': {
      const { compressPdf } = await import('./pdf');
      const out = await compressPdf(f, o.level, (d, t) => progress(d / t));
      return out ? { outputs: [out] } : { outputs: [{ name: f.name, blob: f }], note: 'notSmaller' };
    }
    case 'ogg-to-mp3': {
      const { oggToMp3 } = await import('./audio');
      return { outputs: [await oggToMp3(f, o.kbps, (d, t) => progress(d / t))] };
    }
    default:
      throw new Error(`no single-file runner for ${slug}`);
  }
}

async function combined(slug: ToolSlug, files: File[], o: Options, progress: Progress): Promise<OutputFile> {
  const pdf = await import('./pdf');
  if (slug === 'merge-pdf') return pdf.mergePdfs(files);
  // jpg-to-pdf: pdf-lib embeds only JPEG/PNG, so normalize everything else to JPEG first
  const images: { blob: Blob; type: 'image/jpeg' | 'image/png' }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.type === 'image/jpeg' || f.type === 'image/png') {
      images.push({ blob: f, type: f.type });
    } else {
      const bmp = await decodeImage(f);
      images.push({ blob: await bitmapToBlob(bmp, { type: 'image/jpeg', quality: 0.9 }), type: 'image/jpeg' });
      bmp.close();
    }
    progress((i + 1) / files.length);
  }
  return pdf.imagesToPdf(images, o.pageSize);
}

/** Run a tool over the files, reporting overall progress 0..1; errors are per file, never thrown. */
export async function runTool(slug: ToolSlug, files: File[], o: Options, progress: Progress): Promise<Result[]> {
  if (COMBINES.includes(slug)) {
    try {
      const out = await combined(slug, files, o, progress);
      return [{ source: files.map((f) => f.name).join(', '), outputs: [out] }];
    } catch (e) {
      return [{ source: files.map((f) => f.name).join(', '), outputs: [], ...classify(e) }];
    }
  }
  const results: Result[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const r = await one(slug, f, o, (p) => progress((i + p) / files.length));
      results.push({ source: f.name, ...r });
    } catch (e) {
      results.push({ source: f.name, outputs: [], ...classify(e) });
    }
    progress((i + 1) / files.length);
  }
  return results;
}
