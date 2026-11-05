// Builds the PDF test fixtures (images/audio come from ffmpeg, HEIC from pillow-heif — see README).
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const dir = new URL('../tests/fixtures/', import.meta.url);

// text.pdf: 3 pages of text -> merge/split tests
const text = await PDFDocument.create();
const font = await text.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  text.addPage([595, 842]).drawText(`Page ${i}`, { x: 60, y: 760, size: 32, font });
}
writeFileSync(new URL('text.pdf', dir), await text.save());

// scan.pdf: 2 pages, each a big high-quality JPEG -> compression must shrink it
const scan = await PDFDocument.create();
const jpg = await scan.embedJpg(readFileSync(new URL('scan-page.jpg', dir)));
for (let i = 0; i < 2; i++) scan.addPage([595, 842]).drawImage(jpg, { x: 0, y: 0, width: 595, height: 842 });
writeFileSync(new URL('scan.pdf', dir), await scan.save());
console.log('fixtures written');
