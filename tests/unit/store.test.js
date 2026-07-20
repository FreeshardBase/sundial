import test from 'node:test';
import assert from 'node:assert/strict';

const { store, shortShardId, shardHref, tourSeen } = await import('../../js/store.js');

test('set() patches state and notifies key subscribers', () => {
  const seen = [];
  store.subscribe('apps', (state) => seen.push(state.apps));
  store.set({ apps: [{ name: 'immich' }] });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], [{ name: 'immich' }]);
  assert.deepEqual(store.state.apps, [{ name: 'immich' }]);
});

test('subscribers only fire for their keys', () => {
  let calls = 0;
  store.subscribe('terminals', () => calls++);
  store.set({ apps: [] });
  assert.equal(calls, 0);
  store.set({ terminals: [] });
  assert.equal(calls, 1);
});

test('multi-key and wildcard subscriptions', () => {
  const keys = [];
  store.subscribe(['apps', 'tours'], () => keys.push('multi'));
  store.subscribe('*', () => keys.push('star'));
  store.set({ tours: [{ name: 'usage prompt', status: 'seen' }] });
  assert.deepEqual(keys, ['multi', 'star']);
});

test('one set() with several keys notifies once per key', () => {
  let calls = 0;
  store.subscribe(['apps', 'terminals'], () => calls++);
  store.set({ apps: [], terminals: [] });
  assert.equal(calls, 2);
});

test('unsubscribe stops notifications', () => {
  let calls = 0;
  const off = store.subscribe('apps', () => calls++);
  store.set({ apps: [] });
  off();
  store.set({ apps: [] });
  assert.equal(calls, 1);
});

test('derived getters read current state', () => {
  store.set({
    meta: {
      is_anonymous: false,
      identity: { id: 'geszt8y57h0ylg2q08wq', domain: 'geszt8.freeshard.cloud' },
    },
    tours: [{ name: 'usage prompt', status: 'seen' }, { name: 'other', status: 'pending' }],
  });
  assert.equal(shortShardId(), 'geszt8');
  assert.equal(shardHref(), 'https://geszt8.freeshard.cloud');
  assert.equal(tourSeen('usage prompt'), true);
  assert.equal(tourSeen('other'), false);
  assert.equal(tourSeen('missing'), false);
});
