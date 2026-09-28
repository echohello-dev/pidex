#!/usr/bin/env python
"""Build the README banner: the pidex lockup centered on the
design-system background (bg-canvas, blueprint grid, fade into bg-deep).

The lockup itself comes from scripts/build-logo.py.

Outputs:
  docs/assets/banner.png  (1600x600)
  docs/assets/banner-bg.svg
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "assets"
ASSETS = REPO / "assets"

BANNER_W, BANNER_H = 1600, 600


def build_bg_svg():
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BANNER_W} {BANNER_H}" width="{BANNER_W}" height="{BANNER_H}">'
        '<defs>'
        '<linearGradient id="vert" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#0d1116" stop-opacity="0"/>'
        '<stop offset="1" stop-color="#0d1116" stop-opacity="0.85"/>'
        '</linearGradient>'
        '<pattern id="grid_minor" width="96" height="96" patternUnits="userSpaceOnUse">'
        '<path d="M 96 0 L 0 0 0 96" fill="none" stroke="hsl(218 60% 80% / 0.10)" stroke-width="1"/>'
        '</pattern>'
        '<pattern id="grid_major" width="480" height="480" patternUnits="userSpaceOnUse">'
        '<path d="M 480 0 L 0 0 0 480" fill="none" stroke="hsl(218 60% 80% / 0.22)" stroke-width="1.5"/>'
        '</pattern>'
        '</defs>'
        f'<rect x="0" y="0" width="{BANNER_W}" height="{BANNER_H}" fill="#161d27"/>'
        f'<rect x="0" y="0" width="{BANNER_W}" height="{BANNER_H}" fill="url(#grid_minor)"/>'
        f'<rect x="0" y="0" width="{BANNER_W}" height="{BANNER_H}" fill="url(#grid_major)"/>'
        f'<rect x="0" y="0" width="{BANNER_W}" height="{BANNER_H}" fill="url(#vert)"/>'
        '</svg>'
    )


def render(svg, out, width):
    if not shutil.which("inkscape"):
        raise SystemExit("inkscape not found on PATH")
    tmp = out.with_suffix(".tmp.svg")
    tmp.write_text(svg)
    subprocess.run(
        ["inkscape", str(tmp), "--export-type=png", "--export-filename", str(out), "--export-width", str(width)],
        check=True,
    )
    tmp.unlink()


def main():
    logo = ASSETS / "logo.svg"
    if not logo.exists():
        raise SystemExit("assets/logo.svg missing; run scripts/build-logo.py first")

    bg_svg = build_bg_svg()
    (DOCS / "banner-bg.svg").write_text(bg_svg)
    bg_png = DOCS / "banner-bg.png"
    render(bg_svg, bg_png, BANNER_W)

    lockup = DOCS / "lockup.png"
    subprocess.run(
        [
            "inkscape",
            str(logo),
            "--export-type=png",
            "--export-filename",
            str(lockup),
            "--export-width",
            "760",
        ],
        check=True,
    )
    subprocess.run(
        [
            "magick",
            str(bg_png),
            str(lockup),
            "-gravity",
            "center",
            "-composite",
            str(DOCS / "banner.png"),
        ],
        check=True,
    )
    bg_png.unlink()
    lockup.unlink()
    print(f"wrote {DOCS / 'banner.png'}")


if __name__ == "__main__":
    main()