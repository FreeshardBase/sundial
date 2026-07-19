# PROGRESS — Sundial PWA installability (autonomous session, feat/pwa-installable)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-pwa-installable-spec.md`.
Branch: feat/pwa-installable (off feat/security). Local only — never push.
Scope: installability ONLY — no offline caching, no push (→ freeshard#170).
Done signal: `PWA_OUTCOME: done` (only after full suite green + verified).
Previous sessions (rewrite, i18n, tests+CI, security) complete; git history.

## Done

- TDD: tests written first, watched red (unit crash on missing manifest,
  5 e2e failures), then implemented to green.
- `manifest.webmanifest` — name/short_name/description, display standalone,
  start_url+scope "./" (relative → subpath-safe), warm-paper colors,
  icons 192/512 (any) + 512 maskable + type image/png.
- Icons generated: `tools/gen_icons.py` (uv+pillow, from favicon.png) →
  assets/img/icon-{192,512,maskable-512,180}.png. Maskable visually checked
  (diamond inside safe zone, warm-paper bg).
- `sw.js` — passthrough-only (no-op fetch handler, skipWaiting+clients.claim);
  `js/pwa.js` registers it against document.baseURI (scope / or /sundial/);
  called from main.js boot.
- index.html: manifest link, apple-touch-icon, theme-color light+dark metas,
  apple-mobile-web-app-capable.
- CSP: NO changes needed (worker-src→script-src 'self' fallback; manifest-src→
  default-src). csp.test.js untouched, still green.
- dev_server.py: `.webmanifest` → application/manifest+json MIME.
- nobuild.spec.js list extended with manifest.webmanifest + sw.js.
- Tests: tests/unit/manifest.test.js (6 tests: manifest shape, relative
  start_url/scope, icons real PNGs, index wiring, sw passthrough guard,
  registration wiring), tests/e2e/pwa.spec.js (5 tests: manifest+icons at /
  and /sundial/, SW scope both bases, controlled page live + zero CSP
  violations).
- Falsifiability proven twice: (a) caches.open('x') in sw.js → unit red →
  restored green; (b) registerServiceWorker() commented out → both e2e SW
  tests red → restored green.
- FULL suite green: check_i18n clean, 64 unit, 39 e2e (incl. security,
  subpath, nobuild), `just check` all modules parse.
- curl-verified on live server: manifest 200 application/manifest+json at
  / and /sundial/, sw.js text/javascript, icons image/png, CSP header intact.
- agents.md PWA section added.

## In flight

- nothing — DONE. Committed as 8780d16 on feat/pwa-installable.
  PWA_OUTCOME: done.

## Blockers

- none
