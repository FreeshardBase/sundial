// App-store metadata from the Freeshard blob store. Branch is fixed to
// master — the old app's branch-switching feature is deliberately not ported.

import { t } from './i18n.js';

const STORE_BASE = 'https://storageaccountportab0da.blob.core.windows.net/app-store/master/all_apps';

// The shard's own running freeshard version lives at this same-origin public
// endpoint (freeshard#246). Read as plain JSON, deliberately NOT through the
// generated js/api/client.js — same stance as fetchStoreApps below.
const SHARD_VERSION_URL = '/core/public/meta/version';

let cache = null;

export async function fetchStoreApps({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const res = await fetch(`${STORE_BASE}/store_metadata.json?c=${Date.now()}`);
  if (!res.ok) throw new Error(`store metadata: ${res.status}`);
  cache = (await res.json()).apps;
  return cache;
}

let versionCache = null;

// The shard's running freeshard version, or null if it can't be read — an old
// shard predating the endpoint (freeshard#246), or a transient failure. null
// is the "unknown" signal the version gate below fails safe on. Only successful
// reads are cached, so a transient failure retries on the next call.
export async function fetchShardVersion({ refresh = false } = {}) {
  if (versionCache && !refresh) return versionCache;
  try {
    const res = await fetch(`${SHARD_VERSION_URL}?c=${Date.now()}`);
    if (!res.ok) return null;
    versionCache = (await res.json()).version ?? null;
    return versionCache;
  } catch {
    return null;
  }
}

// An app's declared minimum freeshard version, or undefined if none. Read from
// both shapes a single app object can arrive in — store-catalogue entries carry
// it flat, the shard's installed-app list nests it under meta — so one helper
// serves both views and there is no per-file field split to drift (sundial#6).
export function minimumFreeshardVersion(app) {
  return app?.meta?.minimum_freeshard_version ?? app?.minimum_freeshard_version;
}

// Parse a release version ("0.1.2", "1.5") into a numeric segment array, or
// null if it has no leading numeric release. Any pre-release / local suffix
// (rc1, +build) is ignored — real shard versions are plain releases, and
// ignoring the suffix only ever treats a pre-release as its base release.
function parseVersion(v) {
  const m = /^\s*v?(\d+(?:\.\d+)*)/.exec(String(v ?? ''));
  if (!m) return null;
  return m[1].split('.').map(Number);
}

// Whether `shardVersion` is >= the app's declared minimum freeshard version.
// No declared minimum is always compatible. Anything we can't confirm — an
// unknown shard version (null), or either side unparseable — fails safe to
// INCOMPATIBLE: we hide rather than offer an app the shard may be too old to
// run, mirroring the server-side gate (freeshard#246).
export function minimumFreeshardVersionCompatible(app, shardVersion) {
  const min = minimumFreeshardVersion(app);
  if (!min) return true;
  const have = parseVersion(shardVersion);
  const want = parseVersion(min);
  if (!have || !want) return false;
  const len = Math.max(have.length, want.length);
  for (let i = 0; i < len; i++) {
    const a = have[i] ?? 0;
    const b = want[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

export function storeIconUrl(app) {
  return `${STORE_BASE}/${app.name}/${app.icon}`;
}

export function storeInfo(app) {
  return app.store_info || app.meta?.store_info || {
    description_short: t('apps.unknownApp'),
    description_long: undefined,
    hint: undefined,
    is_featured: false,
  };
}
