#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["aiohttp"]
# ///
"""Sundial dev server: static files (served at / AND /sundial/ to exercise
subpath mode) + a mock shard_core API under /core, including the updates
websocket with staged app-install transitions.

Usage: uv run tools/dev_server.py [--port 8021] [--proxy https://<shard>]
With --proxy, /core is forwarded to a real shard instead of mocked.
"""

import argparse
import asyncio
import copy
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import ClientSession, WSMsgType, web

ROOT = Path(__file__).resolve().parent.parent

IDENTITY = {
    "id": "geszt8y57h0ylg2q08wqqxbp7evv5vrxdhypp547x2qf67yaehwrzlbk1s3gjtjdtj23jsj10r6pjwvqn0a56hqdg6ht5vjfzff2ka2",
    "name": "Max Mustermann",
    "email": "max@example.org",
    "description": "This is **my** shard.\n\nSelf-hosting, but easy.",
    "public_key_pem": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkq...dev-mock...\n-----END PUBLIC KEY-----",
    "domain": "localhost:8021",
}

STATE = {
    "paired": True,
    "apps": [
        {"name": "filebrowser", "status": "running", "installation_reason": "config",
         "meta": {"pretty_name": "File Browser", "app_version": "2.32.0", "minimum_vm_size": "xs",
                  "store_info": {"description_short": "Browse and manage your files", "is_featured": True}}},
        {"name": "vaultwarden", "status": "running", "installation_reason": "store",
         "meta": {"pretty_name": "Vaultwarden", "app_version": "1.30.0", "minimum_vm_size": "xs",
                  "store_info": {"description_short": "Password manager", "is_featured": True}}},
        {"name": "immich", "status": "stopped", "installation_reason": "store",
         "meta": {"pretty_name": "Immich", "app_version": "1.90.0", "minimum_vm_size": "m",
                  "store_info": {"description_short": "Photos and videos", "is_featured": True}}},
        {"name": "mealie", "status": "error", "installation_reason": "custom",
         "meta": {"pretty_name": "Mealie", "app_version": "1.2.0", "minimum_vm_size": "xs",
                  "store_info": {"description_short": "Recipe manager"}}},
    ],
    "terminals": [
        {"id": "abc123", "name": "Firefox on Linux", "icon": "notebook",
         "last_connection": datetime.now(timezone.utc).isoformat()},
        {"id": "def456", "name": "Max's Phone", "icon": "smartphone",
         "last_connection": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()},
    ],
    "tours": [{"name": "usage prompt", "status": "seen"}],
    "disk": {"total_gb": 29.4, "free_gb": 17.2, "disk_space_low": False},
    "profile": {
        "vm_id": "8318d68b-139f-41c1-a442-c1b04d073097",
        "owner": "Max Mustermann", "owner_email": "max@example.org",
        "time_created": "2026-07-08T10:46:33Z", "time_assigned": "2026-07-13T11:32:44Z",
        "delete_after": (datetime.now(timezone.utc) + timedelta(days=12)).isoformat(),
        "vm_size": "s", "max_vm_size": "l", "volume_size_gb": 30,
        "subscription": None,
    },
    "backup": {"last_report": "snapshot 2026-07-14 03:09 — 1.2 GiB, ok", "last_passphrase_access_info": None},
}

SOCKETS: set[web.WebSocketResponse] = set()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def broadcast(message_type: str, message) -> None:
    data = json.dumps({"message_type": message_type, "message": message})
    for ws in list(SOCKETS):
        try:
            await ws.send_str(data)
        except ConnectionError:
            SOCKETS.discard(ws)


def app_by_name(name: str):
    return next((a for a in STATE["apps"] if a["name"] == name), None)


async def transition_app(name: str, phases: list[tuple[str, float]], final: str | None) -> None:
    for status, delay in phases:
        app = app_by_name(name)
        if not app:
            return
        app["status"] = status
        await broadcast("apps_update", STATE["apps"])
        await asyncio.sleep(delay)
    if final is None:
        STATE["apps"] = [a for a in STATE["apps"] if a["name"] != name]
    else:
        app = app_by_name(name)
        if app:
            app["status"] = final
    await broadcast("apps_update", STATE["apps"])


def json_response(data, status: int = 200) -> web.Response:
    return web.json_response(data, status=status)


