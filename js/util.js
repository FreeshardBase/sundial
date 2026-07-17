// Small shared helpers (replaces moment / mobile-device-detect).

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
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(ms / size), unit);
  }
  return ms <= 0 ? 'just now' : 'in moments';
}

// Device object for pairing, from the user agent (replaces mobile-device-detect).
export function makeDeviceObject() {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|chromium|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  const isTablet = /ipad|tablet/i.test(ua);
  const isMobile = !isTablet && /mobi|iphone|android/i.test(ua);
  return {
    name: `${browser} on ${os}`,
    icon: isMobile ? 'smartphone' : isTablet ? 'tablet' : 'notebook',
  };
}
