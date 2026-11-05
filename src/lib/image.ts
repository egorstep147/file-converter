/** Image conversion in the browser via createImageBitmap + canvas. */
import { renameTo, type OutputFile } from './files';

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageOptions {
  type: ImageMime;
  /** 0..1, used by JPEG and WebP */
  quality?: number;
  /** Fit inside this box, keeping proportions; never upscale. */
  maxWidth?: number;
  maxHeight?: number;
  /** Scale factor (0..1], applied before maxWidth/maxHeight */
  scale?: number;
  suffix?: string;
}

/** Target size that fits the box and never upscales (pure, unit-tested). */
export function fitSize(
  w: number,
  h: number,
  opts: { maxWidth?: number; maxHeight?: number; scale?: number },
): { width: number; height: number } {
  let k = Math.min(1, opts.scale ?? 1);
  if (opts.maxWidth) k = Math.min(k, opts.maxWidth / w);
  if (opts.maxHeight) k = Math.min(k, opts.maxHeight / h);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export class UnsupportedOutputError extends Error {}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  if (await looksLikeHeic(file)) {
    const { heicTo } = await import('heic-to');
    return heicTo({ blob: file, type: 'bitmap' });
  }
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** HEIC/HEIF by the ISO-BMFF "ftyp" brand — file.type is often empty on Windows. */
export async function looksLikeHeic(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length < 12) return false;
  const box = String.fromCharCode(...head.slice(4, 8));
  const brand = String.fromCharCode(...head.slice(8, 12));
  return box === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}

export function bitmapToBlob(bmp: ImageBitmap | HTMLCanvasElement, o: ImageOptions): Promise<Blob> {
  const { width, height } = fitSize(bmp.width, bmp.height, o);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (o.type === 'image/jpeg') {
    ctx.fillStyle = '#fff'; // JPEG has no transparency: put PNG/WebP alpha on white, not black
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new Error('encode failed'));
        // Safari silently falls back to PNG when it cannot encode WebP
        if (b.type !== o.type) return reject(new UnsupportedOutputError(o.type));
        resolve(b);
      },
      o.type,
      o.quality,
    ),
  );
}

export async function convertImage(file: File, o: ImageOptions): Promise<OutputFile> {
  const bmp = await decodeImage(file);
  try {
    const blob = await bitmapToBlob(bmp, o);
    return { name: renameTo(file.name, o.type, o.suffix), blob };
  } finally {
    bmp.close();
  }
}
