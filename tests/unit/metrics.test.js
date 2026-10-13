import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { push, HISTORY_LENGTH } = await import('../../js/metrics.js');

test('push() keeps a constant length from the very first sample', () => {
  const history = push([], 5);
  assert.equal(history.length, HISTORY_LENGTH);
  assert.equal(history.at(-1), 5);
  assert.ok(history.slice(0, -1).every((v) => v === null));
});

test('push() anchors the newest value at the right edge, growing leftward', () => {
  let history = [];
  for (const v of [1, 2, 3]) history = push(history, v);
  assert.equal(history.length, HISTORY_LENGTH);
  assert.deepEqual(history.slice(-3), [1, 2, 3]);
  assert.ok(history.slice(0, -3).every((v) => v === null));
});

test('push() slides left once the window is full, dropping the oldest sample', () => {
  let history = [];
  for (let i = 0; i < HISTORY_LENGTH; i++) history = push(history, i);
  assert.deepEqual(history, Array.from({ length: HISTORY_LENGTH }, (_, i) => i));
  history = push(history, 999);
  assert.equal(history.length, HISTORY_LENGTH);
  assert.equal(history[0], 1); // sample 0 fell off the front
  assert.equal(history.at(-1), 999);
});
