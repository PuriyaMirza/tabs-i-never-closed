#!/usr/bin/env python3
"""
Generates every icon the app needs from one drawing, so they always match.

Run from the repo root:   python3 scripts/make-icons.py
Needs Pillow:             pip install pillow

Writes:
  public/icons/icon-192.png            install icon
  public/icons/icon-512.png            install icon (large)
  public/icons/icon-maskable-512.png   same, with extra padding (see below)
  public/apple-touch-icon.png          180x180, the iPhone home-screen icon
  app/favicon.ico                      the little icon in browser tabs

The design is a bold white "T" on the app's accent blue, with two faint
tab shapes peeking out above it (a nod to "tabs I never closed").
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Same blue as --accent in app/globals.css (light mode).
BG = (10, 88, 202)
FG = (255, 255, 255)
# Lighter blues for the "tabs behind" so they stay subtle.
FAINT_1 = (60, 120, 215)
FAINT_2 = (35, 105, 208)

# Draw big, then shrink: shrinking smooths the edges (anti-aliasing).
CANVAS = 1024


def draw_icon(content_scale: float) -> Image.Image:
    """
    content_scale is how much of the square the drawing may use.
    Maskable icons use a smaller value because Android may crop the outer
    ~20% into a circle or squircle, and we must keep everything inside the
    safe zone (a circle in the middle with a radius of 40% of the width).
    """
    img = Image.new("RGB", (CANVAS, CANVAS), BG)
    d = ImageDraw.Draw(img)

    # The drawing lives in a box centred on the canvas.
    box = CANVAS * content_scale
    left = (CANVAS - box) / 2
    top = (CANVAS - box) / 2

    def u(v: float) -> float:
        """Convert a 0..1 position inside the drawing box to canvas pixels."""
        return v * box

    radius = u(0.05)

    # Two faint tab shapes above the T, each a little narrower, like a stack.
    d.rounded_rectangle(
        (left + u(0.24), top + u(0.00), left + u(0.76), top + u(0.10)),
        radius=radius, fill=FAINT_2,
    )
    d.rounded_rectangle(
        (left + u(0.18), top + u(0.07), left + u(0.82), top + u(0.17)),
        radius=radius, fill=FAINT_1,
    )

    # The bold T: a wide top bar and a thick stem.
    d.rounded_rectangle(
        (left + u(0.12), top + u(0.24), left + u(0.88), top + u(0.44)),
        radius=radius, fill=FG,
    )
    d.rounded_rectangle(
        (left + u(0.38), top + u(0.24), left + u(0.62), top + u(1.00)),
        radius=radius, fill=FG,
    )
    return img


def save(img: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)
    print("wrote", path.relative_to(ROOT))


def main() -> None:
    normal = draw_icon(0.74)
    # 0.52 keeps the whole drawing inside the circular safe zone.
    maskable = draw_icon(0.52)

    save(normal, ROOT / "public/icons/icon-192.png", 192)
    save(normal, ROOT / "public/icons/icon-512.png", 512)
    save(maskable, ROOT / "public/icons/icon-maskable-512.png", 512)
    # iOS rounds the corners itself, so this one must be a plain square.
    save(normal, ROOT / "public/apple-touch-icon.png", 180)

    # favicon.ico can hold several sizes in one file. It must be RGBA (with a
    # transparency channel) or Next.js refuses to read it.
    ico_path = ROOT / "app/favicon.ico"
    normal.convert("RGBA").resize((64, 64), Image.LANCZOS).save(
        ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    print("wrote", ico_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
