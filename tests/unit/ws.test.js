import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { validateMessage, handle } = await import('../../js/ws.js');
const { store } = await import('../../js/store.js');

test('rejects non-object envelopes and missing message_type', () => {
  assert.equal(validateMessage(null), false);
  assert.equal(validateMessage('heartbeat'), false);
  assert.equal(validateMessage([]), false);
  assert.equal(validateMessage({}), false);
  assert.equal(validateMessage({ message_type: 42 }), false);
});

test('apps_update / terminals_update / unpaired_terminals_update require an array of objects', () => {
  assert.equal(validateMessage({ message_type: 'apps_update', message: [] }), true);
  assert.equal(validateMessage({ message_type: 'apps_update', message: [{ name: 'x' }] }), true);
  assert.equal(validateMessage({ message_type: 'apps_update', message: { name: 'x' } }), false);
  assert.equal(validateMessage({ message_type: 'apps_update', message: ['<script>'] }), false);
  assert.equal(validateMessage({ message_type: 'terminals_update', message: null }), false);
  assert.equal(validateMessage({ message_type: 'terminals_update', message: [null] }), false);
  assert.equal(validateMessage({ message_type: 'unpaired_terminals_update', message: [] }), true);
  assert.equal(validateMessage({ message_type: 'unpaired_terminals_update', message: [{ id: 'x' }] }), true);
  assert.equal(validateMessage({ message_type: 'unpaired_terminals_update', message: { id: 'x' } }), false);
  assert.equal(validateMessage({ message_type: 'unpaired_terminals_update', message: [null] }), false);
});

test('disk_usage_update requires numeric totals', () => {
  assert.equal(validateMessage(
    { message_type: 'disk_usage_update', message: { total_gb: 30, free_gb: 10 } }), true);
  assert.equal(validateMessage(
    { message_type: 'disk_usage_update', message: { total_gb: 'evil', free_gb: 10 } }), false);
  assert.equal(validateMessage(
    { message_type: 'disk_usage_update', message: { total_gb: 30 } }), false);
  assert.equal(validateMessage({ message_type: 'disk_usage_update', message: [] }), false);
});

test('app_install_error requires string name and error', () => {
  assert.equal(validateMessage(
    { message_type: 'app_install_error', message: { name: 'a', error: 'boom' } }), true);
  assert.equal(validateMessage(
    { message_type: 'app_install_error', message: { name: 'a', error: { $evil: 1 } } }), false);
  assert.equal(validateMessage({ message_type: 'app_install_error', message: {} }), false);
});

test('backup_update accepts empty body or optional string error', () => {
  assert.equal(validateMessage({ message_type: 'backup_update' }), true);
  assert.equal(validateMessage({ message_type: 'backup_update', message: null }), true);
  assert.equal(validateMessage({ message_type: 'backup_update', message: {} }), true);
  assert.equal(validateMessage({ message_type: 'backup_update', message: { error: 'x' } }), true);
  assert.equal(validateMessage({ message_type: 'backup_update', message: { error: [] } }), false);
});

test('bodyless message types pass through', () => {
  assert.equal(validateMessage({ message_type: 'heartbeat' }), true);
  assert.equal(validateMessage({ message_type: 'terminal_add' }), true);
  assert.equal(validateMessage({ message_type: 'subscription_updated' }), true);
});

test('handle(unpaired_terminals_update) replaces the store list', () => {
  const list = [{ id: 'a', name: 'A', lockouts: [{ app_name: 'immich', state: 'failed' }] }];
  handle({ message_type: 'unpaired_terminals_update', message: list });
  assert.deepEqual(store.state.unpaired_terminals, list);

  handle({ message_type: 'unpaired_terminals_update', message: [] });
  assert.deepEqual(store.state.unpaired_terminals, []);
});

test('handle drops a malformed unpaired_terminals_update without touching the store', () => {
  store.set({ unpaired_terminals: [{ id: 'keep' }] });
  handle({ message_type: 'unpaired_terminals_update', message: { not: 'an array' } });
  assert.deepEqual(store.state.unpaired_terminals, [{ id: 'keep' }]);
});

const OWNER_ROW = {
  id: 1, username: 'owner', display_name: 'Max', role: 'owner',
  email: 'owner@example.org', pending_email: null, pending_email_sent: true,
};

test('owner_user_update requires the GET /users/me shape', () => {
  const ok = (fields) => validateMessage({ message_type: 'owner_user_update', message: { ...OWNER_ROW, ...fields } });
  assert.equal(ok({}), true);
  assert.equal(ok({ email: null, pending_email: 'new@example.org', pending_email_sent: false }), true);
  assert.equal(ok({ id: '1' }), false);
  assert.equal(ok({ username: null }), false);
  assert.equal(ok({ display_name: 42 }), false);
  assert.equal(ok({ role: undefined }), false);
  assert.equal(ok({ email: undefined }), false);
  assert.equal(ok({ email: { $evil: 1 } }), false);
  assert.equal(ok({ pending_email: 7 }), false);
  assert.equal(ok({ pending_email: undefined }), false);
  assert.equal(ok({ pending_email_sent: 'true' }), false);
  assert.equal(ok({ pending_email_sent: undefined }), false);
  assert.equal(validateMessage({ message_type: 'owner_user_update', message: null }), false);
  assert.equal(validateMessage({ message_type: 'owner_user_update', message: [OWNER_ROW] }), false);
});

test('handle(owner_user_update) replaces the store user', () => {
  store.set({ user: { ...OWNER_ROW, email: null } });
  handle({ message_type: 'owner_user_update', message: OWNER_ROW });
  assert.deepEqual(store.state.user, OWNER_ROW);
});

test('handle drops a malformed owner_user_update without touching the store', () => {
  store.set({ user: OWNER_ROW });
  handle({ message_type: 'owner_user_update', message: { ...OWNER_ROW, email: 42 } });
  assert.deepEqual(store.state.user, OWNER_ROW);
});
