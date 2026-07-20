#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
"""Generate the PWA icon set from the shard logomark (assets/img/favicon.png).

Outputs (committed; rerun only when the logo changes):
  assets/img/icon-192.png           192x192, transparent, purpose "any"
  assets/img/icon-512.png           512x512, transparent, purpose "any"
  assets/img/icon-maskable-512.png  512x512, warm-paper background, logo inside
                                    the maskable safe zone (inner 80% circle)
  assets/img/icon-180.png           180x180, warm-paper background (apple-touch)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
PAPER = (0xF6, 0xF4, 0xEF, 0xFF)  # --bg "warm paper" from css/tokens.css


def logo() -> Image.Image:
    im = Image.open(IMG / "favicon.png").convert("RGBA")
    return im.crop(im.getbbox())  # trim transparent padding


def render(size: int, content_h: int, background=None) -> Image.Image:
    mark = logo()
    h = content_h
    w = round(mark.width * h / mark.height)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    scaled = mark.resize((w, h), Image.LANCZOS)
    canvas.paste(scaled, ((size - w) // 2, (size - h) // 2), scaled)
    return canvas


def main() -> None:
    # "any" icons: near-full-bleed artwork
    render(192, 174).save(IMG / "icon-192.png")
    render(512, 464).save(IMG / "icon-512.png")
    # maskable: the diamond's vertices must stay inside the safe-zone circle
    # (radius 0.4 * size), so content height <= 0.8 * size with margin
    render(512, 380, PAPER).save(IMG / "icon-maskable-512.png")
    render(180, 134, PAPER).save(IMG / "icon-180.png")
    print("icons written to", IMG)


if __name__ == "__main__":
    main()
