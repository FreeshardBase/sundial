# Sundial

Ground-up rewrite of the Freeshard web-terminal as a **no-build, no-framework** SPA.
Vanilla HTML/CSS/JS, native ES modules, light-DOM custom elements + CSS `@scope`,
"Daylight Instrument" design system. Spec: `~/knowledge_base/freeshard/sundial-rewrite-spec.md`.

## Hard constraints

- No framework, no build step. Files edited == files served. Native ESM + import maps.
- Deps allowed only as no-build ESM, vendored under `vendor/`.
- Existing REST API only (`/core/public/*`, `/core/protected/*`, same-origin absolute paths).
- WebSockets, never SSE. Live data: `/core/protected/ws/updates`.
- Subpath-aware from day one: app must work served at `/` AND at `/sundial/`.
  Own routes/assets relative or base-prefixed; API stays absolute (`/core/...`).
- Design tokens verbatim from `~/knowledge_base/freeshard/ui-style/tokens/` (copied to `css/`).
- Local git repo only — never push, no GitHub remote.

## Stack / architecture

- `index.html` — single entry, import map, loads `css/tokens.css` + `css/app.css`, `js/main.js`.
- `js/store.js` — tiny central store: `store.get()`, `store.set(patch)`, `store.subscribe(keys, fn)`.
  Load-all-upfront: boot hydrates meta/apps/terminals/profile/disk/tours, then WS patches.
- `js/router.js` — History-API router, base-path aware (`<base href>` / detected prefix).
- `js/api/` — API access. `openapi.json` (dumped from shard_core FastAPI app),
  `client.js` GENERATED — do not hand-edit; regenerate with `tools/gen_client.py`.
- `js/views/*.js` — one custom element per route.
- `js/components/*.js` — shared custom elements (dock, badge, sparkline, avatar, editable-text, ...).
- `js/i18n.js` + `js/i18n/{en,de}.json` — internationalization (see below).
- Style isolation: light-DOM custom elements + `@scope (fs-xyz) { ... }` blocks in component CSS.
- Fonts self-hosted: Inter + IBM Plex Mono woff2 in `assets/fonts/`.

## i18n (EN + DE)

- No-build: hand-rolled JSON catalogs `js/i18n/en.json` (source) + `de.json`,
  fetched at boot by `initI18n()`; `t(key, params)` in `js/i18n.js`. No i18n libs.
- Catalog values may contain trusted HTML (links, <b>). `{param}` placeholders are
  HTML-escaped; `{!param}` inserts raw (for pre-built markup like links). Plural
  values are objects `{ one, other }` selected via `Intl.PluralRules` on `params.count`.
- Active locale lives in the store (`locale`). `FsElement.watch()` implicitly
  subscribes to `'locale'`, so every watching component re-renders on switch; views
  that render imperatively call `this.watch('locale', ...)`; the dock adds `'locale'`
  to its own subscribe list. Set `document.title` inside `render()`, not
  `connectedCallback()`, so titles re-translate.
- Detection at boot: `GET /protected/preferences` → `{ language }`
  (freeshard#168 — endpoint NOT implemented server-side yet, 404/HTML fallback is
  the normal case) → `localStorage['sundial.locale']` → `navigator.language` → `en`.
  Client: `js/api/preferences.js` (hand-written, isolated; swap for the generated
  client once #168 ships).
- Settings has a language card; switching calls `setLocale()`: store + localStorage
  + fire-and-forget `PUT /protected/preferences`.
- All date/number/currency formatting goes through `Intl` bound to the active locale:
  `fmtNumber/fmtPercent/fmtCurrencyEur` (i18n.js), `formatRelative` (util.js),
  `formatBytes` (metrics.js).
- Adding a language: add `js/i18n/<code>.json` (translate every key of en.json),
  add the code to `SUPPORTED_LOCALES` + `INTL_TAGS` in i18n.js, add
  `settings.language.<code>` label keys to ALL catalogs. Run `python3
  tools/check_i18n.py` (t()-key/catalog consistency, both directions) — it and
  `just check` must stay clean.
- DE catalog is AI-generated (du-form) — pending native review by Max.

## Testing

- Layers: **unit** (`node:test`, `tests/unit/` — store, router, i18n, generated
  client, preferences client; browser globals stubbed in
  `tests/unit/helpers/env.js`), **e2e** (Playwright, `tests/e2e/` — real
  Chromium against the mock-API dev server on :8021), **no-build smoke**
  (`tests/e2e/nobuild.spec.js` — every served file byte-identical to the repo
  file, entry is native ESM, no build tooling/artifacts allowed in the repo).
- Run: `npm test` (both), `npm run test:unit`, `npm run test:e2e`.
  Playwright's `webServer` starts `uv run tools/dev_server.py` itself and
  reuses an already-running one locally (CI always starts fresh).
- `package.json` is **dev-only tooling** (type:module for node:test ESM); the
  served app never touches node_modules — the nobuild spec enforces this
  (no `dependencies`, no build/bundle scripts). Don't add either.
- E2e specs must stay **read-only towards the mock server's STATE** (no
  installs/deletes) — workers run in parallel against one shared server.
  App-store blob metadata is stubbed per-test via `page.route`; keep e2e
  hermetic (no live Azure fetches).
