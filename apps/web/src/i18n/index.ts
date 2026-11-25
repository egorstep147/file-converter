import { af } from './af';
import { am } from './am';
import { ar } from './ar';
import { az } from './az';
import { be } from './be';
import { bg } from './bg';
import { bn } from './bn';
import { ca } from './ca';
import { cs } from './cs';
import { da } from './da';
import { de } from './de';
import { el } from './el';
import { en, type Dict } from './en';
import { es } from './es';
import { fa } from './fa';
import { fi } from './fi';
import { fr } from './fr';
import { gu } from './gu';
import { ha } from './ha';
import { he } from './he';
import { hi } from './hi';
import { hr } from './hr';
import { hu } from './hu';
import { id } from './id';
import { it } from './it';
import { ja } from './ja';
import { ka } from './ka';
import { kk } from './kk';
import { km } from './km';
import { kn } from './kn';
import { ko } from './ko';
import { ml } from './ml';
import { mr } from './mr';
import { ms } from './ms';
import { my } from './my';
import { ne } from './ne';
import { nl } from './nl';
import { no } from './no';
import { pa } from './pa';
import { pl } from './pl';
import { pt } from './pt';
import { ro } from './ro';
import { ru } from './ru';
import { si } from './si';
import { sk } from './sk';
import { sq } from './sq';
import { sr } from './sr';
import { sv } from './sv';
import { sw } from './sw';
import { ta } from './ta';
import { te } from './te';
import { th } from './th';
import { tl } from './tl';
import { tr } from './tr';
import { uk } from './uk';
import { ur } from './ur';
import { uz } from './uz';
import { vi } from './vi';
import { zh } from './zh';
import { zhTw } from './zh-tw';

/** Add a language: create src/i18n/<code>.ts (typed as Dict) and register it below. */
export const DICTS = {
  en,
  es,
  pt,
  ru,
  id,
  de,
  fr,
  ja,
  ko,
  tr,
  zh,
  'zh-tw': zhTw,
  hi,
  ar,
  bn,
  ur,
  pa,
  mr,
  te,
  ta,
  gu,
  kn,
  ml,
  it,
  pl,
  nl,
  vi,
  th,
  uk,
  cs,
  sv,
  ro,
  el,
  hu,
  ms,
  tl,
  my,
  km,
  ne,
  si,
  fa,
  he,
  sw,
  am,
  ha,
  uz,
  kk,
  az,
  af,
  ka,
  da,
  no,
  fi,
  bg,
  be,
  hr,
  sr,
  sk,
  ca,
  sq,
} satisfies Record<string, Dict>;

export type Lang = keyof typeof DICTS;
export const LANGS = Object.keys(DICTS) as Lang[];
export const DEFAULT_LANG: Lang = 'en';
export const RTL_LANGS: readonly Lang[] = ['ar', 'ur', 'fa', 'he'];

export const isRtl = (lang: Lang) => RTL_LANGS.includes(lang);

/** hreflang codes for <link rel="alternate"> and <html lang> */
export const HREFLANG: Record<Lang, string> = {
  en: 'en',
  es: 'es',
  pt: 'pt',
  ru: 'ru',
  id: 'id',
  de: 'de',
  fr: 'fr',
  ja: 'ja',
  ko: 'ko',
  tr: 'tr',
  zh: 'zh-Hans',
  'zh-tw': 'zh-Hant',
  hi: 'hi',
  ar: 'ar',
  bn: 'bn',
  ur: 'ur',
  pa: 'pa',
  mr: 'mr',
  te: 'te',
  ta: 'ta',
  gu: 'gu',
  kn: 'kn',
  ml: 'ml',
  it: 'it',
  pl: 'pl',
  nl: 'nl',
  vi: 'vi',
  th: 'th',
  uk: 'uk',
  cs: 'cs',
  sv: 'sv',
  ro: 'ro',
  el: 'el',
  hu: 'hu',
  ms: 'ms',
  tl: 'tl',
  my: 'my',
  km: 'km',
  ne: 'ne',
  si: 'si',
  fa: 'fa',
  he: 'he',
  sw: 'sw',
  am: 'am',
  ha: 'ha',
  uz: 'uz',
  kk: 'kk',
  az: 'az',
  af: 'af',
  ka: 'ka',
  da: 'da',
  no: 'nb',
  fi: 'fi',
  bg: 'bg',
  be: 'be',
  hr: 'hr',
  sr: 'sr',
  sk: 'sk',
  ca: 'ca',
  sq: 'sq',
};

export type LangRegion = 'europe' | 'asia' | 'mea';

