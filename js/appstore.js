// App-store metadata from the Freeshard blob store. Branch is fixed to
// master — the old app's branch-switching feature is deliberately not ported.

import { t } from './i18n.js';
import { getVersion } from './api/client.js';

const STORE_BASE = 'https://storageaccountportab0da.blob.core.windows.net/app-store/master/all_apps';

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
//
// Goes through the generated js/api/client.js, unlike fetchStoreApps above:
// that one reads from an external Azure blob, not a shard_core API route, so
// it has nothing to generate a client against. GET /public/meta/version is a
// shard_core route with generated siblings (whoAreYou, whoAmI) already in
// client.js, so this follows them instead of hand-rolling a second fetch path.
export async function fetchShardVersion({ refresh = false } = {}) {
  if (versionCache && !refresh) return versionCache;
  try {
    const { version } = await getVersion();
    if (version) versionCache = version;   // ignore an empty/missing version
  } catch {
    /* keep whatever we last knew — a failed refresh should not throw away a
       good value and hide every app until the next successful fetch */
  }
  return versionCache;
}

// An app's declared minimum freeshard version, or undefined if none. Read from
// both shapes a single app object can arrive in — store-catalogue entries carry
// it flat, the shard's installed-app list nests it under meta — so one helper
// serves both views and there is no per-file field split to drift (sundial#6).
export function minimumFreeshardVersion(app) {
  return app?.meta?.minimum_freeshard_version ?? app?.minimum_freeshard_version;
}

// Parse a version ("0.1.2", "1.5", "1.4.0rc1") into its numeric release segments
// plus whether a pre-release/dev suffix follows, or null if there is no leading
// numeric release. We don't implement full PEP 440 ordering of the suffix
// itself — shard versions are plain releases — but we record a suffix's presence
// so an exact-release match against a pre-release shard build fails safe below.
function parseVersion(v) {
  const m = /^\s*v?(\d+(?:\.\d+)*)(.*)$/.exec(String(v ?? ''));
  if (!m) return null;
  return { release: m[1].split('.').map(Number), pre: m[2].trim() !== '' };
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
  const len = Math.max(have.release.length, want.release.length);
  for (let i = 0; i < len; i++) {
    const a = have.release[i] ?? 0;
    const b = want.release[i] ?? 0;
    if (a !== b) return a > b;
  }
  // Release segments are equal. A pre-release/dev shard build sorts below its
  // own release (PEP 440), so it does not satisfy a plain-release minimum —
  // the server would reject the install, so we must not offer the app.
  return !have.pre;
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