- Router unit tests import `js/router.js` with a query-suffix
  (`import('.../router.js?x')`) to get a fresh module per BASE value.
- CI: `.github/workflows/ci.yml` — npm ci, Playwright Chromium (cached),
  check_i18n, unit, e2e+smoke. Runs once the repo is pushed to GitHub.

## Commands

- `just serve` — static server on :8021 (dev, proxies /core to a live shard).
- `npm test` — unit + e2e + no-build smoke (see Testing).
- `python3 tools/check_i18n.py` — i18n key consistency (t() calls vs catalogs).
- `tools/gen_client.py` — regenerate `js/api/client.js` from `js/api/openapi.json`.
- Dump fresh spec: in `~/projects/freeshard/freeshard`:
  `uv run python -c "from shard_core.app_factory import create_app; import json; print(json.dumps(create_app().openapi()))"`

## Discovery inventory (parity checklist, from FreeshardBase/web-terminal @ 0.39.2)

Views (all must exist in Sundial; branch-switching in Apps deliberately DROPPED):

- **Home** — app-icon grid (installed apps, status dot, busy spinner, min-vm-size block +
  popover w/ upgrade link, opens `https://{app}.{host}`); usage-prompt modal on first visit
  (tour `usage prompt`); title `Shard [xxxxxx] - Home`.
- **Welcome** (public, no auth) — avatar (initials fallback), name, mailto email, markdown
  description, shard-id badge, Pair (anon) / Edit (authed) button, freeshard.net link.
- **Pair** — pairing-code form (autofocus, mono), device object auto-built from UA
  (name "Browser on OS" + icon smartphone/tablet/notebook), `?code=` auto-pair in URL,
  redirect to `/` when already terminal-typed, error alert.
- **Terminals** ("Devices") — terminal cards (icon, name inline-edit, icon rotate when editing,
  last-connection relative time ticking 1s, "This" badge for own device, delete);
  pair-new-device modal: GET pairing-code, QR link `https://{domain}/#/pair?code=X`
  (Sundial: use its own pair URL), expiry progress bar (created→valid_until), refresh on expiry,
  closes on WS `terminal_add`.
- **Apps** (store) — installed + available sections; store metadata from Azure blob
  `https://storageaccountportab0da.blob.core.windows.net/app-store/master/all_apps/store_metadata.json`
  (branch fixed to `master` in Sundial; NO branch switching); featured-first sort;
  update detection (installed `meta.app_version` != store `app_version`), update-all;
  per-app detail (modal in old app): long description, hints, featured star, min-size gate
  w/ upgrade link, install/remove/update/reinstall-on-error/open; custom app upload
  (multipart POST `/core/protected/apps`, multiple files, danger warning);
  refresh store button. App icons: installed → `/core/protected/apps/{name}/icon`,
  store → blob `.../all_apps/{name}/{icon}`.
- **Peers** — list (name, short id linked to `https://{id}.freeshard.cloud`), add by id (PUT),
  refresh peer, delete. (Hidden in old navbar `v-if=false` but route works. Port it; keep
  reachable via router, low-prominence.)
- **Public** — edit own identity: avatar upload/clear (square-image warning), name, email,
  description (textarea rows=5, markdown help + preview), warning that it's public,
  link to /welcome. PUT `/core/protected/identities` with `{id, field}`.
- **Settings** — sections:
  - Subscription (profile-driven states: trial w/ delete_after countdown, interstitial
    (`?sub=return` → poll 3s/60s timeout), active (+pending upgrade), grace/ended;
    subscribe/reactivate → POST `management/api/shards/self/subscribe` → approval_url redirect;
    price computed via lib/pricing mirror; `?sub=cancel` → cancel alert; PayPal manage link).
  - Disk Space (progress bar used/total, low/warning alerts, prune button →
    `/core/protected/settings/prune-images`).
  - Backup (nightly note, show last report, start now, passphrase reveal flow w/
    last-access info + never-viewed warning; `/core/protected/backup/{info,passphrase,start}`).
  - Size (resize xs..xl gated by max_vm_size, POST `management/api/shards/self/resize`
    → approval_url or /restart; pending-resize lock).
  - Reset Welcome Screen (DELETE `/core/protected/help/tours`).
  - About (machine id, full shard id 16-char-wrapped mono, owner, owner email, created,
    assigned, delete-after, UI version, public key PEM).
- **Restart** — spinner page, polls whoareyou every 2s; phase pending→unresponsive;
  escalating messages over minutes; on recovery `location.replace('/')`.

Shared components:

