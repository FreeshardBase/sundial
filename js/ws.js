// WebSocket connection to /core/protected/ws/updates.
// Reconnect loop mirrors the old app: try every second while authed and
// no socket is open. Store-relevant messages patch the store here; other
// consumers subscribe to specific message types via onMessage().

import { store } from './store.js';

const bus = new EventTarget();
let socket = null;

export function onMessage(type, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}

function handle(message) {
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
  }
  bus.dispatchEvent(new CustomEvent(type, { detail: body }));
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${proto}//${location.host}/core/protected/ws/updates`);
  socket.onmessage = (e) => handle(JSON.parse(e.data));
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
