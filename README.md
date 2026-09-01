# Sundial

Ground-up rewrite of the Freeshard web-terminal as a **no-build, no-framework**
SPA: vanilla HTML/CSS/JS, native ES modules + import maps, light-DOM custom
elements with scoped styles, WebSockets for live data, and the "Daylight
Instrument" design system. The files in this repo are the files the browser
runs — there is no bundler and no transpile step.

The product is still the web-terminal; *Sundial* is the codename of this
codebase (an instrument that reads true state by daylight).

## Running it

```sh
just serve         # dev server on :8021 — mock shard_core API + websocket
just serve-anon    # same, but unpaired (welcome/pair flows)
just serve-proxy https://<shard-domain>   # real shard as backend
```

The dev server also serves the app at `http://localhost:8021/sundial/` to
exercise subpath mode. Any static file server works for the app itself; only
`/core` (REST + WS) must reach a shard.

## Repo layout

- `index.html` — single entry; injects the base path, import map, theme.
- `js/` — `store.js` (tiny pub/sub store), `router.js` (History API),
  `keynav.js` (arrows + Alt shortcuts), `metrics.js` (resource-monitor
  poller), `views/` (one custom element per route), `components/`.
- `js/api/client.js` — **generated** from `js/api/openapi.json` by
  `tools/gen_client.py`; do not edit by hand.
- `css/` — `tokens.css` (design tokens, verbatim from the design system),
  component and view styles.
- `vendor/` — no-build ESM dependencies (marked, lean-qr), committed.
- `tools/` — dev server, client generator, CDP driver (`drive.py`).
- `deploy/` — alongside-install on a shard (`/sundial/` subpath), see
  `deploy/README.md`.
- `docs/` — app-store metadata extension proposal.
- `agents.md` — conventions, parity inventory, API surface (read first).

## Design system

`~/knowledge_base/freeshard/ui-style/` is canonical (design-guide.md,
DECISIONS.md, tokens). Rules that shape everything here: flat surfaces, no
shadows, hairline borders, amber marks exactly one forward action per view,
dark mode glows only on live data, and every rendered number must be honest.

## Licence

Functional Source License, Version 1.1, ALv2 Future License (`FSL-1.1-ALv2`) —
see [LICENSE.md](LICENSE.md). Running Sundial for yourself is explicitly
permitted; the restriction covers reselling a substantially similar service.
Each release converts to Apache-2.0 on its own second anniversary.