export interface LangMeta {
  enName: string;
  region: LangRegion;
  popular?: boolean;
  ogLocale: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  en: { enName: 'English', region: 'europe', popular: true, ogLocale: 'en_US' },
  es: { enName: 'Spanish', region: 'europe', popular: true, ogLocale: 'es_ES' },
  pt: { enName: 'Portuguese', region: 'europe', popular: true, ogLocale: 'pt_BR' },
  ru: { enName: 'Russian', region: 'europe', popular: true, ogLocale: 'ru_RU' },
  id: { enName: 'Indonesian', region: 'asia', popular: true, ogLocale: 'id_ID' },
  de: { enName: 'German', region: 'europe', popular: true, ogLocale: 'de_DE' },
  fr: { enName: 'French', region: 'europe', popular: true, ogLocale: 'fr_FR' },
  ja: { enName: 'Japanese', region: 'asia', popular: true, ogLocale: 'ja_JP' },
  ko: { enName: 'Korean', region: 'asia', popular: true, ogLocale: 'ko_KR' },
  tr: { enName: 'Turkish', region: 'mea', popular: true, ogLocale: 'tr_TR' },
  zh: { enName: 'Chinese (Simplified)', region: 'asia', popular: true, ogLocale: 'zh_CN' },
  'zh-tw': { enName: 'Chinese (Traditional)', region: 'asia', popular: true, ogLocale: 'zh_TW' },
  hi: { enName: 'Hindi', region: 'asia', popular: true, ogLocale: 'hi_IN' },
  ar: { enName: 'Arabic', region: 'mea', popular: true, ogLocale: 'ar_AR' },
  bn: { enName: 'Bengali', region: 'asia', popular: true, ogLocale: 'bn_BD' },
  ur: { enName: 'Urdu', region: 'asia', popular: true, ogLocale: 'ur_PK' },
  pa: { enName: 'Punjabi', region: 'asia', ogLocale: 'pa_IN' },
  mr: { enName: 'Marathi', region: 'asia', ogLocale: 'mr_IN' },
  te: { enName: 'Telugu', region: 'asia', ogLocale: 'te_IN' },
  ta: { enName: 'Tamil', region: 'asia', ogLocale: 'ta_IN' },
  gu: { enName: 'Gujarati', region: 'asia', ogLocale: 'gu_IN' },
  kn: { enName: 'Kannada', region: 'asia', ogLocale: 'kn_IN' },
  ml: { enName: 'Malayalam', region: 'asia', ogLocale: 'ml_IN' },
  it: { enName: 'Italian', region: 'europe', ogLocale: 'it_IT' },
  pl: { enName: 'Polish', region: 'europe', ogLocale: 'pl_PL' },
  nl: { enName: 'Dutch', region: 'europe', ogLocale: 'nl_NL' },
  vi: { enName: 'Vietnamese', region: 'asia', ogLocale: 'vi_VN' },
  th: { enName: 'Thai', region: 'asia', ogLocale: 'th_TH' },
  uk: { enName: 'Ukrainian', region: 'europe', ogLocale: 'uk_UA' },
  cs: { enName: 'Czech', region: 'europe', ogLocale: 'cs_CZ' },
  sv: { enName: 'Swedish', region: 'europe', ogLocale: 'sv_SE' },
  ro: { enName: 'Romanian', region: 'europe', ogLocale: 'ro_RO' },
  el: { enName: 'Greek', region: 'europe', ogLocale: 'el_GR' },
  hu: { enName: 'Hungarian', region: 'europe', ogLocale: 'hu_HU' },
  ms: { enName: 'Malay', region: 'asia', ogLocale: 'ms_MY' },
  tl: { enName: 'Tagalog', region: 'asia', popular: true, ogLocale: 'tl_PH' },
  my: { enName: 'Burmese', region: 'asia', ogLocale: 'my_MM' },
  km: { enName: 'Khmer', region: 'asia', ogLocale: 'km_KH' },
  ne: { enName: 'Nepali', region: 'asia', ogLocale: 'ne_NP' },
  si: { enName: 'Sinhala', region: 'asia', ogLocale: 'si_LK' },
  fa: { enName: 'Persian', region: 'mea', popular: true, ogLocale: 'fa_IR' },
  he: { enName: 'Hebrew', region: 'mea', ogLocale: 'he_IL' },
  sw: { enName: 'Swahili', region: 'mea', ogLocale: 'sw_KE' },
  am: { enName: 'Amharic', region: 'mea', ogLocale: 'am_ET' },
  ha: { enName: 'Hausa', region: 'mea', ogLocale: 'ha_NG' },
  uz: { enName: 'Uzbek', region: 'asia', ogLocale: 'uz_UZ' },
  kk: { enName: 'Kazakh', region: 'asia', ogLocale: 'kk_KZ' },
  az: { enName: 'Azerbaijani', region: 'mea', ogLocale: 'az_AZ' },
  af: { enName: 'Afrikaans', region: 'mea', ogLocale: 'af_ZA' },
  ka: { enName: 'Georgian', region: 'europe', ogLocale: 'ka_GE' },
  da: { enName: 'Danish', region: 'europe', ogLocale: 'da_DK' },
  no: { enName: 'Norwegian', region: 'europe', ogLocale: 'nb_NO' },
  fi: { enName: 'Finnish', region: 'europe', ogLocale: 'fi_FI' },
  bg: { enName: 'Bulgarian', region: 'europe', ogLocale: 'bg_BG' },
  be: { enName: 'Belarusian', region: 'europe', ogLocale: 'be_BY' },
  hr: { enName: 'Croatian', region: 'europe', ogLocale: 'hr_HR' },
  sr: { enName: 'Serbian', region: 'europe', ogLocale: 'sr_RS' },
  sk: { enName: 'Slovak', region: 'europe', ogLocale: 'sk_SK' },
  ca: { enName: 'Catalan', region: 'europe', ogLocale: 'ca_ES' },
  sq: { enName: 'Albanian', region: 'europe', ogLocale: 'sq_AL' },
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
