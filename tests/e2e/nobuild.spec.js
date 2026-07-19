import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// No-build serve smoke: the files in the repo ARE the app. Every served
// source file must be byte-identical to the file on disk (no transpile,
// no bundle, no rewrite), and the repo must not grow build tooling.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

async function listFiles(dir, exts) {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
      out.push(path.relative(ROOT, path.join(entry.parentPath, entry.name)));
    }
  }
  return out;
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

test('every served JS/CSS/JSON/HTML file is byte-identical to the repo file', async ({ request }) => {
  const files = [
    'index.html',
    'version.json',
    'manifest.webmanifest',
    'sw.js',
    ...await listFiles('js', ['.js', '.json']),
    ...await listFiles('css', ['.css']),
    ...await listFiles('vendor', ['.js', '.mjs']),
  ];
  expect(files.length).toBeGreaterThan(40);
  for (const file of files) {
    const res = await request.get(`/${file}`);
    expect(res.status(), file).toBe(200);
    const served = await res.body();
    const disk = await readFile(path.join(ROOT, file));
    expect(sha(served), `${file} must be served as-is`).toBe(sha(disk));
  }
});

test('the app entry is a native ES module, not a bundle', async ({ request }) => {
  const index = await (await request.get('/')).text();
  expect(index).toContain('<script type="module" src="js/main.js">');
  expect(index).toContain('<script type="importmap">');

  const main = await (await request.get('/js/main.js')).text();
  expect(main).toMatch(/^import .* from '\.\/router\.js';$/m);
});

test('no build tooling or artifacts in the repo', async () => {
  const forbidden = [
    'dist', 'build', '.next', 'webpack.config.js', 'vite.config.js',
    'vite.config.ts', 'rollup.config.js', 'babel.config.js', '.babelrc',
    'tsconfig.json', 'esbuild.config.js',
  ];
  for (const name of forbidden) {
    await expect(access(path.join(ROOT, name)), `${name} must not exist`).rejects.toThrow();
  }

  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  expect(pkg.dependencies, 'runtime deps would mean the served app needs npm').toBeUndefined();
  expect(Object.keys(pkg.scripts ?? {}).filter((s) => /build|bundle|compile/.test(s))).toEqual([]);

  // the served HTML must not reference anything out of node_modules
  const index = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  expect(index).not.toContain('node_modules');
});
