// Update propagation: the entry point, service worker and version probe must
// never be cached, or a "refresh to update" reload can be served stale from
// the browser cache (seen on Firefox Android home-screen installs, issue #37).
// data/nginx.conf (core-release root) and deploy/nginx-sundial.conf (the
// /sundial/ coexistence path) must BOTH send Cache-Control: no-cache for them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REPO_ROOT } from './helpers/env.js';

const containerNginx = await readFile(`${REPO_ROOT}/data/nginx.conf`, 'utf8');
const deployNginx = await readFile(`${REPO_ROOT}/deploy/nginx-sundial.conf`, 'utf8');

// The no-cache rule in each conf: a location matching exactly the three files,
// whose body uses `expires -1` (sends Cache-Control: no-cache without
// suppressing the inherited security add_header set).
const NO_CACHE_BLOCK = /location\s+~\s+\^([^\s]*)\(index\\\.html\|sw\\\.js\|version\\\.json\)\$\s*\{([^}]*)\}/;

test('container nginx no-caches index.html, sw.js and version.json at the root', () => {
  const m = containerNginx.match(NO_CACHE_BLOCK);
  assert.ok(m, 'data/nginx.conf is missing the no-cache location for the three files');
  assert.equal(m[1], '/', 'root conf should match the files at /');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the no-cache block');
});

test('deploy nginx no-caches the same three files under /sundial/', () => {
  const m = deployNginx.match(NO_CACHE_BLOCK);
  assert.ok(m, 'deploy/nginx-sundial.conf is missing the no-cache location for the three files');
  assert.equal(m[1], '/sundial/', 'deploy conf must scope the rule to the /sundial/ subpath');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the no-cache block');
});

test('deploy no-cache block inherits security headers: nested in /sundial/, sets no add_header of its own', () => {
  const subpathOpen = deployNginx.indexOf('location /sundial/ {');
  const noCacheAt = deployNginx.search(NO_CACHE_BLOCK);
  const cspHeaderAt = deployNginx.indexOf('add_header Content-Security-Policy');
  assert.ok(subpathOpen >= 0, '/sundial/ location missing');
  // The no-cache block must sit INSIDE the /sundial/ block, after its
  // add_header set — nginx drops inherited add_header from any block that
  // declares its own, so the nested block must declare none.
  assert.ok(noCacheAt > cspHeaderAt && cspHeaderAt > subpathOpen,
    'no-cache block must be nested under /sundial/ after its security headers');
  const [, , body] = deployNginx.match(NO_CACHE_BLOCK);
  assert.doesNotMatch(body, /add_header/,
    'the no-cache block must not set add_header, or it would drop the inherited security headers');
});
