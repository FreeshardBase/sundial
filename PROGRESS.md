# PROGRESS — Sundial build (autonomous session)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-rewrite-spec.md`.

## Phase / execution-order step

Steps 1–7 DONE. Step 8 (alongside install on Max's shard) is fully prepared but
**blocked on a Max-manual step** (see Blockers). Buildable work is complete.

## Done

- Discovery: parity inventory + API surface + WS protocol + deployment mechanics
  in `agents.md`. OpenAPI dumped from shard_core → `js/api/openapi.json`.
- Scaffold + shell: no-build ESM app, subpath-aware base injection, tiny store,
  History router, keynav (arrows + Alt hints, tier-1/tier-2), modal system with
  page-recede, toasts, bottom dock with fingerprint shard badge, theme toggle,
  self-hosted fonts, tokens verbatim.
- Generated API client (`tools/gen_client.py` → `js/api/client.js`, 50 ops).
- All parity views (home, welcome, pair, terminals, apps, public, settings,
  peers, restart) + banner + usage prompt + editable text/avatar. App-store
  branch switching deliberately dropped per spec.
- New features: resource monitor (fs-sparkline port of the designed component,
  metrics poller against the #155 snapshot shape, honest unsupported state,
  WS-stream seam), redesigned store cards + detail modal, shard summary card,
  responsive extremes (mobile dock, ≥1400px two-column home, ≥2200px wider),
  dark "dusk" theme verified.
- Docs: `docs/app-store-metadata-proposal.md`, `README.md`, `deploy/README.md`.
- Deploy artifacts: nginx conf (verified in real nginx:alpine — classic at /,
  /sundial redirect + SPA fallback), compose override, `install-on-shard.sh`.
- Verified by driving the real UI (tools/drive.py, CDP): anonymous→welcome,
  pair-with-code→home, usage prompt, install flow with live WS transitions
  (installing→running) across views, feedback send, inline identity edit,
  Alt hints + arrow focus, subpath deep-links, dark + mobile + 4K screenshots.
- Dock decision reflected back into ui-style/DECISIONS.md.

## In flight

- Nothing. Awaiting Max for the deploy step below.

## Blockers (Max-manual)

**Deploy to personal shard blocked: geszt8.freeshard.cloud (controller id 337)
is STOPPED and past its trial `delete_after` (2026-07-14).** The VM does not
answer (SSH/HTTPS time out), so the alongside install cannot run and Sundial
could not be tested against a live shard API (mock + generated-from-spec client
used instead).

When a live shard exists, the deploy is one command:

    deploy/install-on-shard.sh <ssh-user>@<shard-domain>

(needs SSH access to the shard VM; installs to $FREESHARD_DIR/sundial/, adds a
compose override + nginx conf, restarts web-terminal, curl-verifies both UIs).
Afterwards: quick smoke of pair/apps/settings against the real API; expect the
resource monitor to show "not available yet" until freeshard#155 lands.

## Follow-ups (not blockers)

- Classic-side "Try the new UI" link + sticky `freeshard.ui` redirect — needs a
  FreeshardBase/web-terminal release (deliberately not done from this repo).
- Metrics API #155 server-side; then optionally WS `/protected/stats/stream`.
- App-store metadata pipeline per `docs/app-store-metadata-proposal.md`.
