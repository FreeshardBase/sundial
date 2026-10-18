// OIDC login return. When an app on this shard sends an unpaired browser to
// shard_core's authorize endpoint, shard_core redirects it to
// `/?oidc_rd=<absolute authorize URL>`. Once this browser is paired we send
// it back to that URL so the app login completes.
//
// `oidc_rd` is attacker-controllable (anyone can link to `/?oidc_rd=...`),
// so it is only ever followed after `safeOidcReturn()` accepts it: an
// absolute http(s) URL on this exact origin whose path is exactly the
// authorize endpoint. Anything else is dropped silently.
//
// The value travels in the query string (`?oidc_rd=`) from `/` to welcome to
// pair, never in storage: it is bound to the URL the user is on, survives a
// reload of the pair page, and cannot linger to hijack a later, unrelated
// pairing in the same tab.

export const OIDC_RETURN_PARAM = 'oidc_rd';
export const AUTHORIZE_PATH = '/core/public/oidc/authorize';

// Returns the normalized URL to navigate to, or null if `raw` must be ignored.
export function safeOidcReturn(raw, origin) {
  if (typeof raw !== 'string' || !raw || !origin || origin === 'null') return null;
  let url;
  try {
    url = new URL(raw); // no base: relative and protocol-relative input throws
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.origin !== origin) return null;
  if (url.username || url.password) return null;
  if (url.pathname !== AUTHORIZE_PATH) return null;
  return url.href;
}

export function oidcReturnFromSearch(search, origin) {
  return safeOidcReturn(new URLSearchParams(search).get(OIDC_RETURN_PARAM), origin);
}

// Query string (without '?') that carries a valid return to the next view;
// '' when there is none, so an invalid value is not passed along.
export function oidcReturnQuery() {
  const target = oidcReturnFromSearch(location.search, location.origin);
  return target ? new URLSearchParams({ [OIDC_RETURN_PARAM]: target }).toString() : '';
}

// Leaves the app for the validated authorize URL. Returns false (and does
// nothing) when the current URL carries no valid return.
export function followOidcReturn() {
  const target = oidcReturnFromSearch(location.search, location.origin);
  if (!target) return false;
  location.replace(target);
  return true;
}
