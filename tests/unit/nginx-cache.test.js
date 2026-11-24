// Update propagation: the entry point, service worker and version probe must
// never be cached, or a "refresh to update" reload can be served stale from
// the browser cache (seen on Firefox Android home-screen installs, issue #37).
// data/nginx.conf (core-release root) and deploy/nginx-sundial.conf (the
// /sundial/ coexistence path) must BOTH send Cache-Control: no-cache for them,
// and the no-cache block must NOT set its own add_header — nginx drops the
// inherited security headers (CSP etc.) from any block that declares one.
//
// First-party js/ and css/ carry the same risk under stable, unhashed
// filenames (a core-release shard's update banner reload could still serve a
// cached js/version.js, reporting the old version forever). vendor/ is
// deliberately excluded: pinned third-party files that don't change per
// release, and no-caching them would also fight the separate .mjs
// default_type location in data/nginx.conf (first matching regex location
// wins in nginx, so a js|css|vendor no-cache rule placed before it would
// shadow that mime-type override for vendor's .mjs files).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REPO_ROOT } from './helpers/env.js';

const containerNginx = await readFile(`${REPO_ROOT}/data/nginx.conf`, 'utf8');
const deployNginx = await readFile(`${REPO_ROOT}/deploy/nginx-sundial.conf`, 'utf8');

// The no-cache rule in each conf: a location matching exactly the three files,
// whose body uses `expires -1` (sends Cache-Control: no-cache without
// suppressing the inherited security add_header set). Group 1 captures the path
// prefix (`/` or `/sundial/`), group 2 the block body. The `\\\.` sequences
// match the literal `\.` (escaped dots) as written in the conf files.
const NO_CACHE_BLOCK = /location\s+~\s+\^([^\s]*)\(index\\\.html\|sw\\\.js\|version\\\.json\)\$\s*\{([^}]*)\}/;

// Walk from the `{` at/after `openerIndex` to its matching `}`, returning the
// [openBrace, closeBrace] indices so we can assert real (brace-level) nesting
// rather than mere textual order.
function blockExtent(conf, openerIndex) {
  const open = conf.indexOf('{', openerIndex);
  assert.ok(open >= 0, 'no opening brace found');
  let depth = 0;
  for (let i = open; i < conf.length; i++) {
    if (conf[i] === '{') depth += 1;
    else if (conf[i] === '}' && --depth === 0) return [open, i];
  }
  throw new Error('unbalanced braces');
}

test('container nginx no-caches index.html, sw.js and version.json at the root', () => {
  const m = containerNginx.match(NO_CACHE_BLOCK);
  assert.ok(m, 'data/nginx.conf is missing the no-cache location for the three files');
  assert.equal(m[1], '/', 'root conf should match the files at /');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the no-cache block');
  assert.doesNotMatch(m[2], /add_header/,
    'the root no-cache block must not set add_header, or nginx drops the server-level security headers');
});

test('deploy nginx no-caches the same three files under /sundial/', () => {
  const m = deployNginx.match(NO_CACHE_BLOCK);
  assert.ok(m, 'deploy/nginx-sundial.conf is missing the no-cache location for the three files');
  assert.equal(m[1], '/sundial/', 'deploy conf must scope the rule to the /sundial/ subpath');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the no-cache block');
});

test('deploy no-cache block is nested inside /sundial/ (inherits its security headers) and sets no add_header', () => {
  const opener = deployNginx.search(/location\s+\/sundial\/\s*\{/);
  assert.ok(opener >= 0, '/sundial/ location missing');
  const [open, close] = blockExtent(deployNginx, opener);
  // Real brace containment, not textual order: a block moved OUT to the server
  // level would inherit from the server scope (which has no add_header here),
  // silently serving the three files with no CSP/X-Frame-Options at all.
  const m = deployNginx.match(NO_CACHE_BLOCK);
  assert.ok(m.index > open && m.index < close,
    'no-cache block must be nested inside the /sundial/ block so it inherits the security add_header set');
  assert.doesNotMatch(m[2], /add_header/,
    'the no-cache block must not set add_header, or nginx drops the inherited security headers');
});

// Separate location from the three-file rule above (different regex), so a
// dedicated matcher per conf. Group 1 is unused here; only presence + body matter.
const JS_CSS_NO_CACHE_BLOCK = /location\s+~\s+\^([^\s]*)\(js\|css\)\/\s*\{([^}]*)\}/;

test('container nginx also no-caches js/ and css/, but not vendor/', () => {
  const m = containerNginx.match(JS_CSS_NO_CACHE_BLOCK);
  assert.ok(m, 'data/nginx.conf is missing the no-cache location for js/ and css/');
  assert.equal(m[1], '/', 'root conf should match js/ and css/ at /');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the js/css no-cache block');
  assert.doesNotMatch(m[2], /add_header/,
    'the js/css no-cache block must not set add_header, or nginx drops the server-level security headers');
  assert.doesNotMatch(containerNginx, /\(js\|css\|vendor\)/,
    'vendor/ must stay out of the no-cache rule — it would shadow the .mjs default_type override');
});

test('deploy nginx also no-caches js/ and css/ under /sundial/, nested so it inherits security headers', () => {
  const m = deployNginx.match(JS_CSS_NO_CACHE_BLOCK);
  assert.ok(m, 'deploy/nginx-sundial.conf is missing the no-cache location for js/ and css/');
  assert.equal(m[1], '/sundial/', 'deploy conf must scope the js/css rule to the /sundial/ subpath');
  assert.match(m[2], /expires\s+-1;/, 'expires -1 missing from the js/css no-cache block');

  const opener = deployNginx.search(/location\s+\/sundial\/\s*\{/);
  const [open, close] = blockExtent(deployNginx, opener);
  assert.ok(m.index > open && m.index < close,
    'js/css no-cache block must be nested inside the /sundial/ block so it inherits the security add_header set');
});
