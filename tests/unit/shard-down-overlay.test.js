import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, installFetch } from './helpers/env.js';

// The escalation threshold (5 minutes) is the one thing in this component
// that's impractical to exercise for real in e2e — fake the elapsed time
// against the exported pure message() function instead.

installDom();
installFetch();
const { initI18n } = await import('../../js/i18n.js');
await initI18n();
const { message } = await import('../../js/components/shard-down-overlay.js');

test('before 5 minutes: the "probably restarting" tier', () => {
  assert.match(message(0), /restarting/);
  assert.match(message(60_000), /restarting/);
  assert.match(message(5 * 60 * 1000 - 1), /restarting/);
});

test('at/after 5 minutes: the "contact support" tier', () => {
  assert.match(message(5 * 60 * 1000), /contact support/);
  assert.match(message(5 * 60 * 1000 + 1), /contact support/);
  assert.match(message(60 * 60 * 1000), /contact support/);
});

test('escalated tier links the same mailto address used elsewhere (restart.js)', () => {
  assert.match(message(5 * 60 * 1000), /mailto:contact@freeshard\.net/);
});
