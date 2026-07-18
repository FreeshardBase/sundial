import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { getPreferences, putPreferences } = await import('../../js/api/preferences.js');

function respond(status, body, contentType) {
  globalThis.fetch = async () => new Response(body, {
    status,
    headers: contentType ? { 'Content-Type': contentType } : {},
  });
}

test('getPreferences returns the object on JSON 200', async () => {
  respond(200, '{"language":"de"}', 'application/json');
  assert.deepEqual(await getPreferences(), { language: 'de' });
});

test('getPreferences → null on 404 (endpoint not shipped, freeshard#168)', async () => {
  respond(404, '{"detail":"Not Found"}', 'application/json');
  assert.equal(await getPreferences(), null);
});

test('getPreferences → null on 200 HTML (dev-server SPA fallback)', async () => {
  respond(200, '<!DOCTYPE html><html></html>', 'text/html');
  assert.equal(await getPreferences(), null);
});

test('getPreferences → null on network error', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  assert.equal(await getPreferences(), null);
});

test('putPreferences sends the patch and reports ok', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response('{}', { status: 200 });
  };
  assert.equal(await putPreferences({ language: 'de' }), true);
  assert.ok(captured.url.endsWith('/core/protected/preferences'));
  assert.equal(captured.init.method, 'PUT');
  assert.deepEqual(JSON.parse(captured.init.body), { language: 'de' });
});

test('putPreferences → false on 404 and on network error', async () => {
  respond(404, 'nope');
  assert.equal(await putPreferences({ language: 'de' }), false);
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  assert.equal(await putPreferences({ language: 'de' }), false);
});
