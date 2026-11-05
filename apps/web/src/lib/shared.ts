/** Files received through the Android "Share" sheet (see public/share-target-sw.js). */
import type { ToolSlug } from '../tools';

export const SHARED_CACHE = 'shared-files';

export interface SharedInfo {
  name: string;
  type: string;
}

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Which tools make sense for one file, best first (pure, unit-tested). */
export function toolsForFile(f: SharedInfo): ToolSlug[] {
  const e = ext(f.name);
  const t = f.type.toLowerCase();
  if (t === 'image/heic' || t === 'image/heif' || e === 'heic' || e === 'heif') return ['heic-to-jpg', 'compress-image', 'jpg-to-pdf'];
  if (t === 'image/png' || e === 'png') return ['png-to-jpg', 'compress-image', 'resize-image', 'jpg-to-pdf', 'jpg-to-webp'];
  if (t === 'image/webp' || e === 'webp') return ['webp-to-jpg', 'compress-image', 'resize-image', 'jpg-to-pdf'];
  if (t.startsWith('image/') || e === 'jpg' || e === 'jpeg') return ['compress-image', 'resize-image', 'jpg-to-pdf', 'jpg-to-webp', 'jpg-to-png'];
  if (t === 'application/pdf' || e === 'pdf') return ['compress-pdf', 'merge-pdf', 'split-pdf', 'pdf-to-jpg'];
  if (t.startsWith('audio/') || ['ogg', 'oga', 'opus'].includes(e)) return ['ogg-to-mp3'];
  return [];
}

/** Tools for a batch: those that fit every file first, then the rest. */
export function toolsForFiles(files: SharedInfo[]): ToolSlug[] {
  if (!files.length) return [];
  const lists = files.map(toolsForFile);
  const all = [...new Set(lists.flat())];
  const common = all.filter((s) => lists.every((l) => l.includes(s)));
  // merge PDF only makes sense for 2+ files
  const filtered = (xs: ToolSlug[]) => xs.filter((s) => s !== 'merge-pdf' || files.length > 1);
  return filtered([...common, ...all.filter((s) => !common.includes(s))]);
}

async function entries(): Promise<Response[]> {
  if (!('caches' in globalThis)) return [];
  const cache = await caches.open(SHARED_CACHE);
  const keys = await cache.keys();
  const out: Response[] = [];
  for (const k of keys) {
    const r = await cache.match(k);
    if (r) out.push(r);
  }
  return out;
}

const nameOf = (r: Response) => decodeURIComponent(r.headers.get('X-Name') ?? 'file');

/** Names and types only, without consuming the files. */
export async function peekShared(): Promise<SharedInfo[]> {
  return (await entries()).map((r) => ({ name: nameOf(r), type: r.headers.get('Content-Type') ?? '' }));
}

/** Read the shared files once and forget them. */
export async function takeShared(): Promise<File[]> {
  const files: File[] = [];
  for (const r of await entries()) {
    const blob = await r.blob();
    files.push(new File([blob], nameOf(r), { type: blob.type }));
  }
  if ('caches' in globalThis) await caches.delete(SHARED_CACHE);
  return files;
}
