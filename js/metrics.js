// Resource-monitor metrics: client-built history from the snapshot REST
// endpoint proposed in freeshard#155 (GET /protected/stats →
// { cpu_pct, memory_bytes, memory_limit_bytes }). That endpoint has not
// landed server-side yet — until it does, we probe it, mark the monitor
// unsupported on 404, and re-probe occasionally. When the WS stream
// (/protected/stats/stream) ships, plug it in here (never SSE).

import { store } from './store.js';
import { call, ApiError } from './api/client.js';
import { fmtNumber } from './i18n.js';

export const SAMPLE_INTERVAL_MS = 5000;
export const HISTORY_LENGTH = 120;   // 10 min at 5s
const REPROBE_AFTER_MS = 10 * 60 * 1000;

let timer = null;
let unsupportedSince = null;

function push(history, value) {
  const next = [...history, value];
  return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
}

async function sample() {
  const s = store.state.stats;
  if (unsupportedSince && Date.now() - unsupportedSince < REPROBE_AFTER_MS) return;

  let snap;
  try {
    snap = await call('GET', '/protected/stats');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      unsupportedSince = Date.now();
      store.set({ stats: { ...s, supported: false } });
      return;
    }
    // transient failure → gap sample
    store.set({
      stats: {
        ...s,
        cpu: push(s.cpu ?? [], null),
        mem: push(s.mem ?? [], null),
      },
    });
    return;
  }
  unsupportedSince = null;
  store.set({
    stats: {
      supported: true,
      cpu: push(s.cpu ?? [], snap.cpu_pct ?? null),
      mem: push(s.mem ?? [], snap.memory_bytes ?? null),
      memLimit: snap.memory_limit_bytes ?? s.memLimit ?? null,
      latest: snap,
    },
  });
}

export function startMetrics() {
  if (timer) return;
  store.set({ stats: { supported: null, cpu: [], mem: [], memLimit: null, latest: null } });
  sample();
  timer = setInterval(sample, SAMPLE_INTERVAL_MS);
}

export function formatBytes(bytes) {
  if (bytes == null) return '—';
  const gib = bytes / 2 ** 30;
  if (gib >= 1) return `${fmtNumber(gib, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GiB`;
  return `${fmtNumber(bytes / 2 ** 20, { maximumFractionDigits: 0 })} MiB`;
}
