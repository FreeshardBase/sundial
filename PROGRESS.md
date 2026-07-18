# PROGRESS — Sundial i18n (autonomous session, feat/i18n)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-i18n-spec.md`.
Previous session (rewrite, steps 1–8) is complete; its progress notes are in
git history of this file (commit 04f760c) — deploy still blocked on Max.

## Plan (locked by spec)

1. `js/i18n.js` — t(key, params), catalog loading (fetch en/de JSON), locale
   detection (GET /protected/preferences → localStorage → navigator.language
   → en; 404/HTML response expected while freeshard#168 unshipped), setLocale
   (store + localStorage + PUT prefs), Intl format helpers bound to locale.
2. `js/api/preferences.js` — isolated hand-written GET/PUT client, graceful
   on 404/non-JSON (mock server returns index.html for unknown /core GETs).
3. store: `locale` key; base.js `watch()` auto-subscribes 'locale' so every
   view re-renders on switch; dock adds 'locale' to its subscribe list.
4. Full string extraction: all views + dock, app-tile, resource-monitor,
   usage-prompt, editable-text, modal, toasts in main.js, util.js device
   name + relative time, pricing (currency via Intl), metrics formatBytes.
5. Catalogs `js/i18n/en.json` + `js/i18n/de.json` (DE is AI-generated —
   needs native review by Max).
6. Settings language switcher card (EN/DE buttons, size-picker pattern).
7. `tools/check_i18n.py` — scan t('...') keys vs catalogs (both directions).
8. Verify by driving: EN default w/ 404 fallback, live DE switch re-renders,
   DE persists across location.reload(), Intl per locale, PUT attempted
   (check via performance resource entries). EN+DE screenshots.
9. Update agents.md (i18n architecture + how to add a language), commit.

## Done

- Read spec, agents.md, all js sources; string inventory complete.
- Steps 1–7: i18n.js + preferences client + store locale + watch('locale')
  auto-subscribe + full extraction (all views/components/toasts/util/pricing/
  metrics) + en.json/de.json + settings language card + tools/check_i18n.py.
- `just check` passes (all modules parse); check_i18n.py: 224 keys, 0 problems.
- Step 8 verified by driving the real app (mock server + CDP):
  - EN default: prefs endpoint absent (mock answers 200 HTML SPA-fallback,
    handled same as 404) → navigator.language → EN. Dock/home all English.
  - DE switch in Settings: whole UI re-renders live (title, dock, cards),
    `PUT /core/protected/preferences` actually sent (fetch spy),
    localStorage['sundial.locale']='de'.
  - DE persists across client-side nav AND location.reload().
  - Intl per locale: "in 12 days"/"in 12 Tagen", "12,20 GiB", "41,5 %",
    "21,78 €/Monat", plural "2 running"/"2 laufen".
  - Route sweep home/apps/terminals/public/peers/welcome in DE: zero leaked
    i18n keys, all titles translated. Pairing modal {!link} renders as a real
    link (no escaped HTML); feedback modal DE. EN back-switch works.
  - Screenshots: docs/shots/i18n-{en-home,de-home,de-settings,
    de-language-card,de-pairing-modal}.png
- agents.md updated (i18n architecture + how to add a language).

## In flight

- Nothing — i18n done and verified. **DE catalog is AI-generated (du-form)
  and needs a native review by Max** (js/i18n/de.json).

## Blockers

- None. (Deploy-to-shard from previous session still blocked on Max; not
  part of this task.)
