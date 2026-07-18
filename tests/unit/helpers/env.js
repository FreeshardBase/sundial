// Minimal browser-global stubs so the app's ESM modules import cleanly
// under node:test. Install BEFORE dynamically importing a module under test.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export class FakeNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.innerHTML = '';
  }
  get firstElementChild() { return this.children[0] ?? null; }
  replaceChildren(...nodes) { this.children = nodes; }
  appendChild(node) { this.children.push(node); }
  addEventListener() {}
  removeEventListener() {}
}

// Installs window/location/history/document/localStorage/navigator stubs.
// Returns handles the tests poke at (location, storage map, view element).
export function installDom({ base = '/', path = base } = {}) {
  const view = new FakeNode('main');
  const elements = { view };

  globalThis.HTMLElement = globalThis.HTMLElement ?? class {};
  globalThis.customElements = globalThis.customElements ?? { define() {}, get() {} };

  globalThis.location = {
    origin: 'http://localhost:8021',
    protocol: 'http:',
    host: 'localhost:8021',
    pathname: path,
    search: '',
  };

  globalThis.history = {
    pushed: [],
    replaced: [],
    pushState(_state, _title, url) {
      this.pushed.push(url);
      globalThis.location.pathname = new URL(url, location.origin).pathname;
    },
    replaceState(_state, _title, url) {
      this.replaced.push(url);
      globalThis.location.pathname = new URL(url, location.origin).pathname;
    },
  };

  globalThis.window = { SUNDIAL_BASE: base, addEventListener() {} };

  globalThis.document = {
    documentElement: { lang: '', dataset: {} },
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => elements[id] ?? null,
    addEventListener() {},
  };

  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  globalThis.navigator = { language: 'en-US' };

  return { view, storage };
}

// fetch stub that serves the on-disk i18n catalogs and lets tests script
// the /core/protected/preferences responses + capture all requests.
export function installFetch({ preferences = { status: 404 } } = {}) {
  const calls = [];
  const config = { preferences };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const catalog = url.match(/js\/i18n\/(\w+)\.json/);
    if (catalog) {
      const body = await readFile(`${REPO_ROOT}/js/i18n/${catalog[1]}.json`, 'utf8');
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/core/protected/preferences')) {
      const p = config.preferences;
      if (p.status && p.status >= 400) return new Response('not found', { status: p.status });
      if (p.html) return new Response('<!DOCTYPE html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
      return new Response(JSON.stringify(p.json ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('not mocked: ' + url, { status: 500 });
  };
  return { calls, config };
}
