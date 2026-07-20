// WebSocket connection to /core/protected/ws/updates.
// Reconnect loop mirrors the old app: try every second while authed and
// no socket is open. Store-relevant messages patch the store here; other
// consumers subscribe to specific message types via onMessage().

import { store } from './store.js';
import { queryProfile } from './actions.js';

const bus = new EventTarget();
let socket = null;

export function onMessage(type, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}

// WS payloads are untrusted input: shape-check before they touch the store
// or reach onMessage() consumers. Returns false for anything malformed.
// Exported for unit tests.
export function validateMessage(message) {
  if (!isPlainObject(message) || typeof message.message_type !== 'string') return false;
  const body = message.message;
  switch (message.message_type) {
    case 'apps_update':
    case 'terminals_update':
      return Array.isArray(body) && body.every(isPlainObject);
    case 'disk_usage_update':
      return isPlainObject(body)
        && typeof body.total_gb === 'number' && typeof body.free_gb === 'number';
    case 'app_install_error':
      return isPlainObject(body)
        && typeof body.name === 'string' && typeof body.error === 'string';
    case 'backup_update':
      return body === undefined || body === null
        || (isPlainObject(body) && (body.error === undefined || typeof body.error === 'string'));
    default:
      return true;   // heartbeat, terminal_add, ... — body unused
  }
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function handle(message) {
  if (!validateMessage(message)) {
    console.warn('Dropped malformed WS message', message?.message_type);
    return;
  }
  const { message_type: type, message: body } = message;
  switch (type) {
    case 'apps_update':
      store.set({ apps: body });
      break;
    case 'terminals_update':
      store.set({ terminals: body });
      break;
    case 'disk_usage_update':
      store.set({ disk_usage: { ...body, disk_space_warning: body.free_gb < 5 } });
      break;
    case 'subscription_updated':
      queryProfile({ refresh: true }).catch(() => {});
      break;
  }
  bus.dispatchEvent(new CustomEvent(type, { detail: body }));
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${proto}//${location.host}/core/protected/ws/updates`);
  socket.onmessage = (e) => {
    let message;
    try { message = JSON.parse(e.data); } catch { return; }
    handle(message);
  };
  socket.onerror = () => { socket.close(); socket = null; };
  socket.onclose = () => {
    store.set({ ws: { disconnectedSince: store.state.ws.disconnectedSince ?? Date.now() } });
    socket = null;
  };
  socket.onopen = () => store.set({ ws: { disconnectedSince: null } });
}

export function startWebSocket() {
  setInterval(() => {
    if (!store.state.meta.is_anonymous && !socket) connect();
  }, 1000);
}
