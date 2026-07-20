"""Build the pidex logo as a composable horizontal lockup SVG.

The mark is an isometric cube in the design system's cool/neutral
surfaces (bg-canvas, panel, bg-deep) with the Pi coding agent's logo
(P + i dot) painted on its top face, and the "pidex" wordmark to
the right.

Outputs:
  assets/logo.svg   - horizontal lockup, transparent (composable)
  assets/logo.png   - rasterized lockup at 800x400 for quick embedding
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
SCRIPTS = Path(__file__).resolve().parent

sys.path.insert(0, str(SCRIPTS))
from _design import (  # noqa: E402
    INK_BRONZE,
    BG_DEEP,
    BG_CANVAS,
    PANEL,
    PARCHMENT,
)

# Logo canvas
W, H = 240, 120

# Isometric cube (edge 48), top face centered around (60, 40)
E = 48
DX = E * 0.866  # 41.57
DY = E * 0.5    # 24
CX, CY = 60, 40
TOP_X, TOP_Y    = CX, CY - DY          # (60, 16)
RIGHT_X, RIGHT_Y = CX + DX, CY        # (101.57, 40)
BOT_X, BOT_Y   = CX, CY + DY           # (60, 64)
LEFT_X, LEFT_Y  = CX - DX, CY          # (18.43, 40)

# Pi coding agent logo paths (from pi.dev/pi-logo.svg, 800x800 viewBox).
# Content bbox: x,y ∈ [165.29, 634.72] (470x470 region inside the 800x800).
P_D = (
    "M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z "
    "M282.65 282.65 V400 H400 V282.65 Z"
)
I_DOT_D = "M517.36 400 H634.72 V634.72 H517.36 Z"

# Affine transform mapping the Pi logo content (165..635, 165..635) onto
# the top-face rhombus. The rhombus is a parallelogram with half-width DX
# and half-height DY (measured from the top-center). The content is a
# 470x470 square. The affine matrix has a = DX/470, b = DY/470,
# c = -a, d = b, and translates so the content center maps to the rhombus
# top-center.
A = DX / 470.0
B = DY / 470.0
PI_TRANSFORM = f"matrix({A} {B} {-A} {B} 60 0)"

# Wordmark
TEXT = "pidex"
TEXT_X = 120
TEXT_Y = 76
TEXT_SIZE = 32
TEXT_FONT = "Georgia, 'Plantin MT Pro', 'Plantin MT Std', serif"
TEXT_WEIGHT = 500


def build_logo_svg() -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <!-- ISOMETRIC CUBE: cool/neutral design system surfaces. -->
  <!-- top face (lit, bg-canvas) -->
  <polygon points="{TOP_X},{TOP_Y} {RIGHT_X},{RIGHT_Y} {BOT_X},{BOT_Y} {LEFT_X},{LEFT_Y}" fill="{BG_CANVAS}" stroke="{INK_BRONZE}" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- right face (mid, panel) -->
  <polygon points="{RIGHT_X},{RIGHT_Y} {BOT_X},{BOT_Y} {BOT_X},{BOT_Y + E} {RIGHT_X},{RIGHT_Y + E}" fill="{PANEL}" stroke="{INK_BRONZE}" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- left face (shadow, bg-deep) -->
  <polygon points="{LEFT_X},{LEFT_Y} {BOT_X},{BOT_Y} {BOT_X},{BOT_Y + E} {LEFT_X},{LEFT_Y + E}" fill="{BG_DEEP}" stroke="{INK_BRONZE}" stroke-width="1.5" stroke-linejoin="round"/>

  <!-- Pi coding agent logo painted on the top face (sheared onto the isometric top) -->
  <g transform="{PI_TRANSFORM}">
    <path fill="{PARCHMENT}" fill-rule="evenodd" d="{P_D}"/>
    <path fill="{PARCHMENT}" d="{I_DOT_D}"/>
  </g>

  <!-- WORDMARK -->
  <text x="{TEXT_X}" y="{TEXT_Y}" font-family="{TEXT_FONT}" font-size="{TEXT_SIZE}" font-weight="{TEXT_WEIGHT}" fill="{PARCHMENT}" letter-spacing="-0.5">pidex</text>
</svg>
"""


def render_png(svg: Path, png: Path, width: int) -> None:
    if not shutil.which("inkscape"):
        sys.exit("inkscape not found on PATH; install via brew install inkscape")
    subprocess.run(
        [
            "inkscape",
            str(svg),
            "--export-type=png",
            "--export-filename",
            str(png),
            "--export-width",
            str(width),
        ],
        check=True,
    )


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    svg_path = ASSETS / "logo.svg"
    png_path = ASSETS / "logo.png"
    svg_path.write_text(build_logo_svg())
    render_png(svg_path, png_path, 800)
    print(f"wrote {svg_path}")
    print(f"wrote {png_path}")


if __name__ == "__main__":
    main()