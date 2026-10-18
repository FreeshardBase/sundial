import test from 'node:test';
import assert from 'node:assert/strict';
import { safeOidcReturn, oidcReturnFromSearch, AUTHORIZE_PATH } from '../../js/oidc-return.js';

const ORIGIN = 'https://abc123.freeshard.cloud';
const AUTHORIZE = `${ORIGIN}${AUTHORIZE_PATH}?client_id=immich&response_type=code&state=s1&code_challenge=x&code_challenge_method=S256`;

test('accepts the absolute same-origin authorize URL shard_core sends', () => {
  assert.equal(safeOidcReturn(AUTHORIZE, ORIGIN), AUTHORIZE);
  assert.equal(safeOidcReturn(`${ORIGIN}${AUTHORIZE_PATH}`, ORIGIN), `${ORIGIN}${AUTHORIZE_PATH}`);
});

test('returns the normalized href, not the raw string', () => {
  assert.equal(
    safeOidcReturn(`HTTPS://ABC123.FREESHARD.CLOUD${AUTHORIZE_PATH}?a=1`, ORIGIN),
    `${ORIGIN}${AUTHORIZE_PATH}?a=1`,
  );
});

test('reads and decodes oidc_rd from a query string', () => {
  const search = `?oidc_rd=${encodeURIComponent(AUTHORIZE)}`;
  assert.equal(oidcReturnFromSearch(search, ORIGIN), AUTHORIZE);
  assert.equal(oidcReturnFromSearch('?foo=1', ORIGIN), null);
  assert.equal(oidcReturnFromSearch('', ORIGIN), null);
});

const REJECT = {
  'other origin': `https://evil.example${AUTHORIZE_PATH}?client_id=x`,
  'sibling subdomain': `https://immich.abc123.freeshard.cloud${AUTHORIZE_PATH}`,
  'origin as subdomain prefix': `https://abc123.freeshard.cloud.evil.example${AUTHORIZE_PATH}`,
  'other scheme, same host': `http://abc123.freeshard.cloud${AUTHORIZE_PATH}`,
  'other port': `https://abc123.freeshard.cloud:8443${AUTHORIZE_PATH}`,
  'javascript: URL': 'javascript:alert(document.domain)',
  'javascript: with authorize path in it': `javascript://abc123.freeshard.cloud${AUTHORIZE_PATH}%0aalert(1)`,
  'data: URL': 'data:text/html,<script>alert(1)</script>',
  'protocol-relative': `//evil.example${AUTHORIZE_PATH}`,
  'relative path': AUTHORIZE_PATH,
  'relative path with query': `${AUTHORIZE_PATH}?client_id=x`,
  'backslash host trick': `https:\\\\evil.example${AUTHORIZE_PATH}`,
  'backslash after origin': `${ORIGIN}\\@evil.example${AUTHORIZE_PATH}`,
  'slash-backslash': `/\\evil.example${AUTHORIZE_PATH}`,
  'userinfo pointing elsewhere': `https://abc123.freeshard.cloud@evil.example${AUTHORIZE_PATH}`,
  'userinfo on our own origin': `https://user:pw@abc123.freeshard.cloud${AUTHORIZE_PATH}`,
  'other path': `${ORIGIN}/core/public/oidc/token`,
  'root path': `${ORIGIN}/`,
  'authorize path prefix': `${ORIGIN}${AUTHORIZE_PATH}/extra`,
  'authorize path with trailing slash': `${ORIGIN}${AUTHORIZE_PATH}/`,
  'dot-segment escape': `${ORIGIN}${AUTHORIZE_PATH}/../../../../evil`,
  'encoded slash smuggling': `${ORIGIN}${AUTHORIZE_PATH}%2F..%2Fevil`,
  'double-slash path': `${ORIGIN}//evil.example${AUTHORIZE_PATH}`,
  'unparsable': 'http://[::1',
  'empty string': '',
  'whitespace': '   ',
  null: null,
  undefined,
  'non-string': { toString: () => AUTHORIZE },
};

for (const [name, raw] of Object.entries(REJECT)) {
  test(`rejects ${name}`, () => {
    assert.equal(safeOidcReturn(raw, ORIGIN), null);
  });
}

test('rejects everything when the page origin is opaque ("null")', () => {
  assert.equal(safeOidcReturn('javascript:alert(1)', 'null'), null);
  assert.equal(safeOidcReturn(AUTHORIZE, 'null'), null);
  assert.equal(safeOidcReturn(AUTHORIZE, ''), null);
});
