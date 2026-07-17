#!/usr/bin/env python3
"""Generate js/api/client.js (plain ESM, JSDoc-typed) from js/api/openapi.json.

Runs offline, output is committed and served as-is (no-build rule: generators
are fine, serve-time transpile is not). Covers /public/* and /protected/*
operations; /internal/* and /management/* are not part of the terminal surface.

Usage: tools/gen_client.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "js" / "api" / "openapi.json"
OUT = ROOT / "js" / "api" / "client.js"

HEADER = """\
// GENERATED FILE — do not edit by hand. Regenerate with tools/gen_client.py
// Source of truth: js/api/openapi.json (dumped from shard_core's FastAPI app).
//
// All functions return parsed JSON (or Response for binary endpoints) and
// throw ApiError on non-2xx, with .status and .detail extracted the way the
// backend reports errors.

// The REST API is same-origin at an absolute path — independent of the
// subpath the app itself is served under.
export const API_ROOT = '/core';

export class ApiError extends Error {
  constructor(status, detail, body) {
    super(`${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

// Exported for the few endpoints outside the generated surface
// (management passthrough calls with bodies, cache-busted avatar fetches).
export async function call(method, path, { query, json, form } = {}) {
  const url = new URL(API_ROOT + path, location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }
  const init = { method, headers: {} };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (form !== undefined) {
    init.body = form; // FormData — browser sets the multipart boundary
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = res.statusText;
    let body = null;
    try {
      body = await res.json();
      detail = body.detail || body.error || body.message || JSON.stringify(body);
    } catch { try { detail = await res.text() || detail; } catch { /* keep statusText */ } }
    throw new ApiError(res.status, detail, body);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}
"""


def js_ident(name: str) -> str:
    parts = re.split(r"[^a-zA-Z0-9]+", name)
    parts = [p for p in parts if p]
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def short_name(op_id: str, path: str, method: str) -> str:
    tail = re.sub(r"[^a-zA-Z0-9]+", "_", path).strip("_") + "_" + method
    tail = re.sub(r"_+", "_", tail)
    base = re.sub(r"_+", "_", op_id)
    if base.endswith(tail):
        base = base[: -len(tail)].rstrip("_")
    return js_ident(base or op_id)


def schema_type(schema, spec) -> str:
    if not schema:
        return "any"
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    t = schema.get("type")
    if "anyOf" in schema:
        return "|".join(schema_type(s, spec) for s in schema["anyOf"])
    if t == "array":
        return f"Array<{schema_type(schema.get('items'), spec)}>"
    if t == "integer" or t == "number":
        return "number"
    if t == "string":
        return "string"
    if t == "boolean":
        return "boolean"
    if t == "object" or "properties" in schema:
        return "Object"
    if t == "null":
        return "null"
    return "any"


def gen_typedefs(spec) -> str:
    out = []
    for name, schema in spec.get("components", {}).get("schemas", {}).items():
        if name in ("HTTPValidationError", "ValidationError"):
            continue
        props = schema.get("properties", {})
        if not props:
            continue
        lines = [f"/**", f" * @typedef {{Object}} {name}"]
        required = set(schema.get("required", []))
        for pname, pschema in props.items():
            t = schema_type(pschema, spec)
            opt = "" if pname in required else "="
            lines.append(f" * @property {{{t}{opt}}} {pname}")
        lines.append(" */")
        out.append("\n".join(lines))
    return "\n\n".join(out)


def gen_ops(spec) -> str:
    out = []
    seen = {}
    for path, ops in spec["paths"].items():
        if not (path.startswith("/public/") or path.startswith("/protected/")):
            continue
        for method, op in ops.items():
            if method not in ("get", "post", "put", "delete", "patch"):
                continue
            name = short_name(op.get("operationId", ""), path, method)
            if name in seen:
                name = js_ident(f"{name}_{method}")
            seen[name] = True

            path_params = []
            query_params = []
            for p in op.get("parameters", []):
                (path_params if p["in"] == "path" else query_params).append(p)

            body = op.get("requestBody", {}).get("content", {})
            body_kind = None
            body_type = "any"
            if "application/json" in body:
                body_kind = "json"
                body_type = schema_type(body["application/json"].get("schema"), spec)
            elif "multipart/form-data" in body:
                body_kind = "form"
                body_type = "FormData"

            resp = (
                op.get("responses", {})
                .get("200", op.get("responses", {}).get("201", {}))
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            ret = schema_type(resp, spec) if resp else "Response"

            args = [js_ident(p["name"]) for p in path_params]
            if body_kind:
                args.append("body")
            if query_params:
                args.append("query = {}")

            doc = [f"/** {method.upper()} {path}"]
            summary = op.get("summary")
            if summary:
                doc[0] = f"/** {method.upper()} {path} — {summary}"
            for p in path_params:
                doc.append(f" * @param {{{schema_type(p.get('schema'), spec)}}} {js_ident(p['name'])}")
            if body_kind:
                doc.append(f" * @param {{{body_type}}} body")
            if query_params:
                qdesc = ", ".join(
                    f"{p['name']}{'' if p.get('required') else '?'}" for p in query_params
                )
                doc.append(f" * @param {{Object}} [query] — {{{qdesc}}}")
            doc.append(f" * @returns {{Promise<{ret}>}}")
            doc.append(" */")

            tpl_path = re.sub(
                r"\{([^}]+)\}",
                lambda m: "${encodeURIComponent(" + js_ident(m.group(1)) + ")}",
                path,
            )
            opts = []
            if query_params:
                opts.append("query")
            if body_kind == "json":
                opts.append("json: body")
            elif body_kind == "form":
                opts.append("form: body")
            opts_js = f", {{ {', '.join(opts)} }}" if opts else ""

            fn = (
                "\n".join(doc)
                + f"\nexport function {name}({', '.join(args)}) {{\n"
                + f"  return call('{method.upper()}', `{tpl_path}`{opts_js});\n}}"
            )
            out.append(fn)
    return "\n\n".join(out)


def main():
    spec = json.loads(SPEC.read_text())
    parts = [
        HEADER,
        "// ---- schema typedefs ----\n",
        gen_typedefs(spec),
        "\n// ---- operations ----\n",
        gen_ops(spec),
        "",
    ]
    OUT.write_text("\n".join(parts))
    ops = len(re.findall(r"^export function", "\n".join(parts), re.M))
    print(f"wrote {OUT.relative_to(ROOT)} ({ops} operations)")


if __name__ == "__main__":
    main()
