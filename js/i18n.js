// i18n — EN + DE, no-build: hand-rolled JSON catalogs (js/i18n/*.json,
// fetched at boot) + t(key, params), native Intl for numbers/dates/plurals.
// The active locale lives in the store ('locale'); FsElement.watch()
// subscribes to it implicitly, so a locale change re-renders the whole UI.
//
// Detection order on load: shard preferences (GET /protected/preferences,
// freeshard#168 — 404 is expected until it ships) → localStorage →
// navigator.language → 'en'. Unsupported locales collapse to 'en'.

import { store } from './store.js';
import { esc } from './components/base.js';
import { getPreferences, putPreferences } from './api/preferences.js';

export const SUPPORTED_LOCALES = ['en', 'de'];
const STORAGE_KEY = 'sundial.locale';
const INTL_TAGS = { en: 'en-US', de: 'de-DE' };
const catalogs = {};

function normalize(tag) {
  const lang = String(tag || '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(lang) ? lang : null;
}

function applyLocale(locale) {
  document.documentElement.lang = locale;
  store.set({ locale });
}

// Load catalogs and detect the locale. Must complete before views render.
export async function initI18n() {
  await Promise.all(SUPPORTED_LOCALES.map(async (loc) => {
    const res = await fetch(`js/i18n/${loc}.json`);   // relative → <base>-aware
    catalogs[loc] = await res.json();
  }));
  let locale = normalize((await getPreferences())?.language);
  if (!locale) {
    try { locale = normalize(localStorage.getItem(STORAGE_KEY)); } catch { /* storage unavailable */ }
  }
  applyLocale(locale ?? normalize(navigator.language) ?? 'en');
}

// Switcher path: apply live, persist locally, sync to the shard —
// the PUT may 404 until freeshard#168 lands, which is fine.
export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === store.state.locale) return;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* storage unavailable */ }
  applyLocale(locale);
  putPreferences({ language: locale });
}

function lookup(catalog, key) {
  let node = catalog;
  for (const part of key.split('.')) {
    node = node?.[part];
    if (node === undefined) return undefined;
  }
  return node;
}

// t(key, { name: 'x', count: 2 }) — catalog values may contain {param}
// placeholders (params are HTML-escaped; {!param} inserts raw for pre-built
// trusted HTML; catalog strings themselves may carry markup) and may be
// plural objects { one, other } selected via Intl.PluralRules on params.count.
export function t(key, params = {}) {
  const { locale } = store.state;
  let value = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key);
  if (value !== null && typeof value === 'object') {
    const rule = new Intl.PluralRules(intlTag()).select(params.count ?? 0);
    value = value[rule] ?? value.other;
  }
  if (typeof value !== 'string') return key;
  return value.replace(/\{(!?)(\w+)\}/g, (_, raw, name) =>
    params[name] === undefined ? `{${raw}${name}}` : raw ? String(params[name]) : esc(params[name]));
}

export function intlTag() {
  return INTL_TAGS[store.state.locale] ?? 'en-US';
}

// ---- Intl formatting bound to the active locale ----

export function fmtNumber(value, options) {
  return new Intl.NumberFormat(intlTag(), options).format(value);
}

// 0.415 → "41.5%" / "41,5 %"
export function fmtPercent(ratio, maxDigits = 1) {
  return fmtNumber(ratio, { style: 'percent', maximumFractionDigits: maxDigits });
}

// "€8.25" / "8,25 €"; null → em-dash placeholder
export function fmtCurrencyEur(amount) {
  if (amount == null) return '€—';
  return fmtNumber(amount, { style: 'currency', currency: 'EUR' });
}