- **Navbar → bottom dock** (Sundial: dock at bottom, macOS/GNOME-like). Carries: shard-id
  badge (→ home), Home/Apps/Devices/Public/Settings items with active state, WS-disconnected
  warning (only after 5s grace), UI-update-available notice (version.json polled 60s vs own
  version → "refresh to update"), disk low/warning icon → settings, feedback (always visible,
  corner, → modal/popover: textarea + send, one-off message note + contact links).
  Sundial extras: "Classic UI" link → `/` (when at /sundial/), theme toggle.
- **Banner** — CMS banners from blob `cnc/banners.json` (from_ts/to_ts window, markdown,
  variant), shown above nav (Sundial: above content / attached to dock).
- **ShardIdBadge** — Daylight Instrument spec: diamond logomark + 6-char short id mono,
  variable-width perimeter fingerprint frame (hash-derived; port of `build_guide.py badge()`;
  NOTE ids are base36 not hex — JS uses base36 parse + mulberry32 PRNG, deterministic but
  not bit-identical to the Python reference).
- **AvatarWrapper** — img or initials fallback (first+last word initial).
- **EditableText / EditableAvatar / TextField** — inline edit pattern (off/on/syncing),
  markdown for multiline.
- **UsagePromptModal/Card** — onboarding app picker (vaultwarden, paperless-ngx, navidrome,
  linkding, immich, actual) with images from `assets/usage-prompt/`, install selected.
- Toasts (success/error), error-message extraction (`detail || error || message || data || message`).

State (old Vuex → Sundial store): `meta` {is_anonymous, device_id, device_name, identity
{id,name,email,description,public_key_pem,domain}}, `version`, `profile` (nullable — controller
passthrough may fail), `apps[]`, `terminals[]`, `tours[]`, `disk_usage` {total_gb, free_gb,
disk_space_low, +derived disk_space_warning free<5}, `websocket` {disconnectedSince}.
Getters: short id = `identity.id[:6]`, shard_href, tour_seen(name).

Boot sequence (old App.vue): parallel query meta+tours+profile+version+disk; if anonymous →
redirect /welcome (unless already Pair/Welcome); WS connect loop 1s when authed; version poll
60s. WS messages: `heartbeat` (30s), `apps_update`, `terminals_update`, `terminal_add`,
`backup_update` {error?}, `disk_usage_update`, `app_install_error` {name,error},
`subscription_updated` (→ force profile refetch). Toasts on install error / backup done+failed.

Auth: JWT cookie issued by `POST /core/public/pair/terminal?code=X` (body: {name, icon}).
`whoami` type: `anonymous` | `terminal`.

## API surface (shard_core v26; spec dump in js/api/openapi.json)

Public: `GET /public/meta/{whoami,whoareyou,avatar}`, `GET /public/health`,
`POST /public/pair/terminal?code=`.
Protected: apps (GET list, GET/POST/DELETE `{name}`, POST `{name}/reinstall`, GET `{name}/icon`,
POST multipart custom), terminals (GET, GET/PUT/DELETE `id/{id}`, GET `name/{name}`,
GET `pairing-code`), identities (GET/PUT, default, avatar GET/PUT/DELETE, make-default),
peers (GET/PUT, GET/DELETE `{id}`), backup (info, passphrase, start), stats (disk, tasks),
help/tours (GET/PUT/DELETE), feedback/quick (POST), settings/prune-images (POST),
management passthrough `/protected/management/{rest}` (profile, api/shards/self/{resize,subscribe}).
WS: `/protected/ws/updates` (not in OpenAPI).
All under `/core` prefix when served on a shard (traefik strips it).

**Metrics API (freeshard#155): NOT implemented server-side yet.** Only `/protected/stats/disk`
+ `/stats/tasks` exist. Resource monitor v1 polls disk + renders CPU/mem seam; upgrade path:
snapshot REST `/protected/stats` + per-app `/protected/apps/{name}/stats`, later WS
`/protected/stats/stream`. Never SSE.

## Deployment (coexistence, Max's personal shard only)

Shards run docker-compose: `web-terminal` image (nginx, static `/srv`), traefik routes
`PathPrefix(/) priority 1` → web-terminal:80, `/core` → shard_core (prefix stripped).
Alongside-install plan (a): get Sundial files to `/srv/sundial/` + nginx
`location /sundial/ { try_files $uri $uri/ /sundial/index.html; }`.
Max's shard: geszt8.freeshard.cloud (controller id 337) — currently STOPPED + past
delete_after (expired trial); deploy blocked until revived.

## Conventions

- Custom element names: `fs-*` (e.g. `fs-dock`, `fs-sparkline`, `view-home`).
- Component = one JS file, template via template literal, styles in a `@scope`d <style> in
  its light DOM or in `css/components/*.css`.
- No hand edits to generated `js/api/client.js`.
- Keyboard nav per DECISIONS: Alt-hold hints, Alt+letter tier-1, Alt+1..9 tier-2,
  arrows everywhere, `.fs-focusable` ring.
- Every value shown must be honest (no flattering rounding; gauges encode real ratios).
