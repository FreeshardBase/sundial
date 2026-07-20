// Minimal service worker for PWA installability ONLY.
//
// The fetch handler is a deliberate no-op: every request falls through to the
// browser's default network handling, untouched. Do NOT add caching here —
// Sundial is no-build ("edited files == served") and any cache would serve
// stale assets. Offline support is explicitly out of scope
// (tests/unit/manifest.test.js enforces this stays passthrough-only).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
