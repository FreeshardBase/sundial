// Registers the installability service worker (sw.js, network passthrough).
// The URL is resolved against the injected <base> (js/base.js), so the SW
// scope is "/" at the root and "/sundial/" under the subpath.

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(new URL('sw.js', document.baseURI))
    .catch((e) => console.error('service worker registration failed', e));
}
