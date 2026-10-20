import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readConfirmEmailToken, searchWithoutConfirmToken, ownerEmailState, isDeliveryFailure,
} from '../../js/owner-email.js';
import { ApiError } from '../../js/api/client.js';

test('readConfirmEmailToken reads the token the controller puts in the mail link', () => {
  assert.equal(readConfirmEmailToken('?confirm_email=abc-_123'), 'abc-_123');
  assert.equal(readConfirmEmailToken('?x=1&confirm_email=tok%2Ben'), 'tok+en');
});

test('readConfirmEmailToken is null without a usable token', () => {
  assert.equal(readConfirmEmailToken(''), null);
  assert.equal(readConfirmEmailToken(undefined), null);
  assert.equal(readConfirmEmailToken('?code=123456'), null);
  assert.equal(readConfirmEmailToken('?confirm_email='), null);
});

test('searchWithoutConfirmToken drops only the token', () => {
  assert.equal(searchWithoutConfirmToken('?confirm_email=abc'), '');
  assert.equal(searchWithoutConfirmToken('?a=1&confirm_email=abc&b=2'), '?a=1&b=2');
  assert.equal(searchWithoutConfirmToken(''), '');
});

test('ownerEmailState: a pending candidate wins over the live address', () => {
  assert.equal(ownerEmailState({ email: 'a@x.org', pending_email: 'b@x.org' }), 'pending');
  assert.equal(ownerEmailState({ email: null, pending_email: 'b@x.org' }), 'pending');
});

test('ownerEmailState: an address without a candidate is set, no address is none', () => {
  assert.equal(ownerEmailState({ email: 'a@x.org', pending_email: null }), 'set');
  assert.equal(ownerEmailState({ email: null, pending_email: null }), 'none');
  assert.equal(ownerEmailState({}), 'none');
  assert.equal(ownerEmailState(null), 'none');
});

test('isDeliveryFailure: shard_core\'s 502 with its JSON detail means "stored, mail not sent"', () => {
  const detail = 'The address was saved but the confirmation email could not be sent.';
  assert.equal(isDeliveryFailure(new ApiError(502, detail, { detail })), true);
});

test('isDeliveryFailure: a proxy 502 without the API body is a real failure', () => {
  // traefik answers 502 with an HTML/empty body while shard_core is down —
  // nothing was stored then
  assert.equal(isDeliveryFailure(new ApiError(502, 'Bad Gateway', null)), false);
  assert.equal(isDeliveryFailure(new ApiError(429, 'Too many', { detail: 'Too many' })), false);
  assert.equal(isDeliveryFailure(new ApiError(500, 'x', { detail: 'x' })), false);
  assert.equal(isDeliveryFailure(new TypeError('Failed to fetch')), false);
});
