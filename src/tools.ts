/** Tool registry: one entry = one page per language. Add a tool here + texts in src/i18n/*.ts. */

export type Category = 'image' | 'pdf' | 'audio';

export interface Tool {
  slug: string;
  category: Category;
  /** <input accept> */
  accept: string;
  multiple: boolean;
}

const IMG = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp';

export const TOOLS = [
  { slug: 'heic-to-jpg', category: 'image', accept: 'image/heic,image/heif,.heic,.heif', multiple: true },
  { slug: 'compress-image', category: 'image', accept: IMG, multiple: true },
  { slug: 'resize-image', category: 'image', accept: IMG, multiple: true },
  { slug: 'png-to-jpg', category: 'image', accept: 'image/png,.png', multiple: true },
  { slug: 'webp-to-jpg', category: 'image', accept: 'image/webp,.webp', multiple: true },
  { slug: 'jpg-to-png', category: 'image', accept: 'image/jpeg,.jpg,.jpeg', multiple: true },
  { slug: 'jpg-to-webp', category: 'image', accept: 'image/jpeg,image/png,.jpg,.jpeg,.png', multiple: true },
  { slug: 'jpg-to-pdf', category: 'pdf', accept: IMG, multiple: true },
  { slug: 'merge-pdf', category: 'pdf', accept: 'application/pdf,.pdf', multiple: true },
  { slug: 'split-pdf', category: 'pdf', accept: 'application/pdf,.pdf', multiple: false },
  { slug: 'pdf-to-jpg', category: 'pdf', accept: 'application/pdf,.pdf', multiple: true },
  { slug: 'compress-pdf', category: 'pdf', accept: 'application/pdf,.pdf', multiple: true },
  { slug: 'ogg-to-mp3', category: 'audio', accept: 'audio/ogg,audio/opus,.ogg,.oga,.opus', multiple: true },
] as const satisfies readonly Tool[];

export type ToolSlug = (typeof TOOLS)[number]['slug'];

export const CATEGORIES: Category[] = ['image', 'pdf', 'audio'];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
