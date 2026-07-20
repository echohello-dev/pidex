"""Build the README banner background using the pidex design system.

The background mirrors the app's own chrome (tokens.css base.css body
background): bg-canvas field with the blueprint grid (96px minor +
480px major, blue-tinted) and a vertical gradient into bg-deep. Shapes
are strictly rectilinear; no organic imagery. The real app screenshot
and the composable logo are laid on top of this background.

Output:
  docs/assets/banner-bg.png  (1600x900)

Compose the final banner with:
  magick docs/assets/banner-bg.png \\
          docs/assets/screenshot.png -resize 1000x -geometry +300+80 -composite \\
          assets/logo.png -resize 200x -geometry +70+70 -composite \\
          docs/assets/banner.png
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "docs" / "assets"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _design import BG_DEEP, BG_CANVAS  # noqa: E402

W, H = 1600, 900


def svg() -> str:
    # Blueprint grid matches tokens.css (96px minor + 480px major, blue
    # tint). At hero scale the token opacities would be invisible, so
    # they're lifted slightly while keeping the same hue.
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <linearGradient id="vert" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{BG_DEEP}" stop-opacity="0"/>
      <stop offset="1" stop-color="{BG_DEEP}" stop-opacity="0.85"/>
    </linearGradient>
    <pattern id="grid_minor" width="96" height="96" patternUnits="userSpaceOnUse">
      <path d="M 96 0 L 0 0 0 96" fill="none" stroke="#8aa9d4" stroke-opacity="0.18" stroke-width="1"/>
    </pattern>
    <pattern id="grid_major" width="480" height="480" patternUnits="userSpaceOnUse">
      <path d="M 480 0 L 0 0 0 480" fill="none" stroke="#8aa9d4" stroke-opacity="0.32" stroke-width="1.75"/>
    </pattern>
  </defs>

  <!-- base canvas -->
  <rect x="0" y="0" width="{W}" height="{H}" fill="{BG_CANVAS}"/>

  <!-- blueprint grid -->
  <rect x="0" y="0" width="{W}" height="{H}" fill="url(#grid_minor)"/>
  <rect x="0" y="0" width="{W}" height="{H}" fill="url(#grid_major)"/>

  <!-- vertical gradient into bg-deep (anchors the bottom) -->
  <rect x="0" y="0" width="{W}" height="{H}" fill="url(#vert)"/>
</svg>
"""


def render_png(svg: Path, png: Path, width: int) -> None:
    if not shutil.which("inkscape"):
        sys.exit("inkscape not found on PATH; install via brew install inkscape")
    subprocess.run(
        ["inkscape", str(svg), "--export-type=png", "--export-filename", str(png), "--export-width", str(width)],
        check=True,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    svg_path = OUT / "banner-bg.svg"
    png_path = OUT / "banner-bg.png"
    svg_path.write_text(svg())
    render_png(svg_path, png_path, W)
    print(f"wrote {svg_path}")
    print(f"wrote {png_path}")


if __name__ == "__main__":
    main()