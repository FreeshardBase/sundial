// The owner's email address: pure helpers shared by the Owner card in
// Settings and the confirmation landing. No DOM, no fetch — unit-tested.
//
// Model (freeshard#220): there is no verified flag. `email` is verified by
// definition, `pending_email` is an unverified candidate, so the pair alone
// says which state the address is in.

const CONFIRM_EMAIL_PARAM = 'confirm_email';

// The controller's mail link is `https://<shard-domain>/?confirm_email=<token>`.
// Returns the token, or null when the query carries none.
export function readConfirmEmailToken(search) {
  return new URLSearchParams(search || '').get(CONFIRM_EMAIL_PARAM) || null;
}

// The same query without the token, as a `?…` string ('' when nothing is left),
// so the single-use credential does not stay in the address bar or history.
export function searchWithoutConfirmToken(search) {
  const params = new URLSearchParams(search || '');
  params.delete(CONFIRM_EMAIL_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

// 'none' | 'pending' | 'set' for a user row (null/undefined counts as none).
export function ownerEmailState(user) {
  if (user?.pending_email) return 'pending';
  if (user?.email) return 'set';
  return 'none';
}

// Whether a failed PATCH stored the candidate but could not have the
// confirmation mail sent. shard_core answers that with 502 and a JSON detail;
// the proxy also answers 502 (without a JSON body) while shard_core is down,
// and then nothing was stored, so the detail is what tells the two apart.
export function isDeliveryFailure(err) {
  return err?.status === 502 && typeof err?.body?.detail === 'string';
}
