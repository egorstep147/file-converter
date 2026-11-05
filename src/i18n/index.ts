import { en, type Dict } from './en';
import { es } from './es';
import { id } from './id';
import { pt } from './pt';
import { ru } from './ru';

/** Add a language: create src/i18n/<code>.ts (typed as Dict) and list it here. */
export const DICTS = { en, es, pt, ru, id } satisfies Record<string, Dict>;
export type Lang = keyof typeof DICTS;
export const LANGS = Object.keys(DICTS) as Lang[];
export const DEFAULT_LANG: Lang = 'en';

/** hreflang codes for <link rel="alternate"> and <html lang> */
export const HREFLANG: Record<Lang, string> = { en: 'en', es: 'es', pt: 'pt', ru: 'ru', id: 'id' };

export function t(lang: Lang): Dict {
  return DICTS[lang];
}

export function isLang(x: string | undefined): x is Lang {
  return !!x && x in DICTS;
}

export const toolPath = (lang: Lang, slug: string) => `/${lang}/${slug}/`;
export const homePath = (lang: Lang) => `/${lang}/`;

export type { Dict, ToolText } from './en';
