import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { minimumFreeshardVersion, minimumFreeshardVersionCompatible, fetchShardVersion } =
  await import('../../js/appstore.js');

test('minimumFreeshardVersion reads both the flat and nested field shapes', () => {
  // store-catalogue entries carry it flat
  assert.equal(minimumFreeshardVersion({ minimum_freeshard_version: '1.2.0' }), '1.2.0');
  // installed-app entries nest it under meta
  assert.equal(minimumFreeshardVersion({ meta: { minimum_freeshard_version: '2.0.0' } }), '2.0.0');
  // meta takes precedence when both are present
  assert.equal(
    minimumFreeshardVersion({ minimum_freeshard_version: '1.0.0', meta: { minimum_freeshard_version: '2.0.0' } }),
    '2.0.0');
  // absent → undefined
  assert.equal(minimumFreeshardVersion({ name: 'x' }), undefined);
  assert.equal(minimumFreeshardVersion(undefined), undefined);
});

test('an app with no declared minimum is always compatible', () => {
  assert.equal(minimumFreeshardVersionCompatible({ name: 'x' }, '1.0.0'), true);
  // even when the shard version is unknown
  assert.equal(minimumFreeshardVersionCompatible({ name: 'x' }, null), true);
});

test('compatible when the shard version meets or exceeds the minimum', () => {
  const app = { minimum_freeshard_version: '1.2.0' };
  assert.equal(minimumFreeshardVersionCompatible(app, '1.2.0'), true);  // equal
  assert.equal(minimumFreeshardVersionCompatible(app, '1.3.0'), true);  // higher minor
  assert.equal(minimumFreeshardVersionCompatible(app, '2.0.0'), true);  // higher major
  assert.equal(minimumFreeshardVersionCompatible(app, '1.2.1'), true);  // higher patch
});

test('incompatible when the shard version is below the minimum', () => {
  const app = { minimum_freeshard_version: '1.2.0' };
  assert.equal(minimumFreeshardVersionCompatible(app, '1.1.9'), false);
  assert.equal(minimumFreeshardVersionCompatible(app, '0.9.0'), false);
  assert.equal(minimumFreeshardVersionCompatible(app, '1.1'), false);   // 1.1.0 < 1.2.0
});

test('shorter version strings are zero-padded, not truncated', () => {
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: '1.2' }, '1.2.0'), true);
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: '1.2.0' }, '1.2'), true);
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: '1.2.1' }, '1.2'), false);
});

test('a leading v and a pre-release suffix are tolerated', () => {
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: 'v1.2.0' }, 'v1.3.0'), true);
  // a pre-release collapses to its base release (acceptable: real shard
  // versions are plain releases)
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: '1.2.0' }, '1.2.0rc1'), true);
});

test('unknown or unparseable versions fail safe to incompatible', () => {
  const app = { minimum_freeshard_version: '1.2.0' };
  assert.equal(minimumFreeshardVersionCompatible(app, null), false);        // shard version unknown
  assert.equal(minimumFreeshardVersionCompatible(app, undefined), false);
  assert.equal(minimumFreeshardVersionCompatible(app, 'nonsense'), false);  // unparseable shard version
  assert.equal(minimumFreeshardVersionCompatible({ minimum_freeshard_version: 'nonsense' }, '1.2.0'), false);
});

test('fetchShardVersion returns the version string on success', async () => {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/core\/public\/meta\/version/);
    return new Response(JSON.stringify({ version: '1.4.0' }), {
      status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  assert.equal(await fetchShardVersion({ refresh: true }), '1.4.0');
});

test('fetchShardVersion returns null (not a throw) when the endpoint is missing', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 404 });
  assert.equal(await fetchShardVersion({ refresh: true }), null);
});

test('fetchShardVersion returns null when the fetch itself rejects', async () => {
  globalThis.fetch = async () => { throw new Error('network down'); };
  assert.equal(await fetchShardVersion({ refresh: true }), null);
});
