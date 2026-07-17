// Boot hydration + refresh actions — the write-side counterparts of the old
// Vuex actions. Each fetches from the API and patches the store.

import * as api from './api/client.js';
import { store } from './store.js';
import { BASE } from './router.js';

export async function queryMetaData() {
  const [whoami, whoareyou] = await Promise.all([api.whoAmI(), api.whoAreYou()]);
  const meta = { identity: whoareyou };
  if (whoami.type !== 'anonymous') {
    meta.is_anonymous = false;
    meta.device_id = whoami.id;
    meta.device_name = whoami.name;
  } else {
    meta.is_anonymous = true;
  }
  store.set({ meta: { ...store.state.meta, ...meta } });
}

export async function queryProfile({ refresh = false } = {}) {
  const profile = await api.getProfile(refresh ? { refresh: 'true' } : {});
  store.set({ profile });
}

export async function queryTours() {
  store.set({ tours: await api.listTours() });
}

export async function queryDiskUsage() {
  const disk = await api.diskUsage();
  store.set({ disk_usage: { ...disk, disk_space_warning: disk.free_gb < 5 } });
}

export async function refreshApps() {
  store.set({ apps: await api.listAllApps() });
}

export async function refreshTerminals() {
  store.set({ terminals: await api.listAllTerminals() });
}

export async function markTourSeen(name) {
  await api.putTour({ name, status: 'seen' });
  await queryTours();
}

export async function queryUiVersion() {
  try {
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`);
    const data = await res.json();
    store.set({ version: data.version });
  } catch {
    console.error('Failed to load version.json');
  }
}
