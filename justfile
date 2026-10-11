default:
    just --list

SOURCE_DIR := "../freeshard"

# js/api/openapi.json is a one-time offline dump, not live-synced, so nothing catches it
# drifting from freeshard's actual API unless this runs — see .github/workflows/openapi-drift.yml,
# which runs both this and `just gen-client` on every PR, the same way types-drift.yml does
# for freeshard's vendored Python models. Needs `uv` and a `freeshard` clone next to this one.
# Dump a fresh OpenAPI spec from a sibling freeshard checkout (override with `--set SOURCE_DIR`).
get-openapi:
    if [ ! -d {{SOURCE_DIR}} ]; then \
      echo "{{SOURCE_DIR}} does not exist. You need to clone freeshard first."; exit 1; \
    fi
    (cd {{SOURCE_DIR}} && uv run python3 - < "{{justfile_directory()}}/tools/dump_openapi.py") > js/api/openapi.json
    echo >> js/api/openapi.json

# Dev server with mock API on :8021 (also serves the app at /sundial/)
serve:
    uv run tools/dev_server.py

# Dev server proxying /core to a real shard
serve-proxy shard_origin:
    uv run tools/dev_server.py --proxy {{shard_origin}}

# Dev server in unpaired state (welcome/pair flows)
serve-anon:
    uv run tools/dev_server.py --anonymous

# Unit + e2e + no-build smoke (Playwright starts the dev server itself)
test:
    npm test

# Unit tests only (node:test)
test-unit:
    npm run test:unit

# E2e + no-build smoke only (Playwright vs mock-API dev server)
test-e2e:
    npm run test:e2e

# Regenerate the API client from the committed OpenAPI spec
gen-client:
    python3 tools/gen_client.py

# Bump the app version (version.json + js/version.js) and commit
@set-version version:
    just _set-version-files {{version}}
    git add version.json js/version.js
    git commit -m "set version to {{version}}"
    echo "Version set to {{version}} and committed"

_set-version-files version:
    #!/usr/bin/env python3
    import json, re
    with open('version.json') as f:
        data = json.load(f)
    data['version'] = '{{version}}'
    with open('version.json', 'w') as f:
        json.dump(data, f)
        f.write('\n')
    with open('js/version.js') as f:
        content = f.read()
    content = re.sub(r"VERSION = '[^']*'", "VERSION = '{{version}}'", content)
    with open('js/version.js', 'w') as f:
        f.write(content)

# Syntax-check all ES modules with node
check:
    #!/usr/bin/env bash
    set -e
    for f in $(find js -name '*.js'); do
      cp "$f" /tmp/sundial_check.mjs
      node --check /tmp/sundial_check.mjs || { echo "FAIL $f"; exit 1; }
    done
    echo "all modules parse"
