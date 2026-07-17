default:
    just --list

# Dev server with mock API on :8021 (also serves the app at /sundial/)
serve:
    uv run tools/dev_server.py

# Dev server proxying /core to a real shard
serve-proxy shard_origin:
    uv run tools/dev_server.py --proxy {{shard_origin}}

# Dev server in unpaired state (welcome/pair flows)
serve-anon:
    uv run tools/dev_server.py --anonymous

# Regenerate the API client from the committed OpenAPI spec
gen-client:
    python3 tools/gen_client.py

# Syntax-check all ES modules with node
check:
    #!/usr/bin/env bash
    set -e
    for f in $(find js -name '*.js'); do
      cp "$f" /tmp/sundial_check.mjs
      node --check /tmp/sundial_check.mjs || { echo "FAIL $f"; exit 1; }
    done
    echo "all modules parse"
