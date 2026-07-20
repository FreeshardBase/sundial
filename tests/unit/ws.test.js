import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/env.js';

installDom();
const { validateMessage } = await import('../../js/ws.js');

test('rejects non-object envelopes and missing message_type', () => {
  assert.equal(validateMessage(null), false);
  assert.equal(validateMessage('heartbeat'), false);
  assert.equal(validateMessage([]), false);
  assert.equal(validateMessage({}), false);
  assert.equal(validateMessage({ message_type: 42 }), false);
});

test('apps_update / terminals_update require an array of objects', () => {
  assert.equal(validateMessage({ message_type: 'apps_update', message: [] }), true);
  assert.equal(validateMessage({ message_type: 'apps_update', message: [{ name: 'x' }] }), true);
  assert.equal(validateMessage({ message_type: 'apps_update', message: { name: 'x' } }), false);
  assert.equal(validateMessage({ message_type: 'apps_update', message: ['<script>'] }), false);
  assert.equal(validateMessage({ message_type: 'terminals_update', message: null }), false);
  assert.equal(validateMessage({ message_type: 'terminals_update', message: [null] }), false);
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
