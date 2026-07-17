#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["websockets", "requests"]
# ///
"""Drive the app in headless Chromium over CDP: navigate, run JS, screenshot.

Usage:
  uv run tools/drive.py --url http://localhost:8021/ --shot out.png \\
      [--js "document.querySelector('.x').click()"] [--wait 1.5] [--width 1280 --height 900]

Multiple --js/--wait pairs run in order; screenshot is taken at the end.
Starts its own chromium (remote-debugging) and tears it down.
"""

import argparse
import asyncio
import base64
import json
import subprocess
import sys
import tempfile
import time

import requests
import websockets


async def cdp(ws, counter, method, params=None):
    counter[0] += 1
    msg_id = counter[0]
    await ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
    while True:
        data = json.loads(await ws.recv())
        if data.get("id") == msg_id:
            if "error" in data:
                raise RuntimeError(f"{method}: {data['error']}")
            return data.get("result", {})


async def run(args) -> None:
    port = 9333
    profile = tempfile.mkdtemp(prefix="sundial-drive-")
    proc = subprocess.Popen(
        ["chromium-browser", "--headless=new", "--disable-gpu", "--no-sandbox",
         f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
         f"--window-size={args.width},{args.height}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        target = None
        for _ in range(50):
            try:
                targets = requests.get(f"http://localhost:{port}/json").json()
                target = next(t for t in targets if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.2)
        if not target:
            sys.exit("chromium did not come up")

        async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
            counter = [0]
            await cdp(ws, counter, "Page.enable")
            await cdp(ws, counter, "Runtime.enable")
            await cdp(ws, counter, "Emulation.setDeviceMetricsOverride", {
                "width": args.width, "height": args.height,
                "deviceScaleFactor": 1, "mobile": args.width < 500})
            await cdp(ws, counter, "Page.navigate", {"url": args.url})
            await asyncio.sleep(args.settle)

            for step in args.steps:
                kind, value = step
                if kind == "js":
                    result = await cdp(ws, counter, "Runtime.evaluate", {
                        "expression": value, "awaitPromise": True, "returnByValue": True})
                    if result.get("exceptionDetails"):
                        print("JS ERROR:", json.dumps(result["exceptionDetails"])[:500])
                    else:
                        val = result.get("result", {}).get("value")
                        if val is not None:
                            print("js:", json.dumps(val)[:2000])
                else:
                    await asyncio.sleep(float(value))

            if args.shot:
                shot = await cdp(ws, counter, "Page.captureScreenshot", {"format": "png"})
                with open(args.shot, "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                print("wrote", args.shot)
    finally:
        proc.terminate()


class StepAction(argparse.Action):
    def __call__(self, parser, namespace, values, option_string):
        kind = "js" if option_string == "--js" else "wait"
        namespace.steps.append((kind, values))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True)
    p.add_argument("--shot")
    p.add_argument("--js", action=StepAction, dest="steps")
    p.add_argument("--wait", action=StepAction, dest="steps")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=900)
    p.add_argument("--settle", type=float, default=2.0)
    p.set_defaults(steps=[])
    args = p.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
