#!/usr/bin/env python3
"""Dump freeshard's OpenAPI spec to stdout, deterministically.

Run from inside a freeshard checkout (`uv run tools/dump_openapi.py` won't
work here — this script needs shard_core on the path, which only `uv run`
from *within* the freeshard repo provides). Invoked by `just get-openapi`
in the sundial repo, which cds into a sibling freeshard checkout first.
"""

import json
import logging
import re
import sys

logging.disable(logging.CRITICAL)  # configure_logging() logs to stdout; silence it

from shard_core.app_factory import create_app  # noqa: E402

spec = create_app().openapi()

# A few catch-all passthrough routes (call_backend, call_peer, call_management)
# register every HTTP method on one path via a single route declaration. FastAPI
# derives each one's operationId from that shared declaration rather than per
# method, and *which* method's name ends up in the (duplicated, shared) id is
# whatever a Python set() of methods happens to iterate last — order depends on
# the per-process hash seed, so the same commit dumps a different id each run
# (confirmed: diffed repeated runs against one commit; checked every other path
# in the spec and only these three ever mismatch their own method). Two fixes,
# both needed — sorting alone leaves every operation sharing one random id:
_VERB_ORDER = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "connect"]
_TRAILING_VERB = re.compile(r"(?:%s)$" % "|".join(_VERB_ORDER))
for ops in spec["paths"].values():
    order = _VERB_ORDER + [k for k in ops if k not in _VERB_ORDER]
    sorted_ops = {k: ops[k] for k in order if k in ops}
    ops.clear()
    ops.update(sorted_ops)
    for method, op in ops.items():
        if "operationId" in op:
            op["operationId"] = _TRAILING_VERB.sub(method, op["operationId"])

json.dump(spec, sys.stdout, indent=1)
