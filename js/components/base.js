// Shared base for light-DOM custom elements: store subscriptions and timers
// that clean themselves up on disconnect.

import { store } from '../store.js';

export class FsElement extends HTMLElement {
  #unsubs = [];
  #timers = [];

  // Re-run fn when any of the store keys change. fn runs immediately once.
  watch(keys, fn) {
    this.#unsubs.push(store.subscribe(keys, fn));
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
