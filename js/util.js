// Small shared helpers (replaces moment / mobile-device-detect).

import { t, intlTag } from './i18n.js';

// "YYYY-MM-DD HH:mm" in local time; backend timestamps are UTC ISO strings
// (sometimes without a Z suffix — treat those as UTC, as moment.utc did).
export function parseUtc(value) {
  if (typeof value === 'string' && !/Z$|[+-]\d\d:\d\d$/.test(value)) {
    value += 'Z';
  }
  return new Date(value);
}

export function formatDate(value) {
  const d = parseUtc(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Humanized relative time ("in 3 days", "2 hours ago") like moment's
// duration.humanize(true).
export function formatRelative(value, now = Date.now()) {
  const ms = parseUtc(value).getTime() - now;
  const abs = Math.abs(ms);
  const units = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];
  const rtf = new Intl.RelativeTimeFormat(intlTag(), { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(ms / size), unit);
  }
  return ms <= 0 ? t('common.justNow') : t('common.inMoments');
}

// Exact date (optionally + time) for a formatRelative() value, locale-aware —
// meant as the `title` tooltip on relative-time text. dateOnly drops the time
// part (used on the Settings screen, where the day is enough context).
export function formatAbsolute(value, { dateOnly = false } = {}) {
  const options = dateOnly ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' };
  return new Intl.DateTimeFormat(intlTag(), options).format(parseUtc(value));
}

// Disk-usage gauge reading — the honest ratio (used/total) plus the same
// low/warning/normal tone selection fillDiskBar used to apply via CSSOM.
// Feed straight into an <fs-gauge>'s `.reading` setter (js/components/gauge.js).
export function diskGaugeReading(du) {
  const used = du.total_gb - du.free_gb;
  return {
    value: used,
    max: du.total_gb,
    tone: du.disk_space_low ? 'danger' : du.disk_space_warning ? 'warning' : 'normal',
  };
}

// Device object for pairing, from the user agent (replaces mobile-device-detect).
export function makeDeviceObject() {
  const ua = navigator.userAgent;
  let browser = t('pair.genericBrowser');
  if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|chromium|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  let os = t('pair.unknownOs');
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  const isTablet = /ipad|tablet/i.test(ua);
  const isMobile = !isTablet && /mobi|iphone|android/i.test(ua);
  return {
    name: t('pair.deviceName', { browser, os }),
    icon: isMobile ? 'smartphone' : isTablet ? 'tablet' : 'notebook',
  };
}
