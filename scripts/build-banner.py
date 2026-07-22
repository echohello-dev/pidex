#!/usr/bin/env python
"""Build the README banner: the pidex logo (isometric cube with the
Pi coding agent logo on its top face + wordmark) centered on the
design-system background (bg-canvas with the blueprint grid + vertical
gradient into bg-deep).

Outputs:
  docs/assets/banner.png  (1600x600)
  assets/logo.png         (regenerated as part of the build)
  docs/assets/banner-bg.svg  (the background SVG, tracked)
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "assets"
ASSETS = REPO / "assets"

BANNER_W, BANNER_H = 1600, 600

INK_BRONZE = "#13110f"
PARCHMENT = "#dacbc2"


def pi_path(font_path):
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen

    font = TTFont(font_path)
    cmap = font.getBestCmap()
    gname = cmap[ord("π")]
    pen = SVGPathPen(font.getGlyphSet())
    font.getGlyphSet()[gname].draw(pen)
    glyf = font["glyf"][gname]
    bbox = (glyf.xMin, glyf.yMin, glyf.xMax, glyf.yMax)
    return pen.getCommands(), bbox, font["head"].unitsPerEm


def build_logo_svg(width, height):
    d, bbox, _ = pi_path("/System/Library/Fonts/Supplemental/Georgia Italic.ttf")
    gx = (bbox[0] + bbox[2]) / 2
    gy = (bbox[1] + bbox[3]) / 2
    e = 200
    dx = e * 0.866
    dy = e * 0.5
    cx, cy = width / 2 - 60, height / 2
    top = (cx, cy - dy)
    right = (cx + dx, cy)
    bot = (cx, cy + dy)
    left = (cx - dx, cy)
    a = dx / 470.0
    b = dy / 470.0
    # Scale the Pi logo to 65% of the top face so it fits with padding
    pad_scale = 0.65
    a *= pad_scale
    b *= pad_scale
    transform = f"matrix({a} {b} {-a} {b} {cx} {cy - dy})"
    p_d = (
        "M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z "
        "M282.65 282.65 V400 H400 V282.65 Z"
    )
    i_dot_d = "M517.36 400 H634.72 V634.72 H517.36 Z"
    word_x = right[0] + 60
    word_y = cy + 20
    word_size = int(height * 0.22)
    parts = []
    parts.append(
        f'<polygon points="{top[0]},{top[1]} {right[0]},{right[1]} {bot[0]},{bot[1]} {left[0]},{left[1]}" fill="#161d27" stroke="{INK_BRONZE}" stroke-width="3" stroke-linejoin="round"/>'
    )
    parts.append(
        f'<polygon points="{right[0]},{right[1]} {bot[0]},{bot[1]} {bot[0]},{bot[1] + e} {right[0]},{right[1] + e}" fill="#212730" stroke="{INK_BRONZE}" stroke-width="3" stroke-linejoin="round"/>'
    )
    parts.append(
        f'<polygon points="{left[0]},{left[1]} {bot[0]},{bot[1]} {bot[0]},{bot[1] + e} {left[0]},{left[1] + e}" fill="#0d1116" stroke="{INK_BRONZE}" stroke-width="3" stroke-linejoin="round"/>'
    )
    parts.append(f'<g transform="{transform}">')
    parts.append(f'<path fill="{PARCHMENT}" fill-rule="evenodd" d="{p_d}"/>')
    parts.append(f'<path fill="{PARCHMENT}" d="{i_dot_d}"/>')
    parts.append("</g>")
    parts.append(
        f'<text x="{word_x}" y="{word_y}" font-family="Georgia, serif" font-size="{word_size}" font-weight="500" fill="{PARCHMENT}" letter-spacing="-1.2">pidex</text>'
    )
    inner = "".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">{inner}</svg>'
    )


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
    bg_svg = build_bg_svg()
    (DOCS / "banner-bg.svg").write_text(bg_svg)
    bg_png = DOCS / "banner-bg.png"
    render(bg_svg, bg_png, BANNER_W)

    logo_svg = build_logo_svg(BANNER_W, BANNER_H)
    logo_png = ASSETS / "logo.png"
    render(logo_svg, logo_png, BANNER_W)

    subprocess.run(
        ["magick", str(bg_png), str(logo_png), "-composite", str(DOCS / "banner.png")],
        check=True,
    )
    bg_png.unlink()
    print(f"wrote {DOCS / 'banner.png'}")


if __name__ == "__main__":
    main()