// App-store metadata from the Freeshard blob store. Branch is fixed to
// master — the old app's branch-switching feature is deliberately not ported.

import { t } from './i18n.js';

const STORE_BASE = 'https://storageaccountportab0da.blob.core.windows.net/app-store/master/all_apps';

let cache = null;

export async function fetchStoreApps({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const res = await fetch(`${STORE_BASE}/store_metadata.json?c=${Date.now()}`);
  if (!res.ok) throw new Error(`store metadata: ${res.status}`);
  cache = (await res.json()).apps;
  return cache;
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
