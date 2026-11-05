/** PDF tools: pdf-lib for structure (merge/split/build), pdf.js for rendering pages to images. */
import { renameTo, type OutputFile } from './files';

const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });

async function lib() {
  return import('pdf-lib');
}

export async function mergePdfs(files: File[]): Promise<OutputFile> {
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return { name: 'merged.pdf', blob: pdfBlob(await out.save()) };
}

export async function pageCount(file: Blob): Promise<number> {
  const { PDFDocument } = await lib();
  return (await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount();
}

/** One PDF per page, or one PDF with the selected pages (0-based indexes). */
export async function splitPdf(file: File, pages: number[] | 'each'): Promise<OutputFile[]> {
  const { PDFDocument } = await lib();
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const base = file.name.replace(/\.pdf$/i, '');
  if (pages === 'each') {
    const out: OutputFile[] = [];
    for (const i of src.getPageIndices()) {
      const doc = await PDFDocument.create();
      const [p] = await doc.copyPages(src, [i]);
      doc.addPage(p);
      out.push({ name: `${base}-page-${i + 1}.pdf`, blob: pdfBlob(await doc.save()) });
    }
    return out;
  }
  const doc = await PDFDocument.create();
  (await doc.copyPages(src, pages)).forEach((p) => doc.addPage(p));
  return [{ name: `${base}-pages.pdf`, blob: pdfBlob(await doc.save()) }];
}

export type PageSize = 'image' | 'a4';
const A4: [number, number] = [595.28, 841.89];

/** Images (already decoded to JPEG/PNG blobs) -> one PDF, one image per page. */
export async function imagesToPdf(images: { blob: Blob; type: 'image/jpeg' | 'image/png' }[], size: PageSize): Promise<OutputFile> {
  const { PDFDocument } = await lib();
  const doc = await PDFDocument.create();
  for (const im of images) {
    const bytes = new Uint8Array(await im.blob.arrayBuffer());
    const img = im.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    if (size === 'image') {
      // 96 dpi screen pixels -> 72 dpi PDF points, so a photo prints at a sane size
      const w = (img.width * 72) / 96;
      const h = (img.height * 72) / 96;
      doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
    } else {
      const landscape = img.width > img.height;
      const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
      const margin = 28; // ~1 cm
      const k = Math.min((pw - 2 * margin) / img.width, (ph - 2 * margin) / img.height);
      const w = img.width * k;
      const h = img.height * k;
      doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  return { name: 'images.pdf', blob: pdfBlob(await doc.save()) };
}

// ---- rendering (browser only) ----

async function pdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  return pdfjsLib;
}

/** Render every page to a canvas and hand it to `each`; scale 1 = 72 dpi. */
async function renderPages(file: Blob, scale: number, each: (c: HTMLCanvasElement, i: number, w: number, h: number) => Promise<void>, onProgress?: (done: number, total: number) => void) {
  const { getDocument } = await pdfjs();
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
      await each(canvas, i, base.width, base.height);
      page.cleanup();
      canvas.width = canvas.height = 0; // free memory on long documents
      onProgress?.(i, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
}

const canvasToJpeg = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q));

export async function pdfToJpg(file: File, dpi: number, onProgress?: (d: number, t: number) => void): Promise<OutputFile[]> {
  const base = file.name.replace(/\.pdf$/i, '');
  const out: OutputFile[] = [];
  await renderPages(file, dpi / 72, async (c, i) => {
    out.push({ name: `${base}-${i}.jpg`, blob: await canvasToJpeg(c, 0.9) });
  }, onProgress);
  return out;
}

export const COMPRESS_LEVELS = {
  strong: { dpi: 96, q: 0.55 },
  medium: { dpi: 144, q: 0.7 },
  light: { dpi: 200, q: 0.82 },
} as const;
export type CompressLevel = keyof typeof COMPRESS_LEVELS;

/**
 * Rasterize pages to JPEG and rebuild the PDF. Big win for scans and photos;
 * text becomes an image (not selectable). Returns null if the result is not smaller.
 */
export async function compressPdf(file: File, level: CompressLevel, onProgress?: (d: number, t: number) => void): Promise<OutputFile | null> {
  const { PDFDocument } = await lib();
  const { dpi, q } = COMPRESS_LEVELS[level];
  const doc = await PDFDocument.create();
  await renderPages(file, dpi / 72, async (c, _i, w, h) => {
    const img = await doc.embedJpg(new Uint8Array(await (await canvasToJpeg(c, q)).arrayBuffer()));
    doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }, onProgress);
  const bytes = await doc.save();
  if (bytes.length >= file.size) return null;
  return { name: renameTo(file.name, 'application/pdf', '-compressed'), blob: pdfBlob(bytes) };
}
