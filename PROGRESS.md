# PROGRESS — Sundial security hardening (autonomous session, feat/security)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-security-spec.md`.
Branch: feat/security (off feat/tests-ci). Local only — never push.
Done signal: `SEC_OUTCOME: done` (only after suite green + app verified under CSP).
Previous sessions (rewrite, i18n, tests+CI) complete; notes in git history.

## Audit findings (from full source read, all js/ + index.html + dev_server.py)

See docs/security-audit.md for the full write-up. Summary:

- F1 XSS (high): marked.parse → innerHTML at welcome.js, editable-text.js,
  banner.js → js/sanitize.js (allowlist) + renderMarkdown(). FIXED.
- F2 CSP: none existed → strict policy (no unsafe-*), meta in index.html as
  source of truth, header from dev_server.py + nginx conf; inline scripts
  externalized (js/base.js, js/theme-init.js), importmap sha256-hashed,
  onerror= → attachIconFallback(), style= → fillDiskBar()/SVG attrs. FIXED.
- F3 WS: unvalidated payloads → validateMessage() shape check, drop invalid,
  JSON.parse guarded. FIXED.
- F4 URL sinks: approval_url/paypal_manage_url → isSafeHttpUrl();
  openApp subdomain → isSafeAppName(); icon URLs encodeURIComponent. FIXED.
- F5 tokens: CLEAN — JWT in backend-set cookie, client never reads it;
  localStorage holds only prefs. Cookie flags = shard_core (documented).
- F6 vendor: marked 12.0.2 ok (sanitizer covers by-design raw HTML);
  lean-qr version unrecorded (residual note).

## Done

- Full source audit; all fixes F1–F4 applied (working tree).
- Unit tests: tests/unit/ws.test.js (validateMessage matrix),
  tests/unit/csp.test.js (importmap↔hash pairing, policy invariants,
  nginx/meta consistency). 58 unit tests pass.
- E2e: tests/e2e/security.spec.js — headers, zero CSP violations across all
  views, welcome + banner XSS via route mocks, fake-WS malformed frames,
  javascript: approval_url guard, sanitizer primitive matrix. 7/7 pass.
- Falsifiability proven: welcome.js reverted to raw marked.parse → XSS test
  red → fix restored → green. (NB: `git checkout <file>` during the break
  step wiped the uncommitted fix once — re-applied, verified green.)
- curl-verified headers from dev server (CSP + frame-ancestors + XFO +
  nosniff + Referrer-Policy on / and /sundial/*).
- docs/security-audit.md written. agents.md Security section added.

## In flight

- Final full-suite run + commit on feat/security.

## Blockers

- none
