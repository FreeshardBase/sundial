#!/usr/bin/env python3
"""i18n consistency check: every t('key') in js/ exists in en.json, the two
catalogs have identical key sets, and no catalog key is unused. Dynamic keys
(template literals in t()) are checked by prefix where possible.

Exit 1 on any finding. Run: python3 tools/check_i18n.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Dynamic t(`...${x}...`) call sites and the key prefixes they can produce.
DYNAMIC_PREFIXES = ["settings.language.", "usage.cases."]
# Keys referenced via variables (e.g. NAV labelKey, subscribeLabel key vars).
INDIRECT_KEYS = {
    "dock.home", "dock.apps", "dock.devices", "dock.public", "dock.settings",
    "settings.sub.subscribe", "settings.sub.reactivate",
}


def flatten(node, prefix=""):
    keys = set()
    for k, v in node.items():
        path = f"{prefix}{k}"
        if isinstance(v, dict) and not {"one", "other"} & set(v):
            keys |= flatten(v, path + ".")
        else:
            keys.add(path)
    return keys


def main() -> int:
    catalogs = {}
    for loc in ("en", "de"):
        with open(ROOT / "js" / "i18n" / f"{loc}.json") as f:
            catalogs[loc] = flatten(json.load(f))

    used = set()
    for f in (ROOT / "js").rglob("*.js"):
        if f.name == "client.js":  # generated
            continue
        src = f.read_text()
        used |= set(re.findall(r"\bt\(\s*'([\w.-]+)'", src))
        used |= set(re.findall(r'\bt\(\s*"([\w.-]+)"', src))

    problems = []
    en = catalogs["en"]
    for key in sorted(used - en):
        problems.append(f"used but missing in en.json: {key}")
    for loc in ("de",):
        for key in sorted(en ^ catalogs[loc]):
            problems.append(f"catalog mismatch en/{loc}: {key}")
    covered = used | INDIRECT_KEYS
    for key in sorted(en - covered):
        if not any(key.startswith(p) for p in DYNAMIC_PREFIXES):
            problems.append(f"unused catalog key: {key}")

    for p in problems:
        print(p)
    print(f"{len(used)} static t() keys, {len(en)} catalog keys, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
