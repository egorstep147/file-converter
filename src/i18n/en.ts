import type { ToolSlug } from '../tools';

export interface ToolText {
  /** <title>, ~60 chars */
  title: string;
  /** meta description, ~150 chars */
  desc: string;
  h1: string;
  /** short name for menus and cards */
  name: string;
  intro: string;
  faq: [string, string][];
}

export const en = {
  langName: 'English',
  ui: {
    siteName: 'Local File Converter',
    tagline: 'Convert photos, PDF and voice messages right in your browser',
    privacy: 'Your files never leave your device: everything runs locally in the browser.',
    homeTitle: 'Free online file converter — private, no upload',
    homeDesc: 'Convert HEIC to JPG, compress images and PDF, merge PDF, voice messages to MP3. Free, no sign-up, files are processed on your device.',
    homeH1: 'Free file converter that works on your device',
    homeIntro: 'No uploads, no sign-up, no limits on file size. Pick a tool:',
    categories: { image: 'Images', pdf: 'PDF', audio: 'Audio' },
    drop: 'Drop files here',
    dropOne: 'Drop a file here',
    or: 'or',
    choose: 'Choose files',
    chooseOne: 'Choose a file',
    convert: 'Convert',
    working: 'Working…',
    download: 'Download',
    downloadAll: 'Download all (ZIP)',
    remove: 'Remove',
    clear: 'Start over',
    moveUp: 'Move up',
    moveDown: 'Move down',
    files: 'Files',
    results: 'Result',
    error: 'Could not process this file',
    errorWebp: 'This browser cannot save WebP. Try Chrome, Edge or Firefox.',
    notSmaller: 'Already optimized — the file could not be made smaller.',
    keptOriginal: 'kept original',
    quality: 'Quality',
    format: 'Output format',
    formatAuto: 'Same as original (HEIC → JPG)',
    maxWidth: 'Max width, px (optional)',
    resizeBy: 'Resize by',
    percent: 'Percent',
    pixels: 'Pixels',
    width: 'Width, px',
    height: 'Height, px',
    keepRatio: 'Proportions are kept: the image fits inside the given size.',
    pageSize: 'Page size',
    pageImage: 'Same as image',
    pageA4: 'A4',
    splitMode: 'Mode',
    splitEach: 'Every page as a separate PDF',
    splitRanges: 'Extract pages',
    ranges: 'Pages, e.g. 1-3, 5, 8-',
    rangesError: 'Check the page numbers',
    pagesTotal: 'pages',
    dpi: 'Resolution',
    level: 'Compression',
    levelStrong: 'Strong (smallest file)',
    levelMedium: 'Medium (recommended)',
    levelLight: 'Light (best quality)',
    pdfTextNote: 'Pages are saved as images: text will no longer be selectable. Best for scans and photos.',
    bitrate: 'Bitrate',
    howTitle: 'How to use',
    steps: ['Choose or drop your files.', 'Adjust options if needed and press “Convert”.', 'Download the result. Nothing is uploaded to any server.'],
    faqTitle: 'FAQ',
    privacyQ: 'Is it safe? Are my files uploaded?',
    privacyA: 'No. The conversion runs entirely in your browser using WebAssembly. Your files are never sent to a server, so they stay private — you can even use the site offline after it has loaded.',
    otherTools: 'Other tools',
    language: 'Language',
    footer: 'Free and private. Files are processed on your device.',
    notFound: 'Page not found',
    toHome: 'All tools',
  },
  tools: {
    'heic-to-jpg': {
      name: 'HEIC to JPG',
      title: 'HEIC to JPG Converter — Free, No Upload',
      desc: 'Convert iPhone HEIC photos to JPG in your browser. Batch conversion, no upload, no sign-up. Works on Windows, Mac, Android.',
      h1: 'Convert HEIC to JPG',
      intro: 'iPhones save photos as HEIC, which Windows and many websites cannot open. Turn them into JPG that works everywhere — many files at once.',
      faq: [
        ['Why can’t I open HEIC files?', 'HEIC is Apple’s high-efficiency format. Windows needs a paid extension to open it, and many websites reject it. JPG is supported everywhere.'],
        ['Is the quality preserved?', 'Yes. Photos are converted at high JPG quality (92%), the difference is not visible to the eye.'],
      ],
    },
    'compress-image': {
      name: 'Compress image',
      title: 'Compress Images Online — JPG, PNG, WebP, HEIC',
      desc: 'Reduce image file size without visible quality loss. Compress JPG, PNG, WebP and HEIC photos in your browser — free, no upload.',
      h1: 'Compress images',
      intro: 'Make photos smaller for email, forms and websites. Choose the quality — the lower it is, the smaller the file.',
      faq: [
        ['How much smaller will the file be?', 'Usually 50–80% for phone photos at quality 70–75. Combine it with a max width for an even smaller file.'],
        ['What happens to PNG?', 'PNG has no quality setting, so by default it is converted to JPG (transparent areas become white). Choose WebP to keep transparency.'],
      ],
    },
    'resize-image': {
      name: 'Resize image',
      title: 'Resize Images Online — Change Width and Height',
      desc: 'Resize JPG, PNG, WebP and HEIC images by percent or pixels. Batch resize in your browser, proportions kept, no upload.',
      h1: 'Resize images',
      intro: 'Change the size of one or many images at once — by percent or to fit a given width and height.',
      faq: [
        ['Will the image be stretched?', 'No. Proportions are always kept: the image is scaled to fit inside the given width and height.'],
        ['Can I make an image bigger?', 'No — enlarging only adds blur. The tool shrinks images; smaller ones stay as they are.'],
      ],
    },
    'png-to-jpg': {
      name: 'PNG to JPG',
      title: 'PNG to JPG Converter — Free, No Upload',
      desc: 'Convert PNG images to JPG in your browser. Smaller files, transparent background becomes white. Batch, free, private.',
      h1: 'Convert PNG to JPG',
      intro: 'JPG files are much smaller than PNG for photos and screenshots with many colors. Transparent areas become white.',
      faq: [
        ['Why convert PNG to JPG?', 'Size: a PNG photo can be 5–10 times larger than the same image in JPG.'],
        ['What about transparency?', 'JPG does not support transparency, so transparent areas are filled with white.'],
      ],
    },
    'webp-to-jpg': {
      name: 'WebP to JPG',
      title: 'WebP to JPG Converter — Free, No Upload',
      desc: 'Convert WebP images saved from websites to JPG that opens everywhere. Batch conversion in your browser, free and private.',
      h1: 'Convert WebP to JPG',
      intro: 'Saved a picture from a website and it is WebP? Convert it to JPG to open, edit or send it anywhere.',
      faq: [
        ['What is WebP?', 'A Google image format for the web. It is smaller than JPG, but some apps and services still cannot open it.'],
        ['Is the quality preserved?', 'Yes, images are saved at high JPG quality (92%).'],
      ],
    },
    'jpg-to-png': {
      name: 'JPG to PNG',
      title: 'JPG to PNG Converter — Free, No Upload',
      desc: 'Convert JPG images to lossless PNG in your browser. Batch conversion, free, no sign-up, files stay on your device.',
      h1: 'Convert JPG to PNG',
      intro: 'PNG is lossless: further edits do not reduce the quality. Note that PNG files are bigger than JPG.',
      faq: [
        ['Will PNG improve the quality?', 'No, it keeps the current quality and prevents further losses when you edit and save again.'],
        ['Why is the PNG file bigger?', 'PNG stores every pixel without lossy compression, so photos take more space.'],
      ],
    },
    'jpg-to-webp': {
      name: 'JPG to WebP',
      title: 'JPG to WebP Converter — Smaller Images for Web',
      desc: 'Convert JPG and PNG to WebP for faster websites. Smaller files at the same quality, batch, in your browser, no upload.',
      h1: 'Convert JPG to WebP',
      intro: 'WebP images are usually 25–35% smaller than JPG at the same quality — great for websites and online shops.',
      faq: [
        ['Do all browsers support WebP?', 'All modern browsers can show WebP. Saving WebP works in Chrome, Edge and Firefox; Safari may not support it.'],
        ['Is transparency kept for PNG?', 'Yes, WebP supports transparency.'],
      ],
    },
    'jpg-to-pdf': {
      name: 'Images to PDF',
      title: 'JPG to PDF — Combine Images into One PDF',
      desc: 'Turn JPG, PNG, WebP and HEIC images into a single PDF. Set the order, choose A4 or image size. Free, no upload.',
      h1: 'Convert images to PDF',
      intro: 'Combine photos of documents or scans into one PDF file. Use the arrows to set the page order.',
      faq: [
        ['Which page size should I choose?', 'A4 is best for printing and official forms. “Same as image” keeps each page the size of its photo.'],
        ['Can I add HEIC photos from iPhone?', 'Yes, HEIC, JPG, PNG and WebP are supported.'],
      ],
    },
    'merge-pdf': {
      name: 'Merge PDF',
      title: 'Merge PDF Files Online — Free, No Upload',
      desc: 'Combine several PDF files into one in your browser. Set the order, no file size limits, free and private.',
      h1: 'Merge PDF files',
      intro: 'Join several PDF documents into one file. Use the arrows to set the order.',
      faq: [
        ['Is there a limit on files or size?', 'No fixed limit: everything runs on your device, so it depends only on its memory.'],
        ['Will the quality change?', 'No. Pages are copied as they are, text stays selectable.'],
      ],
    },
    'split-pdf': {
      name: 'Split PDF',
      title: 'Split PDF — Extract Pages Online, No Upload',
      desc: 'Split a PDF into single pages or extract selected pages into a new PDF. Free, in your browser, files stay private.',
      h1: 'Split PDF',
      intro: 'Save every page as a separate PDF, or extract only the pages you need, e.g. “1-3, 5”.',
      faq: [
        ['How do I write the pages?', 'Use commas and dashes: “1-3, 5, 8-” means pages 1 to 3, page 5 and from page 8 to the end.'],
        ['Will the quality change?', 'No, pages are copied without changes.'],
      ],
    },
    'pdf-to-jpg': {
      name: 'PDF to JPG',
      title: 'PDF to JPG Converter — Every Page as Image',
      desc: 'Convert each page of a PDF into a JPG image. Choose the resolution, download all in one ZIP. Free, no upload.',
      h1: 'Convert PDF to JPG',
      intro: 'Turn PDF pages into images to send them in a messenger or insert into a presentation.',
      faq: [
        ['Which resolution should I choose?', '150 DPI is good for screens and messengers, 300 DPI for printing.'],
        ['How do I get all pages?', 'Press “Download all (ZIP)” to get every page in one archive.'],
      ],
    },
    'compress-pdf': {
      name: 'Compress PDF',
      title: 'Compress PDF Online — Reduce PDF Size, No Upload',
      desc: 'Make scanned PDF files smaller for email and upload forms. Three compression levels, in your browser, free and private.',
      h1: 'Compress PDF',
      intro: 'Reduce the size of scanned documents and PDFs with photos so they fit upload limits of websites and email.',
      faq: [
        ['Why is my PDF not getting smaller?', 'Text-only PDFs are already small. Compression works best on scans and documents with photos.'],
        ['Will the text stay selectable?', 'No, pages are saved as images. Keep the original if you need to copy text.'],
      ],
    },
    'ogg-to-mp3': {
      name: 'Voice message to MP3',
      title: 'OGG to MP3 — Convert Voice Messages, No Upload',
      desc: 'Convert Telegram and WhatsApp voice messages (OGG, OPUS) to MP3 that plays everywhere. Free, in your browser.',
      h1: 'Convert OGG / OPUS to MP3',
      intro: 'Voice messages from Telegram and WhatsApp are saved as OGG/OPUS, which many players do not open. Convert them to MP3.',
      faq: [
        ['How do I save a voice message?', 'Telegram Desktop: right-click the message → “Save as”. WhatsApp: forward or export the chat with media.'],
        ['Which bitrate should I choose?', '64 kbps is enough for speech; choose 128 or 192 for music.'],
      ],
    },
  } satisfies Record<ToolSlug, ToolText>,
};

export type Dict = typeof en;
