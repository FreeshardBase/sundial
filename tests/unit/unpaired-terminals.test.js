import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { worstLockoutState, hasFailedLockout, lockoutStateKey, lockoutAppLabel } =
  await import('../../js/unpaired-terminals.js');

test('worstLockoutState returns the highest-severity state present', () => {
  assert.equal(worstLockoutState([{ state: 'waiting_for_start' }, { state: 'failed' }]), 'failed');
  assert.equal(worstLockoutState([{ state: 'retrying' }, { state: 'waiting_for_install' }]), 'waiting_for_install');
  assert.equal(worstLockoutState([{ state: 'waiting_for_start' }]), 'waiting_for_start');
});

test('worstLockoutState returns null for no lockouts', () => {
  assert.equal(worstLockoutState([]), null);
  assert.equal(worstLockoutState(), null);
});

test('worstLockoutState sorts an unknown state below every known one', () => {
  assert.equal(worstLockoutState([{ state: 'mystery' }, { state: 'retrying' }]), 'retrying');
  assert.equal(worstLockoutState([{ state: 'mystery' }]), 'mystery');
});

test('hasFailedLockout is true only when a failed lockout is present', () => {
  assert.equal(hasFailedLockout({ lockouts: [{ state: 'failed' }, { state: 'retrying' }] }), true);
  assert.equal(hasFailedLockout({ lockouts: [{ state: 'retrying' }] }), false);
  assert.equal(hasFailedLockout({}), false);
});

test('lockoutStateKey keeps known states and maps unknown ones to a generic key', () => {
  for (const s of ['waiting_for_start', 'retrying', 'waiting_for_install', 'failed']) {
    assert.equal(lockoutStateKey(s), s);
  }
  assert.equal(lockoutStateKey('something_new'), 'unknown');
});

test('lockoutAppLabel prefers the installed app display name, else the raw app_name', () => {
  const apps = [{ name: 'immich', meta: { pretty_name: 'Immich' } }];
  assert.equal(lockoutAppLabel('immich', apps), 'Immich');
  assert.equal(lockoutAppLabel('nextcloud', apps), 'nextcloud');
  assert.equal(lockoutAppLabel('immich', []), 'immich');
});
