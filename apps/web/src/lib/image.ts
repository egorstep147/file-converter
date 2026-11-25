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

export type RotateOp = '90' | '180' | '270' | 'flip-h' | 'flip-v';

async function decodeSvg(file: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('svg decode failed'));
      el.src = url;
    });
    const w = img.naturalWidth || 1200;
    const h = img.naturalHeight || 1200;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  if (await looksLikeHeic(file)) {
    const { heicTo } = await import('heic-to');
    return heicTo({ blob: file, type: 'bitmap' });
  }
  const name = 'name' in file ? String((file as File).name) : '';
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(name)) {
    return decodeSvg(file);
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

export async function transformImage(file: File, op: RotateOp, type: ImageMime): Promise<OutputFile> {
  const bmp = await decodeImage(file);
  try {
    const swap = op === '90' || op === '270';
    const w = swap ? bmp.height : bmp.width;
    const h = swap ? bmp.width : bmp.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.translate(w / 2, h / 2);
    if (op === '90') ctx.rotate(Math.PI / 2);
    else if (op === '180') ctx.rotate(Math.PI);
    else if (op === '270') ctx.rotate(-Math.PI / 2);
    else if (op === 'flip-h') ctx.scale(-1, 1);
    else if (op === 'flip-v') ctx.scale(1, -1);
    ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? (b.type === type ? res(b) : rej(new UnsupportedOutputError(type))) : rej(new Error('encode failed'))), type, 0.92),
    );
    return { name: renameTo(file.name, type, '-rotated'), blob };
  } finally {
    bmp.close();
  }
}

/** Re-encode through canvas so EXIF/GPS/camera metadata is completely stripped. */
export async function stripExif(file: File, type: ImageMime): Promise<OutputFile> {
  return convertImage(file, { type, quality: 0.95, suffix: '-clean' });
}
