// Owner-preferences endpoint (freeshard#168) — HAND-WRITTEN, not generated:
// the endpoint is not in the OpenAPI spec yet. Swap for the generated client
// once #168 ships server-side. Until then a 404 is the normal case; the mock
// dev server even answers unknown /core GETs with index.html (SPA fallback),
// so anything non-2xx or non-JSON counts as "endpoint not available".

import { API_ROOT } from './client.js';

const PATH = `${API_ROOT}/protected/preferences`;

// → preferences object (extensible; read only what you need) or null.
export async function getPreferences() {
  try {
    const res = await fetch(PATH);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

// Fire-and-forget sync; resolves false while the endpoint doesn't exist.
export async function putPreferences(patch) {
  try {
    const res = await fetch(PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch {
    return false;
  }
}
