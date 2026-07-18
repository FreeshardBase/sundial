# PROGRESS — Sundial tests + CI (autonomous session, feat/tests-ci)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-tests-ci-spec.md`.
Branch: feat/tests-ci (off feat/i18n). Local only — never push.
Previous sessions (rewrite + i18n) complete; their notes in git history.

## Plan (locked by spec)

1. npm dev scaffolding: package.json (dev-only, no build script),
   @playwright/test, gitignore node_modules. No-build invariant: tooling
   never touches the served app.
2. Unit tests (node:test, tests/unit/*.test.js): store (set/subscribe/
   unsub/getters), router (href/navigate/subpath BASE via fresh import +
   window stubs), i18n (t() lookup/escape/{!raw}/plurals/fallback, Intl
   fmt per locale, detection order, setLocale), api/preferences (404 +
   HTML fallback → null), api/client (call(): query build, ApiError
   detail extraction).
3. Playwright e2e (tests/e2e/*.spec.js) vs mock dev server on :8021
   (webServer w/ reuseExistingServer locally): boot/hydrate, routing,
   resource-monitor sparklines, app store cards + detail (Azure blob
   stubbed via page.route), language switcher EN↔DE + persistence,
   responsive (mobile 390x844 + large 2560x1440), /sundial/ subpath.
4. No-build smoke (e2e spec): served files byte-equal disk files; no
   build config/artifacts in repo; modules load natively.
5. CI: .github/workflows/ci.yml — setup uv + node, npm ci, playwright
   install chromium, unit + e2e (server via playwright webServer).
6. Teeth proof: break code → red → restore, for ≥2 checks (one unit,
   one e2e). Record here.
7. Update agents.md (test commands), commit.

## Done

- Read tests-ci spec, rewrite spec, agents.md, all relevant js sources,
  dev_server.py. Branch feat/tests-ci created.
- Step 1: package.json (type:module, dev-only) + @playwright/test 1.61.1
  (chromium-1228 already cached), .gitignore: node_modules/, test-results/,
  playwright-report/.
- Step 2: unit tests green — 45 pass, 0 fail (`npm run test:unit`).
  tests/unit/{store,router,i18n,client,preferences}.test.js +
  helpers/env.js (DOM/global stubs; router fresh-imported per BASE via
  query-suffix dynamic import). Note: client.js non-JSON error detail
  falls back to statusText (json() consumes body; text() retry dead) —
  test asserts actual behavior.

- Steps 3+4: e2e green — 27 pass (`npm run test:e2e`; dev server
  running via background task, PID on :8021; playwright.config.js has
  webServer w/ reuseExistingServer locally). Specs: boot, routing,
  monitor (sparklines; assert path `d` attr, not visibility — 1-sample
  path has zero bbox), appstore (blob stubbed via page.route; modal
  selector [role=dialog]), i18n EN↔DE, responsive (390x844 + 2560x1440),
  subpath /sundial/, nobuild smoke (byte-compare served vs disk, no
  build tooling). Gotchas hit: fs-label text is lowercase in DOM (CSS
  uppercases); title.apps = "…- Apps".

- Step 5: .github/workflows/ci.yml — setup-node (cache npm) + setup-uv,
  npm ci, Playwright chromium (cache keyed on package-lock), check_i18n,
  unit, e2e (webServer starts dev server), report artifact on failure.
  YAML validated; can't execute until Max pushes (expected).
- Step 6 teeth proofs (break→red→restore, all restored + re-verified):
  - store.js notify commented out → 5/6 store unit tests fail.
  - metrics.js startMetrics no-op → both monitor e2e specs fail.
  - i18n.js setLocale no-op → all 3 i18n e2e specs fail.
  - package.json fake "build" script → nobuild smoke fails.
- Step 7: agents.md Testing section + justfile test recipes added.
- Full suite re-verified green after restores: 45 unit + 27 e2e.

## In flight

- nothing — DONE. Committed on feat/tests-ci (local only, not pushed;
  Max pushes later — CI runs then). Final state: 45 unit + 27 e2e green,
  teeth proven, agents.md/justfile document `npm test` / `just test`.

## Blockers

- none
