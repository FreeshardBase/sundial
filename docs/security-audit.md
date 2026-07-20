# Sundial security audit

Client-side security audit + hardening of the Sundial SPA (branch
`feat/security`, 2026-07-19). Scope per
`~/knowledge_base/freeshard/sundial-security-spec.md`: XSS/DOM injection, CSP,
token handling, clickjacking/transport, WebSocket message safety, vendored
deps. Everything below was verified by the test suite — unit
(`tests/unit/{csp,ws}.test.js`) and e2e (`tests/e2e/security.spec.js`).

## What was checked

Full read of `index.html`, every file under `js/`, `tools/dev_server.py`,
`deploy/nginx-sundial.conf`, `vendor/`. Every DOM-write path (`innerHTML`,
`insertAdjacentHTML`, attribute interpolation in template literals) was traced
to its data source; every URL that the client navigates to or embeds was
traced likewise; storage (`localStorage`, cookies) inventoried.

## Findings and fixes

### F1 — Stored XSS via markdown sinks (high) — FIXED

`marked.parse()` output went to `innerHTML` unsanitized in three places, and
marked deliberately does not sanitize:

- `js/views/welcome.js` — public identity `description` on the **public,
  unauthenticated** /welcome page. A hostile description = stored XSS for
  every visitor.
- `js/components/editable-text.js` — same description rendered on /public.
- `js/components/banner.js` — CMS banner markdown fetched from the Azure blob
  (a compromised blob would have scripted every shard's UI).

Fix: `js/sanitize.js` — allowlist sanitizer (DOMParser round-trip; allowed
tags/attrs only; `href`/`src` restricted to http/https/mailto; script-ish
elements removed with content, unknown containers unwrapped; links forced
`rel="noopener noreferrer"`). `renderMarkdown()` wraps `marked.parse` and is
now the only path from markdown to `innerHTML`.

All other interpolation sites already went through `esc()` or `textContent`
(toasts use `textContent`; i18n catalogs are trusted repo content, `{param}`
interpolation is escaped by design).

### F2 — No Content-Security-Policy — FIXED

Added a strict CSP with **no `unsafe-inline`/`unsafe-eval`**:

```
default-src 'self'; script-src 'self' 'sha256-<importmap>'; style-src 'self';
img-src 'self' https://storageaccountportab0da.blob.core.windows.net;
connect-src 'self' https://storageaccountportab0da.blob.core.windows.net;
font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
frame-src 'none'[; frame-ancestors 'none' — header only]
```

- Source of truth is the `<meta http-equiv>` tag in `index.html` (fallback for
  header-less static hosting). `tools/dev_server.py` parses that tag and
  serves the same policy as a header plus the header-only
  `frame-ancestors 'none'`; `deploy/nginx-sundial.conf` sends the identical
  header set for production.
- Enablers: the two inline head scripts were externalized
  (`js/base.js`, `js/theme-init.js`); the import map cannot be external, so it
  is allowed by sha256 hash (`tests/unit/csp.test.js` fails if map and hash
  drift); the four inline `onerror=` icon-fallback handlers became
  `addEventListener` (`attachIconFallback()` in `js/components/app-tile.js`);
  the four inline `style=` attributes became CSSOM (`fillDiskBar()` in
  `js/util.js`) or SVG `display` attributes (sparkline).
- Verified: e2e drives every view with a `securitypolicyviolation` listener
  installed and asserts zero events; the whole suite runs under the policy.

### F3 — WebSocket payloads trusted (medium) — FIXED

`js/ws.js` patched the store with whatever arrived on
`/core/protected/ws/updates`. Now `validateMessage()` shape-checks every
message (arrays-of-objects for `apps_update`/`terminals_update`, numeric disk
totals, string error fields); malformed messages are dropped with a console
warning, and non-JSON frames no longer throw inside `onmessage`. Unit tests
cover the validator; e2e feeds hostile frames through a fake WS server and
asserts the store survives and valid frames still apply.

### F4 — API-provided URLs as navigation targets (medium) — FIXED

- `location = data.approval_url` (subscribe + resize in
  `js/views/settings.js`) and the `paypal_manage_url` link would have executed
  a `javascript:` URL if the management passthrough were compromised. Now
  gated by `isSafeHttpUrl()` (absolute http/https only).
- `openApp()` interpolates the app name into a subdomain; app names are now
  charset-checked (`isSafeAppName`), and names in icon URL paths are
  `encodeURIComponent`-ed.

### F5 — Token handling — CLEAN (backend-dependent, documented)

The session JWT lives in a cookie set by `POST /core/public/pair/terminal`
(OpenAPI: apiKey-in-cookie `authorization`). The client never reads, stores,
or sends it explicitly — nothing token-shaped is in `localStorage`
(only `sundial.theme`, `sundial.locale`, `sundial.ui` preferences) and no
secrets are baked into served files. **Residual (backend):** cookie flags
(`HttpOnly; Secure; SameSite`) are set by shard_core, not the client — not
verifiable from this repo; flagged for the shard_core side.

### F6 — Vendored deps

- `vendor/marked.esm.js` — marked **v12.0.2** (2024). No known XSS CVEs for
  this version; it does not sanitize by design, which F1's sanitizer covers.
- `vendor/lean-qr.mjs` — minified ESM, **upstream version not recorded** at
  vendoring time (2.x API). Used only to draw pairing QR codes into a canvas
  from app-generated strings — no untrusted input. Residual: record upstream
  version + hash when next updated.

## Clickjacking / transport

`frame-ancestors 'none'` + `X-Frame-Options: DENY` from both servers, plus
`X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`. All
asset/API URLs are same-origin relative/absolute; the only cross-origin
fetches are the two Azure blob URLs (https, in `connect-src`/`img-src`). WS
URL derives its scheme from `location.protocol` (wss on https) — no mixed
content.

## Regression tests

- `tests/unit/csp.test.js` — importmap↔hash pairing, no unsafe-*, meta/nginx
  policy consistency, no inline scripts/handlers/styles in index.html.
- `tests/unit/ws.test.js` — `validateMessage()` accept/reject matrix.
- `tests/e2e/security.spec.js` — headers served and matching the meta CSP;
  zero CSP violations across all views; hostile markdown via mocked
  `whoareyou` and `banners.json` (sanitized, benign markdown intact);
  malformed WS frames dropped / valid ones applied; `javascript:` approval_url
  never navigates; sanitizer/URL-guard primitive matrix in-browser.
- Falsifiability: reverting welcome.js to raw `marked.parse` was proven to
  turn the welcome XSS test red (break→red→restore, 2026-07-19).

## Residual risks / assumptions

- Session-cookie flags are shard_core's responsibility (F5).
- CSP allowlists the Azure blob host for store metadata/icons/banners; blob
  content is sanitized (banners) or escaped (store text), but a compromised
  blob could still serve misleading images/text.
- The `<meta>` CSP cannot express `frame-ancestors`; framing protection exists
  only where the headers are sent (dev server + nginx deploy — i.e.
  everywhere Sundial is actually served).
- `js/api/client.js` is generated; regeneration must keep responses as data
  (it does JSON parsing only — no DOM writes).
