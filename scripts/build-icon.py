"""Build the pidex app icon and mark SVGs from Georgia Italic, using the
Pi (pi.dev) design tokens so the workbench visually aligns with the Pi
runtime.

Outputs:
  assets/icon.svg   - flat 2D app icon (warm-black rounded square + cream faceted pi)
  assets/mark.svg   - flat pi mark on transparent, for in-UI use
  assets/icon.png   - rasterized icon at 1024x1024 (for Electron build/icon.png)
  assets/mark.png   - rasterized mark at 1024x1024
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
    WARM_BLACK,
    PARCHMENT,
    MOONSTONE,
    pi_path,
)

# Icon geometry (1024x1024 canvas, macOS-style squircle radius ~22.37%).
ICON_SIZE = 1024
ICON_RADIUS = 229

# π placement: glyph centered, height ~56% of icon.
SCALE = 0.56

# Screen upper-left triangle (defined in glyph coords; the group transform flips Y).
LIT_CLIP = "-22,980 1295,980 -22,-19"


def build_icon_svg(d: str, bbox: tuple[int, int, int, int]) -> str:
    gx = (bbox[0] + bbox[2]) / 2
    gy = (bbox[1] + bbox[3]) / 2
    cx = cy = ICON_SIZE / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ICON_SIZE} {ICON_SIZE}" width="{ICON_SIZE}" height="{ICON_SIZE}">
  <defs>
    <clipPath id="lit">
      <polygon points="{LIT_CLIP}"/>
    </clipPath>
  </defs>
  <rect x="0" y="0" width="{ICON_SIZE}" height="{ICON_SIZE}" rx="{ICON_RADIUS}" ry="{ICON_RADIUS}" fill="{WARM_BLACK}"/>
  <g transform="translate({cx} {cy}) scale({SCALE} -{SCALE}) translate({-gx} {-gy})">
    <path d="{d}" fill="{PARCHMENT}"/>
    <path d="{d}" fill="{MOONSTONE}" clip-path="url(#lit)"/>
  </g>
</svg>
"""


def build_mark_svg(d: str, bbox: tuple[int, int, int, int]) -> str:
    gx = (bbox[0] + bbox[2]) / 2
    gy = (bbox[1] + bbox[3]) / 2
    size = ICON_SIZE
    cx = cy = size / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <g transform="translate({cx} {cy}) scale({SCALE} -{SCALE}) translate({-gx} {-gy})">
    <path d="{d}" fill="{WARM_BLACK}"/>
  </g>
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
    d, bbox, _ = pi_path()

    icon_svg = ASSETS / "icon.svg"
    mark_svg = ASSETS / "mark.svg"
    icon_svg.write_text(build_icon_svg(d, bbox))
    mark_svg.write_text(build_mark_svg(d, bbox))
    print(f"wrote {icon_svg}")
    print(f"wrote {mark_svg}")

    render_png(icon_svg, ASSETS / "icon.png", ICON_SIZE)
    render_png(mark_svg, ASSETS / "mark.png", ICON_SIZE)
    print(f"wrote {ASSETS / 'icon.png'}")
    print(f"wrote {ASSETS / 'mark.png'}")


if __name__ == "__main__":
    main()