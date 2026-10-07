import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, installFetch } from './helpers/env.js';

const env = installDom();
const fetchEnv = installFetch();
const { store } = await import('../../js/store.js');
const i18n = await import('../../js/i18n.js');
const { t, initI18n, setLocale, fmtNumber, fmtPercent, fmtCurrencyEur, intlTag } = i18n;

// Intl output uses nbsp/narrow-nbsp; normalize for stable assertions.
const norm = (s) => s.replace(/[  ]/g, ' ');

test('locale detection order', async (tc) => {
  await tc.test('shard preferences win', async () => {
    fetchEnv.config.preferences = { json: { language: 'de' } };
    env.storage.set('sundial.locale', 'en');
    await initI18n();
    assert.equal(store.state.locale, 'de');
    assert.equal(globalThis.document.documentElement.lang, 'de');
  });

  await tc.test('404 preferences → localStorage', async () => {
    fetchEnv.config.preferences = { status: 404 };
    env.storage.set('sundial.locale', 'de');
    await initI18n();
    assert.equal(store.state.locale, 'de');
  });

  await tc.test('HTML SPA-fallback response counts as absent endpoint', async () => {
    fetchEnv.config.preferences = { html: true };
    env.storage.set('sundial.locale', 'de');
    await initI18n();
    assert.equal(store.state.locale, 'de');
  });

  await tc.test('no preference anywhere → navigator.language', async () => {
    fetchEnv.config.preferences = { status: 404 };
    env.storage.delete('sundial.locale');
    globalThis.navigator.language = 'de-AT';
    await initI18n();
    assert.equal(store.state.locale, 'de');
  });

  await tc.test('unsupported navigator locale → en', async () => {
    env.storage.delete('sundial.locale');
    globalThis.navigator.language = 'fr-FR';
    await initI18n();
    assert.equal(store.state.locale, 'en');
  });
});

test('t() lookup and interpolation', async (tc) => {
  fetchEnv.config.preferences = { status: 404 };
  env.storage.delete('sundial.locale');
  globalThis.navigator.language = 'en-US';
  await initI18n();

  await tc.test('plain key resolves', () => {
    assert.equal(t('dock.home'), 'Home');
  });

  await tc.test('params are HTML-escaped', () => {
    assert.equal(t('title.home', { id: '<b>x</b>' }), 'Shard [&lt;b&gt;x&lt;/b&gt;] - Home');
  });

  await tc.test('{!param} inserts raw HTML', () => {
    const out = t('terminals.navigateTo', { link: '<a href="/pair">pair</a>' });
    assert.ok(out.includes('<a href="/pair">pair</a>'), out);
  });

  await tc.test('plural via Intl.PluralRules on count', () => {
    assert.equal(t('apps.updatesAvailable', { count: 1 }), 'There is one app with an update available.');
    assert.equal(t('apps.updatesAvailable', { count: 3 }), 'There are 3 apps with updates available.');
  });

  await tc.test('missing key returns the key itself', () => {
    assert.equal(t('no.such.key'), 'no.such.key');
  });

  await tc.test('missing param placeholder is left intact', () => {
    assert.equal(t('title.home', {}), 'Shard [{id}] - Home');
  });
});

test('t() in German + fallback to en', async () => {
  fetchEnv.config.preferences = { json: { language: 'de' } };
  await initI18n();
  assert.equal(store.state.locale, 'de');
  assert.equal(t('dock.home'), 'Start');
  assert.equal(t('apps.updatesAvailable', { count: 1 }), 'Für eine App ist ein Update verfügbar.');
  assert.equal(t('apps.updatesAvailable', { count: 2 }), 'Für 2 Apps sind Updates verfügbar.');
  // key missing in both catalogs still returns the key under de
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('Intl formatting follows the active locale', async () => {
  fetchEnv.config.preferences = { json: { language: 'en' } };
  await initI18n();
  assert.equal(intlTag(), 'en-US');
  assert.equal(fmtNumber(1234.5, { minimumFractionDigits: 1 }), '1,234.5');
  assert.equal(fmtPercent(0.415), '41.5%');
  assert.equal(norm(fmtCurrencyEur(8.25)), '€8.25');
  assert.equal(fmtCurrencyEur(null), '€—');

  fetchEnv.config.preferences = { json: { language: 'de' } };
  await initI18n();
  assert.equal(intlTag(), 'de-DE');
  assert.equal(fmtNumber(1234.5, { minimumFractionDigits: 1 }), '1.234,5');
  assert.equal(norm(fmtPercent(0.415)), '41,5 %');
  assert.equal(norm(fmtCurrencyEur(8.25)), '8,25 €');
});

test('setLocale applies, persists, and PUTs to the shard', async () => {
  fetchEnv.config.preferences = { json: { language: 'de' } };
  await initI18n();
  fetchEnv.calls.length = 0;

  setLocale('en');
  assert.equal(store.state.locale, 'en');
  assert.equal(env.storage.get('sundial.locale'), 'en');
  const put = fetchEnv.calls.find((c) => c.init.method === 'PUT');
  assert.ok(put, 'PUT /protected/preferences sent');
  assert.deepEqual(JSON.parse(put.init.body), { language: 'en' });

  // same locale and unsupported locale are no-ops
  fetchEnv.calls.length = 0;
  setLocale('en');
  setLocale('xx');
  assert.equal(fetchEnv.calls.length, 0);
  assert.equal(store.state.locale, 'en');
});
