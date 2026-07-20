// CSP consistency: the <meta> policy in index.html is the source of truth
// (tools/dev_server.py and deploy/nginx-sundial.conf serve it as a header).
// The import map is the only inline script the policy may allow — via its
// sha256 hash, which must track the import map byte-for-byte.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPO_ROOT } from './helpers/env.js';

const html = await readFile(`${REPO_ROOT}/index.html`, 'utf8');
const nginx = await readFile(`${REPO_ROOT}/deploy/nginx-sundial.conf`, 'utf8');
const containerNginx = await readFile(`${REPO_ROOT}/data/nginx.conf`, 'utf8');

const metaCsp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];

test('index.html carries the CSP meta tag', () => {
  assert.ok(metaCsp, 'CSP meta tag missing');
});

test('the CSP hash matches the inline import map exactly', () => {
  const importmap = html.match(/<script type="importmap">(.*?)<\/script>/s)?.[1];
  assert.ok(importmap, 'import map missing');
  const digest = createHash('sha256').update(importmap).digest('base64');
  const inPolicy = metaCsp.match(/script-src ([^;]+)/)[1];
  assert.ok(inPolicy.includes(`'sha256-${digest}'`),
    `script-src must allow the import map: expected sha256-${digest} in "${inPolicy}"`);
});

test('script execution is locked down: no unsafe-inline/unsafe-eval, only self + the import-map hash', () => {
  const scriptSrc = metaCsp.match(/script-src ([^;]+)/)[1].trim().split(/\s+/);
  assert.deepEqual(scriptSrc.filter((s) => !s.startsWith("'sha256-")), ["'self'"]);
  assert.ok(!metaCsp.includes('unsafe-inline'));
  assert.ok(!metaCsp.includes('unsafe-eval'));
});

test('baseline restrictive directives are present', () => {
  for (const directive of ["default-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-src 'none'"]) {
    assert.ok(metaCsp.includes(directive), `missing: ${directive}`);
  }
});

test('the import map is the only inline script in index.html', () => {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)]
    .filter(([, attrs]) => !attrs.includes('importmap'));
  assert.deepEqual(inline, []);
});

test('index.html has no inline event handlers or style attributes', () => {
  assert.equal(html.match(/\son\w+=/), null);
  assert.equal(html.match(/\sstyle=/), null);
});

test('nginx deploy config serves the same policy plus frame-ancestors', () => {
  const nginxCsp = nginx.match(/Content-Security-Policy "([^"]+)"/)?.[1];
  assert.equal(nginxCsp, `${metaCsp}; frame-ancestors 'none'`);
  assert.match(nginx, /X-Frame-Options "DENY"/);
  assert.match(nginx, /X-Content-Type-Options "nosniff"/);
});

test('container nginx config serves the same policy plus frame-ancestors', () => {
  const nginxCsp = containerNginx.match(/Content-Security-Policy "([^"]+)"/)?.[1];
  assert.equal(nginxCsp, `${metaCsp}; frame-ancestors 'none'`);
  assert.match(containerNginx, /X-Frame-Options "DENY"/);
  assert.match(containerNginx, /X-Content-Type-Options "nosniff"/);
});
