// PWA installability: manifest shape, icon files, index.html wiring, and the
// installability-only service worker (network passthrough — NO caching; a
// caching SW would fight the no-build "edited files == served" invariant).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REPO_ROOT } from './helpers/env.js';

const html = await readFile(`${REPO_ROOT}/index.html`, 'utf8');
const raw = await readFile(`${REPO_ROOT}/manifest.webmanifest`, 'utf8');
const manifest = JSON.parse(raw);

test('manifest has the fields browser install criteria require', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length > 0);
  assert.equal(typeof manifest.short_name, 'string');
  assert.ok(manifest.short_name.length <= 12, 'short_name should fit under a home-screen icon');
  assert.equal(typeof manifest.description, 'string');
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
});

test('manifest start_url and scope are relative, so subpath serving works', () => {
  // resolved against the manifest URL: "/" -> "/", "/sundial/" -> "/sundial/"
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});

test('manifest icons cover 192 + 512 plus a maskable variant, files are real PNGs', async () => {
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'), 'needs a 192x192 icon');
  assert.ok(sizes.includes('512x512'), 'needs a 512x512 icon');
  assert.ok(manifest.icons.some((i) => (i.purpose ?? '').includes('maskable')),
    'needs a maskable icon');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} must stay relative for subpath serving`);
    assert.equal(icon.type, 'image/png');
    const buf = await readFile(`${REPO_ROOT}/${icon.src}`);
    assert.equal(buf.subarray(0, 4).toString('latin1'), '\x89PNG', `${icon.src} is not a PNG`);
  }
});

test('index.html links the manifest and carries theme/apple meta', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<meta name="theme-color"/);
  assert.match(html, /<link rel="apple-touch-icon" href="[^"]+"/);
  const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)[1];
  assert.ok(!touch.startsWith('/'), 'apple-touch-icon must stay relative for subpath serving');
});

test('service worker is passthrough-only: no caching, no imports', async () => {
  const sw = await readFile(`${REPO_ROOT}/sw.js`, 'utf8');
  assert.match(sw, /addEventListener\('fetch'/, 'installability needs a fetch handler');
  for (const forbidden of ['caches', 'CacheStorage', 'indexedDB', 'importScripts']) {
    assert.ok(!sw.includes(forbidden),
      `sw.js must not use ${forbidden} — offline caching is out of scope (stale-asset risk)`);
  }
});

test('the app registers the service worker base-aware', async () => {
  const pwa = await readFile(`${REPO_ROOT}/js/pwa.js`, 'utf8');
  assert.match(pwa, /serviceWorker/);
  assert.match(pwa, /sw\.js/);
  const main = await readFile(`${REPO_ROOT}/js/main.js`, 'utf8');
  assert.match(main, /pwa\.js/);
});
