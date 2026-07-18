import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

const TABLE = {
  '': { tag: 'view-home' },
  settings: { tag: 'view-settings' },
  apps: { tag: 'view-apps' },
};

// Fresh router module per test group: BASE is captured at import time from
// window.SUNDIAL_BASE, so use a unique query suffix to defeat the ESM cache.
async function freshRouter({ base, path }) {
  const env = installDom({ base, path });
  const router = await import(`../../js/router.js?${base}${Math.random()}`);
  router.defineRoutes(TABLE);
  return { router, env };
}

test('served at / — href, navigate, currentRoute', async () => {
  const { router, env } = await freshRouter({ base: '/', path: '/' });
  assert.equal(router.BASE, '/');
  assert.equal(router.href('settings'), '/settings');
  assert.equal(router.href('apps', 'section=size'), '/apps?section=size');
  assert.equal(router.href(''), '/');

  router.startRouter();
  assert.equal(router.currentRoute(), '');
  assert.equal(env.view.firstElementChild.tagName, 'VIEW-HOME');

  router.navigate('settings');
  assert.equal(router.currentRoute(), 'settings');
  assert.equal(globalThis.location.pathname, '/settings');
  assert.equal(env.view.firstElementChild.tagName, 'VIEW-SETTINGS');
  assert.deepEqual(globalThis.history.pushed, ['/settings']);
});

test('navigate with replace uses replaceState', async () => {
  const { router } = await freshRouter({ base: '/', path: '/' });
  router.startRouter();
  router.navigate('apps', { replace: true });
  assert.deepEqual(globalThis.history.replaced, ['/apps']);
  assert.deepEqual(globalThis.history.pushed, []);
});

test('unknown path falls back to home', async () => {
  const { router, env } = await freshRouter({ base: '/', path: '/no-such-view' });
  router.startRouter();
  assert.equal(router.currentRoute(), '');
  assert.equal(env.view.firstElementChild.tagName, 'VIEW-HOME');
});

test('index.html maps to home', async () => {
  const { router } = await freshRouter({ base: '/', path: '/index.html' });
  router.startRouter();
  assert.equal(router.currentRoute(), '');
});

test('subpath base — hrefs are base-prefixed, routes resolve', async () => {
  const { router, env } = await freshRouter({ base: '/sundial/', path: '/sundial/settings' });
  assert.equal(router.BASE, '/sundial/');
  assert.equal(router.href('apps'), '/sundial/apps');

  router.startRouter();
  assert.equal(router.currentRoute(), 'settings');
  assert.equal(env.view.firstElementChild.tagName, 'VIEW-SETTINGS');

  router.navigate('apps');
  assert.equal(globalThis.location.pathname, '/sundial/apps');
  assert.equal(router.currentRoute(), 'apps');
});

test('onRouteChange fires with the new route name and unsubscribes', async () => {
  const { router } = await freshRouter({ base: '/', path: '/' });
  router.startRouter();
  const seen = [];
  const off = router.onRouteChange((name) => seen.push(name));
  router.navigate('settings');
  off();
  router.navigate('apps');
  assert.deepEqual(seen, ['settings']);
});
