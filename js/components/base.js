// Shared base for light-DOM custom elements: store subscriptions and timers
// that clean themselves up on disconnect.

import { store } from '../store.js';

export class FsElement extends HTMLElement {
  #unsubs = [];
  #timers = [];

  // Re-run fn when any of the store keys change. fn runs immediately once.
  // 'locale' is always included, so every watching component re-renders
  // when the UI language changes.
  watch(keys, fn) {
    const list = [...new Set([...(Array.isArray(keys) ? keys : [keys]), 'locale'])];
    this.#unsubs.push(store.subscribe(list, fn));
    fn(store.state);
  }

  every(ms, fn) {
    this.#timers.push(setInterval(fn, ms));
  }

  after(ms, fn) {
    this.#timers.push(setTimeout(fn, ms));
  }

  disconnectedCallback() {
    for (const u of this.#unsubs) u();
    for (const t of this.#timers) { clearInterval(t); clearTimeout(t); }
    this.#unsubs = [];
    this.#timers = [];
  }
}

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
