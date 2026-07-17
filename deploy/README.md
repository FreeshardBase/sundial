# Deploying Sundial alongside the classic web-terminal

Scope: **Max's personal shard only** — dogfooding. Never touch fleet defaults.

## How it works

Shards serve the classic web-terminal from an nginx container (`web-terminal`
in `${FREESHARD_DIR}/docker-compose.yml`, traefik routes `PathPrefix(/)` to it;
`/core` goes to shard_core with the prefix stripped). Sundial rides along as
static files in the same nginx:

- `docker-compose.override.yml` (auto-merged by docker compose, survives
  core-version updates that rewrite the main compose file) mounts
  - `${FREESHARD_DIR}/sundial/app` → `/srv/sundial` (the app files)
  - `${FREESHARD_DIR}/sundial/nginx-sundial.conf` → nginx default.conf
- `nginx-sundial.conf` keeps `location /` (classic) as-is and adds
  `location /sundial/ { try_files $uri $uri/ /sundial/index.html; }` plus a
  `/sundial → /sundial/` redirect (Sundial derives its base path from the
  document path up to the last slash).

Sundial is subpath-aware by construction (base injected in `index.html`,
API stays absolute at `/core`), so no build/config differences between
`/` and `/sundial/`.

## Install / update

```sh
deploy/install-on-shard.sh freeshard@<shard-domain>
```

Re-run for updates (it re-packs and re-uploads; bump `js/version.js` +
`version.json` so open tabs show the refresh-to-update notice).

## Switching UIs

- Sundial → classic: "Classic UI" link in the bottom dock (always visible —
  the dogfooding escape hatch).
- Classic → Sundial: navigate to `/sundial/` manually for now.

Follow-up (needs a web-terminal release, deliberately not done from here):
add a small "Try the new UI" link in the classic navbar/settings pointing to
`/sundial/`, and honor the `freeshard.ui` localStorage key (`classic` |
`sundial`) for a sticky redirect on `/`. Sundial already writes
`freeshard.ui=classic` when the user leaves via the dock link.

## Rollback

Remove `${FREESHARD_DIR}/docker-compose.override.yml` and
`docker compose up -d web-terminal` — the container reverts to the stock
image/config; classic UI was never modified.
