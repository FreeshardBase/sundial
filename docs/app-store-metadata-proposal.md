# App-store metadata extension — proposal

Status: proposal only (no server/pipeline changes implemented). Companion to the
Sundial app-store redesign; gives the store "real meat" to render.

## Where the metadata lives today

`store_metadata.json` on the Azure blob (`app-store/<branch>/all_apps/`), one entry
per app, built by the app-repository pipeline:

```json
{
  "name": "glances",
  "pretty_name": "Glances",
  "app_version": "4.5.4",
  "icon": "glances.png",
  "minimum_portal_size": "xs",
  "store_info": {
    "description_short": "…one-liner…",
    "description_long": ["…paragraph…", "…paragraph…"],
    "hint": ["…"],
    "is_featured": true
  }
}
```

## Proposed schema (per-app, all new fields optional)

Extend `store_info`; keep the top level for install mechanics. Markdown allowed
where noted (rendered with the same renderer as profile descriptions).

```jsonc
{
  "name": "immich",
  "pretty_name": "Immich",
  "app_version": "1.90.0",
  "icon": "immich.png",
  "minimum_portal_size": "m",
  "store_info": {
    // existing
    "description_short": "Photo and video backup from your phone",   // ≤ ~90 chars, plain text
    "description_long": "…markdown body…",                            // NEW: markdown string preferred
                                                                      // (array-of-paragraphs stays accepted)
    "hint": ["…"],
    "is_featured": true,

    // new
    "tagline": "Your photos, on your shard",        // ≤ 40 chars; card subtitle. Falls back to description_short.
    "screenshots": [                                 // gallery; files uploaded next to the icon
      { "file": "shot-timeline.webp", "caption": "Timeline view" },
      { "file": "shot-map.webp",      "caption": "Map view" }
    ],
    "categories": ["photos", "backup"],             // from a small curated vocabulary (see below)
    "publisher": "Immich team",                     // upstream author, not Freeshard
    "links": {
      "homepage": "https://immich.app",
      "docs": "https://immich.app/docs",
      "source": "https://github.com/immich-app/immich"
    },
    "license": "AGPL-3.0",
    "changelog": "…markdown, most recent releases first…",   // or "changelog_url"
    "resource_hint": {                              // honest expectation-setting, not hard limits
      "memory_mb_idle": 900,
      "memory_mb_active": 2500,
      "disk_base_mb": 1200,
      "note": "grows with your photo library"
    },
    "maturity": "stable"                            // "experimental" | "beta" | "stable"
  }
}
```

Curated category vocabulary (start small, extend on demand):
`files`, `photos`, `documents`, `media`, `passwords`, `bookmarks`, `notes`,
`finance`, `communication`, `automation`, `developer`, `monitoring`, `backup`.

## How the UI uses each field

**Card (store list):** icon + pretty name + `tagline` (fallback `description_short`) +
category chips (max 2) + `maturity` badge when not `stable` + featured star. The
`resource_hint.memory_mb_active` powers a small "runs on XS/S/M" line computed
against the shard's size — more honest than the bare `minimum_portal_size` gate.

**Detail view (modal today, could become a route):**
- screenshot gallery at the top (lazy-loaded, swipeable on mobile; captions as
  the honest description of what's shown);
- `description_long` markdown body;
- fact column: publisher, license, version (+ "changelog" expander), links
  (homepage / docs / source), categories, resource hint, minimum size;
- hints and the existing install/open/update/remove actions unchanged.

**Search/filter (future):** categories + tagline give the store enough structure
for a filter row and client-side search without any backend querying.

## Graceful degradation (required)

Every new field is optional; the renderer must treat today's schema as the
baseline:

| Missing field | Card behaviour | Detail behaviour |
|---|---|---|
| `tagline` | show `description_short` | — |
| `screenshots` | no gallery block (no placeholder frames) | header starts with description |
| `categories` | no chips | fact row omitted |
| `publisher`/`links`/`license` | — | fact rows omitted |
| `changelog` | — | version shown without expander |
| `resource_hint` | size gate only (`minimum_portal_size`) | same |
| `maturity` | treated as `stable`, no badge | same |
| `description_long` as array | joined as paragraphs (current behaviour) | same |

Sundial's `js/appstore.js` (`storeInfo()`) is the single place the fallbacks live;
the components read only the normalized shape, so the store keeps working against
the current blob until the pipeline catches up.

## Pipeline notes (for whoever implements it)

- Fields live in each app's repo (e.g. `store_info.yml` next to the compose file);
  the app-repository build already merges per-app metadata into
  `store_metadata.json` — extend that merge, no new infrastructure.
- Screenshots: store as files next to the icon in the blob
  (`all_apps/<app>/shot-*.webp`); pipeline should downscale to ≤1280px wide and
  reject >500 KB files to keep the store snappy.
- Validate against a JSON schema in CI so a typo in one app doesn't break the
  whole store JSON.
- `description_long`: prefer a single markdown string going forward; keep
  accepting the legacy array of paragraphs.
