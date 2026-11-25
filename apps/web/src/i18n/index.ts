import { ar } from './ar';
import { cs } from './cs';
import { de } from './de';
import { el } from './el';
import { en, type Dict } from './en';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { hu } from './hu';
import { id } from './id';
import { it } from './it';
import { ja } from './ja';
import { ko } from './ko';
import { ms } from './ms';
import { nl } from './nl';
import { pl } from './pl';
import { pt } from './pt';
import { ro } from './ro';
import { ru } from './ru';
import { sv } from './sv';
import { th } from './th';
import { tr } from './tr';
import { uk } from './uk';
import { vi } from './vi';
import { zh } from './zh';

/** Add a language: create src/i18n/<code>.ts (typed as Dict) and list it here. */
export const DICTS = {
  en, es, pt, ru, id,
  de, fr, ja, ko, tr,
  zh, hi, ar, it, pl,
  nl, vi, th, uk, cs,
  sv, ro, el, hu, ms,
} satisfies Record<string, Dict>;

export type Lang = keyof typeof DICTS;
export const LANGS = Object.keys(DICTS) as Lang[];
export const DEFAULT_LANG: Lang = 'en';
export const RTL_LANGS: readonly Lang[] = ['ar'];

export const isRtl = (lang: Lang) => RTL_LANGS.includes(lang);

/** hreflang codes for <link rel="alternate"> and <html lang> */
export const HREFLANG: Record<Lang, string> = {
  en: 'en', es: 'es', pt: 'pt', ru: 'ru', id: 'id',
  de: 'de', fr: 'fr', ja: 'ja', ko: 'ko', tr: 'tr',
  zh: 'zh-Hans', hi: 'hi', ar: 'ar', it: 'it', pl: 'pl',
  nl: 'nl', vi: 'vi', th: 'th', uk: 'uk', cs: 'cs',
  sv: 'sv', ro: 'ro', el: 'el', hu: 'hu', ms: 'ms',
};

export function t(lang: Lang): Dict {
  return DICTS[lang];
}

export function isLang(x: string | undefined): x is Lang {
  return !!x && x in DICTS;
}

export const toolPath = (lang: Lang, slug: string) => `/${lang}/${slug}/`;
export const homePath = (lang: Lang) => `/${lang}/`;

export type { Dict, ToolText } from './en';
