# PROGRESS — Sundial single-container packaging + release CI (autonomous)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-packaging-ci-spec.md`.
Branch: chore/single-container-ci (off feat/pwa-installable). Remote exists —
push + PR (base feat/pwa-installable, stacked on #4, reviewer max-tet,
never self-merge). Template: FreeshardBase/web-terminal.
Done signal: `PKG_OUTCOME: done` (only after verified build+serve+tests+PR).

## Done

- Read packaging spec, agents.md, web-terminal template (Dockerfile,
  release.yml/snapshot.yml, justfile set-version), freeshard justfile
  (convention: bump files, commit "set version to X", no tag in recipe).
- `Dockerfile` — nginx:alpine, NO build stage, explicit COPY of runtime set
  (index.html, manifest.webmanifest, sw.js, version.json, js/, css/, assets/,
  vendor/) to /srv + data/nginx.conf to conf.d/default.conf. Verified image
  /srv contains ONLY runtime files.
- `.dockerignore` — tests/tools/docs/deploy/.github/node_modules/package*/
  playwright*/test-results/justfile/*.md/.git etc.
- `data/nginx.conf` — root serve, SPA fallback, expires -1 (no-cache) on
  index.html/sw.js/version.json, security headers = meta CSP +
  frame-ancestors (same as deploy/nginx-sundial.conf), MIME fixes:
  .webmanifest → application/manifest+json, .mjs → application/javascript
  (both missing from nginx:alpine mime.types; .mjs one was a REAL bug found
  by headless-Chromium check — octet-stream broke the whole module graph).
- csp.test.js extended: data/nginx.conf must carry meta CSP +
  frame-ancestors (falsifiability proven: broke conf → red, restored → green).
- `.github/workflows/release.yml` — on release created, build+push
  ghcr.io/freeshardbase/sundial:<tag>, GITHUB_TOKEN, mirrors web-terminal
  minus build steps. ci.yml untouched.
- justfile `set-version` — bumps version.json + js/version.js, commits
  "set version to <v>". Dry-run verified on temp branch (exact 2-line diff),
  branch deleted, tree back at 0.1.0.
- VERIFIED: docker build + run -d + curl — root 200, /settings SPA fallback
  200 w/ no-cache, manifest correct MIME, sw.js+version.json no-cache, CSP/XFO
  headers on responses; headless Chromium: app boots under CSP (components
  defined, view-home rendered, SW controls page, 0 CSP violations; only
  missing-/core errors, expected standalone).
- Full suite green: check_i18n 0 problems, 65 unit, 39 e2e + nobuild smoke.
- agents.md updated: Packaging & release section, stale "no remote" line fixed.

- Committed 168e937, pushed. PR #4 was already merged into main (05:26Z) →
  base retargeted to main (merge-commit history, clean stack). PR OPEN:
  https://github.com/FreeshardBase/sundial/pull/5 — not draft, reviewer
  max-tet, CI test job green on push (PR run pending at time of writing).
  Never self-merge; Max cuts the actual release.

## In flight

- nothing — DONE. PKG_OUTCOME: done.

## Blockers

- none
