# PROGRESS — Sundial build (autonomous session)

Resume contract: re-read this file + agents.md, continue from "In flight".
Spec: `~/knowledge_base/freeshard/sundial-rewrite-spec.md` (read fully on resume).

## Phase / execution-order step

Step 1 (Discovery) DONE → starting Step 2 (Scaffold).

## Done

- Discovery complete; full parity inventory + API surface + deployment mechanics written
  into `agents.md` (authoritative checklist for parity views).
- OpenAPI spec dumped from shard_core FastAPI app → /tmp/shard_core_openapi.json
  (41 paths; will be committed to js/api/openapi.json).
- Design system read: tokens.css/components.css (copy verbatim), DECISIONS.md, design-guide.md,
  sparkline reference (build_sparkline.py), badge fingerprint algorithm (build_guide.py).
- Key facts: metrics API #155 NOT implemented (poll stats/disk, seam for CPU/mem);
  WS message types enumerated; store metadata schema from Azure blob (42 apps);
  Max's shard geszt8 (id 337) STOPPED + expired → live-API testing and deploy blocked
  (fallback: run shard_core locally via its docker-compose/uv for integration testing).

## In flight

- Scaffold: index.html + import map + tokens + store + router + hello view + justfile serve.

## Blockers

- Max's personal shard geszt8.freeshard.cloud is STOPPED (expired trial, delete_after
  2026-07-14 passed). Cannot test against live API or deploy alongside-install until Max
  revives/replaces it. Not blocking build: use local shard_core (uv run) as dev backend.

## Next after current

1. Step 3: tools/gen_client.py → js/api/client.js from openapi.json; store hydration.
2. Step 4: app shell (dock bottom, routing, keyboard nav, badge, theme).
3. Step 5: parity views per agents.md checklist.
4. Step 6: resource monitor sparkline, app-store redesign + metadata proposal doc, responsive.
5. Step 7/8: docs; alongside install (likely blocked → ntfy Max + document manual step).