def make_mock_routes() -> list[web.RouteDef]:
    r = web.RouteTableDef()

    @r.get("/core/public/meta/whoami")
    async def whoami(req):
        if STATE["paired"]:
            return json_response({"type": "terminal", "id": "abc123", "name": "Firefox on Linux"})
        return json_response({"type": "anonymous"})

    @r.get("/core/public/meta/whoareyou")
    async def whoareyou(req):
        return json_response({**IDENTITY, "public_key_pem": IDENTITY["public_key_pem"]})

    @r.get("/core/public/meta/avatar")
    @r.get("/core/protected/identities/default/avatar")
    async def avatar(req):
        return web.Response(status=404, text="no avatar")

    @r.post("/core/public/pair/terminal")
    async def pair(req):
        if req.query.get("code") == "123456":
            STATE["paired"] = True
            return json_response({"id": "abc123", "name": "Firefox on Linux"})
        return json_response({"detail": "Invalid pairing code"}, status=401)

    @r.get("/core/protected/apps")
    async def apps(req):
        return json_response(STATE["apps"])

    @r.get("/core/protected/apps/{name}/icon")
    async def app_icon(req):
        return web.Response(status=404)

    @r.post("/core/protected/apps/{name}")
    async def install(req):
        name = req.match_info["name"]
        if not app_by_name(name):
            STATE["apps"].append({"name": name, "status": "installation_queued",
                                  "installation_reason": "store", "meta": None})
        asyncio.get_event_loop().create_task(
            transition_app(name, [("installation_queued", 1), ("installing", 3)], "running"))
        return json_response({})

    @r.delete("/core/protected/apps/{name}")
    async def uninstall(req):
        name = req.match_info["name"]
        asyncio.get_event_loop().create_task(
            transition_app(name, [("uninstalling", 2)], None))
        return json_response({})

    @r.post("/core/protected/apps/{name}/reinstall")
    async def reinstall(req):
        name = req.match_info["name"]
        asyncio.get_event_loop().create_task(
            transition_app(name, [("reinstallation_queued", 1), ("reinstalling", 3)], "running"))
        return json_response({})

    @r.post("/core/protected/apps")
    async def custom_app(req):
        await req.post()
        return json_response({})

    @r.get("/core/protected/terminals")
    async def terminals(req):
        return json_response(STATE["terminals"])

    @r.get("/core/protected/terminals/pairing-code")
    async def pairing_code(req):
        created = datetime.now(timezone.utc)
        return json_response({"code": "123456", "created": created.isoformat(),
                              "valid_until": (created + timedelta(minutes=2)).isoformat()})

    @r.put("/core/protected/terminals/id/{id}")
    async def edit_terminal(req):
        body = await req.json()
        for t in STATE["terminals"]:
            if t["id"] == req.match_info["id"]:
                t.update({k: body[k] for k in ("name", "icon") if k in body})
        await broadcast("terminals_update", STATE["terminals"])
        return json_response({})

    @r.delete("/core/protected/terminals/id/{id}")
    async def delete_terminal(req):
        STATE["terminals"] = [t for t in STATE["terminals"] if t["id"] != req.match_info["id"]]
        await broadcast("terminals_update", STATE["terminals"])
        return json_response({})

    @r.get("/core/protected/identities/default")
    async def default_identity(req):
        return json_response(IDENTITY)

    @r.put("/core/protected/identities")
    async def put_identity(req):
        body = await req.json()
        IDENTITY.update({k: v for k, v in body.items() if k in IDENTITY})
        return json_response({})

    @r.put("/core/protected/identities/default/avatar")
    async def put_avatar(req):
        await req.post()
        return json_response({})

    @r.delete("/core/protected/identities/default/avatar")
    async def delete_avatar(req):
        return json_response({})

    @r.get("/core/protected/peers")
    async def peers(req):
        return json_response([{"id": "nwvn5y", "name": "Uli"}, {"id": "ep4tbx", "name": None}])

    @r.put("/core/protected/peers")
    async def put_peer(req):
        return json_response({})

    @r.delete("/core/protected/peers/{id}")
    async def delete_peer(req):
        return json_response({})

    @r.get("/core/protected/stats/disk")
    async def disk(req):
        return json_response(STATE["disk"])

    @r.get("/core/protected/help/tours")
    async def tours(req):
        return json_response(STATE["tours"])

    @r.put("/core/protected/help/tours")
    async def put_tour(req):
        body = await req.json()
        STATE["tours"] = [t for t in STATE["tours"] if t["name"] != body["name"]] + [body]
        return json_response({})

    @r.delete("/core/protected/help/tours")
    async def reset_tours(req):
        STATE["tours"] = []
        return json_response({})

    @r.get("/core/protected/management/profile")
    async def profile(req):
        return json_response(STATE["profile"])

    @r.post("/core/protected/management/api/shards/self/resize")
    async def resize(req):
        return json_response({})

    @r.post("/core/protected/management/api/shards/self/subscribe")
    async def subscribe(req):
        return json_response({"approval_url": "https://example.org/paypal-approval"})

    @r.get("/core/protected/backup/info")
    async def backup_info(req):
        return json_response(STATE["backup"])

    @r.get("/core/protected/backup/passphrase")
    async def passphrase(req):
        STATE["backup"]["last_passphrase_access_info"] = {
            "time": now_iso(), "terminal_id": "abc123", "terminal_name": "Firefox on Linux"}
        return json_response({"passphrase": "correct-horse-battery-staple-dev"})

    @r.post("/core/protected/backup/start")
    async def start_backup(req):
        async def done():
            await asyncio.sleep(2)
            await broadcast("backup_update", {})
        asyncio.get_event_loop().create_task(done())
        return json_response({})

    @r.post("/core/protected/feedback/quick")
    async def feedback(req):
        print("feedback:", (await req.json()).get("text"))
        return json_response({})

    @r.post("/core/protected/settings/prune-images")
    async def prune(req):
        return json_response({"message": "Reclaimed 1.2 GB"})

    @r.get("/core/protected/ws/updates")
    async def ws_updates(req):
        ws = web.WebSocketResponse()
        await ws.prepare(req)
        SOCKETS.add(ws)
        try:
            async for msg in ws:
                if msg.type == WSMsgType.ERROR:
                    break
        finally:
            SOCKETS.discard(ws)
        return ws

    return r


