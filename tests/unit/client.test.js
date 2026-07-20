import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { call, ApiError, API_ROOT, installApp, whoAmI } = await import('../../js/api/client.js');

let lastRequest = null;
function respond(status, body, contentType = 'application/json') {
  globalThis.fetch = async (url, init) => {
    lastRequest = { url: String(url), init };
    return new Response(body === undefined ? null : body, {
      status,
      headers: contentType ? { 'Content-Type': contentType } : {},
    });
  };
}

test('API root is same-origin absolute, independent of app subpath', () => {
  assert.equal(API_ROOT, '/core');
});

test('call() builds the URL under /core with query params', async () => {
  respond(200, '{}');
  await call('GET', '/protected/apps', { query: { a: 1, skip: undefined, drop: null, b: 'x y' } });
  const url = new URL(lastRequest.url);
  assert.equal(url.pathname, '/core/protected/apps');
  assert.equal(url.searchParams.get('a'), '1');
  assert.equal(url.searchParams.get('b'), 'x y');
  assert.equal(url.searchParams.has('skip'), false);
  assert.equal(url.searchParams.has('drop'), false);
});

test('call() sends JSON bodies with content-type', async () => {
  respond(200, '{}');
  await call('PUT', '/protected/identities', { json: { name: 'Max' } });
  assert.equal(lastRequest.init.method, 'PUT');
  assert.equal(lastRequest.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(lastRequest.init.body), { name: 'Max' });
});

test('call() returns parsed JSON for JSON responses', async () => {
  respond(200, '{"type":"terminal"}');
  assert.deepEqual(await call('GET', '/public/meta/whoami'), { type: 'terminal' });
});

test('call() returns the raw Response for non-JSON responses', async () => {
  respond(200, 'PNG-bytes', 'image/png');
  const res = await call('GET', '/public/meta/avatar');
  assert.ok(res instanceof Response);
  assert.equal(await res.text(), 'PNG-bytes');
});

test('non-2xx throws ApiError with backend detail extraction', async (tc) => {
  await tc.test('detail field', async () => {
    respond(401, '{"detail":"Invalid pairing code"}');
    await assert.rejects(call('POST', '/public/pair/terminal'), (e) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 401);
      assert.equal(e.detail, 'Invalid pairing code');
      return true;
    });
  });

  await tc.test('error field fallback', async () => {
    respond(500, '{"error":"boom"}');
    await assert.rejects(call('GET', '/protected/apps'), (e) => e.detail === 'boom');
  });

  await tc.test('message field fallback', async () => {
    respond(500, '{"message":"kaputt"}');
    await assert.rejects(call('GET', '/protected/apps'), (e) => e.detail === 'kaputt');
  });

  await tc.test('non-JSON body falls back to the status text', async () => {
    // res.json() consumes the body, so the text() retry can't re-read it —
    // statusText is what survives (same in browsers).
    globalThis.fetch = async () => new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    await assert.rejects(call('GET', '/protected/apps'), (e) => e.status === 502 && e.detail === 'Bad Gateway');
  });
});

test('generated wrappers hit the right endpoints', async () => {
  respond(200, '{}');
  await installApp('file browser');
  assert.equal(new URL(lastRequest.url).pathname, '/core/protected/apps/file%20browser');
  assert.equal(lastRequest.init.method, 'POST');

  await whoAmI();
  assert.equal(new URL(lastRequest.url).pathname, '/core/public/meta/whoami');
});
