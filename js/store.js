// Central store — single source of truth, load-all-upfront then patch.
// Components read via store.state and react via store.subscribe(keys, fn).
// Never poke another component's DOM; go through the store.

const initial = {
  locale: 'en',         // active UI language; set via i18n.js only
  meta: {
    is_anonymous: true,
    device_id: 'unknown',
    device_name: 'unknown',
    identity: { id: '', name: '', email: '', description: '', public_key_pem: '', domain: '' },
  },
  version: null,        // latest UI version from version.json (update notice)
  profile: null,        // controller profile; null when unreachable
  apps: [],
  terminals: [],
  tours: [],
  disk_usage: { total_gb: 0, free_gb: 0, disk_space_low: false, disk_space_warning: false },
  ws: { disconnectedSince: null },
  stats: { history: [], latest: null },  // resource-monitor samples (client-built)
};

const bus = new EventTarget();

export const store = {
  state: structuredClone(initial),

  // Shallow-merge patch; notifies one event per changed top-level key.
  set(patch) {
    for (const [key, value] of Object.entries(patch)) {
      this.state[key] = value;
      bus.dispatchEvent(new CustomEvent(key, { detail: value }));
    }
    bus.dispatchEvent(new CustomEvent('*', { detail: patch }));
  },

  // keys: string | string[] | '*'. Returns unsubscribe function.
  subscribe(keys, fn) {
    const list = Array.isArray(keys) ? keys : [keys];
    const handler = () => fn(this.state);
    for (const key of list) bus.addEventListener(key, handler);
    return () => { for (const key of list) bus.removeEventListener(key, handler); };
  },
};

// ---- derived getters ----

export function shortShardId() {
  return store.state.meta.identity.id.substring(0, 6);
}

export function shardHref() {
  return `https://${store.state.meta.identity.domain}`;
}

export function tourSeen(name) {
  const t = store.state.tours.find((t) => t.name === name);
  return Boolean(t && t.status === 'seen');
}