async def heartbeat() -> None:
    while True:
        await broadcast("heartbeat", {})
        await asyncio.sleep(30)


def make_static_handler():
    async def handler(req: web.Request) -> web.Response:
        path = req.path
        if path.startswith("/sundial/"):
            path = path[len("/sundial"):]
        elif path == "/sundial":
            raise web.HTTPFound("/sundial/")
        rel = path.lstrip("/")
        file = (ROOT / rel) if rel else ROOT / "index.html"
        if not file.is_file():
            file = ROOT / "index.html"
        if ROOT not in file.resolve().parents and file.resolve() != ROOT:
            raise web.HTTPForbidden()
        return web.FileResponse(file)
    return handler


def make_proxy_handler(upstream: str, session_holder: dict):
    async def handler(req: web.Request):
        if req.headers.get("Upgrade", "").lower() == "websocket":
            ws_client = web.WebSocketResponse()
            await ws_client.prepare(req)
            url = upstream.replace("https", "wss").replace("http", "ws") + req.path_qs
            async with session_holder["s"].ws_connect(url) as ws_up:
                async def pump(src, dst):
                    async for msg in src:
                        if msg.type == WSMsgType.TEXT:
                            await dst.send_str(msg.data)
                await asyncio.gather(pump(ws_up, ws_client), pump(ws_client, ws_up))
            return ws_client
        body = await req.read()
        async with session_holder["s"].request(
                req.method, upstream + req.path_qs, data=body or None,
                headers={k: v for k, v in req.headers.items()
                         if k.lower() not in ("host", "content-length")}) as resp:
            data = await resp.read()
            return web.Response(status=resp.status, body=data,
                                content_type=resp.content_type)
    return handler


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8021)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--proxy", help="forward /core to this shard origin instead of mocking")
    p.add_argument("--anonymous", action="store_true", help="start unpaired")
    args = p.parse_args()

    if args.anonymous:
        STATE["paired"] = False

    app = web.Application()
    if args.proxy:
        holder = {}
        async def on_start(app):
            holder["s"] = ClientSession()
        app.on_startup.append(on_start)
        app.router.add_route("*", "/core/{tail:.*}", make_proxy_handler(args.proxy, holder))
    else:
        app.add_routes(make_mock_routes())
        async def start_heartbeat(app):
            asyncio.get_event_loop().create_task(heartbeat())
        app.on_startup.append(start_heartbeat)
    app.router.add_route("GET", "/{tail:.*}", make_static_handler())

    mode = f"proxy → {args.proxy}" if args.proxy else "mock API"
    print(f"Sundial dev server on http://{args.host}:{args.port}  ({mode})")
    print(f"subpath test: http://{args.host}:{args.port}/sundial/")
    web.run_app(app, host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
