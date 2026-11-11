import { type Dict, type Key, tr } from './tr';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { zh } from './locales/zh';

export type { Key };

const DICTS: Record<string, Dict> = { tr, en, de, es, fr, hi, id, it, ja, ko, pt, ru, zh };

/** Device language from the JS engine's Intl (no extra package); anything we don't have plays in English. */
function detect(): string {
  let tag = 'en';
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    // Intl missing: stay English.
  }
  const lang = tag.toLowerCase().split(/[-_]/)[0];
  return lang in DICTS ? lang : 'en';
}

export const lang = detect();
const dict = DICTS[lang];

/** Translated text for `key`, with {placeholders} filled from `params`. */
export function t(key: Key, params?: Record<string, string | number>): string {
  let s = dict[key] ?? en[key] ?? tr[key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/**
 * Text around one placeholder, for styling the inserted part:
 * split('welcome', 'name') -> ['Welcome, ', ''].
 */
export function split(key: Key, placeholder: string): [string, string] {
  const s = dict[key] ?? en[key] ?? tr[key];
  const i = s.indexOf(`{${placeholder}}`);
  if (i < 0) return [s, ''];
  return [s.slice(0, i), s.slice(i + placeholder.length + 2)];
}

// The rule engine and the server answer in Turkish. Map those messages to keys
// so they reach the player in their language; unknown text passes through.
const ERR_KEYS = Object.keys(tr).filter((k) => k.startsWith('err')) as Key[];
const byText = new Map<string, Key>();
for (const k of ERR_KEYS) if (!tr[k].includes('{')) byText.set(tr[k], k);
const PATTERNS: { re: RegExp; key: Key; names: string[] }[] = [
  { re: /^Geçersiz per: (.*)$/, key: 'errInvalidMeldTiles', names: ['tiles'] },
  { re: /^Açmak için en az (\d+) gerekli \((\d+)\)$/, key: 'errOpenNeeds', names: ['need', 'total'] },
];

export function tErr(message: string): string {
  if (lang === 'tr') return message;
  const k = byText.get(message);
  if (k) return t(k);
  for (const p of PATTERNS) {
    const m = p.re.exec(message);
    if (m) return t(p.key, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
  }
  return message;
}
