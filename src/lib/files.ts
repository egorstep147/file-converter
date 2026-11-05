/** Small file helpers shared by all tools (pure, unit-tested). */

export interface OutputFile {
  name: string;
  blob: Blob;
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'application/zip': 'zip',
};

export function extFor(mime: string): string {
  return EXT[mime] ?? 'bin';
}

/** "IMG_1.HEIC" + "image/jpeg" -> "IMG_1.jpg"; optional suffix -> "IMG_1-compressed.jpg". */
export function renameTo(name: string, mime: string, suffix = ''): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}${suffix}.${extFor(mime)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Make names unique inside one zip: a.jpg, a (2).jpg, ... */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = (seen.get(n) ?? 0) + 1;
    seen.set(n, count);
    if (count === 1) return n;
    const dot = n.lastIndexOf('.');
    return dot > 0 ? `${n.slice(0, dot)} (${count})${n.slice(dot)}` : `${n} (${count})`;
  });
}

export async function zipFiles(files: OutputFile[]): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const names = uniqueNames(files.map((f) => f.name));
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < files.length; i++) {
    entries[names[i]] = new Uint8Array(await files[i].blob.arrayBuffer());
  }
  // level 0: outputs (jpg/pdf/mp3) are already compressed, zipping again only costs time
  const data = zipSync(entries, { level: 0 });
  return new Blob([data as BlobPart], { type: 'application/zip' });
}

/**
 * Parse page ranges like "1-3, 5, 8-" for a document with `total` pages.
 * Returns 0-based indexes in the given order, without duplicates. Throws on invalid input.
 */
export function parseRanges(input: string, total: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const parts = input.split(/[,;\s]+/).filter(Boolean);
  if (parts.length === 0) throw new Error('empty');
  for (const part of parts) {
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!m) throw new Error(`bad range: ${part}`);
    let from: number;
    let to: number;
    if (m.length === 2) {
      from = to = Number(m[1]);
    } else {
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : total;
    }
    if (from < 1 || to > total || from > to) throw new Error(`out of range: ${part}`);
    for (let p = from; p <= to; p++) {
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p - 1);
      }
    }
  }
  return out;
}

/** Fill "{name}" placeholders: fmt('Done: {n} of {total}', {n: 2, total: 3}). */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}
