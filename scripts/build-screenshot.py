"""Build a faithful pidex dashboard mockup SVG (and PNG) using the Pi
(pi.dev) design tokens. Layout mirrors what the renderer ships: warm-black
window with a panel-toned workspace sidebar on the left, session pane on
the right, input pill at the bottom. Apple-style soft drop shadow under
the window.

Output:
  docs/assets/screenshot.svg
  docs/assets/screenshot.png  (1440x900)
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "docs" / "assets"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _design import (  # noqa: E402
    WARM_BLACK,
    PANEL,
    PANEL_SOFT,
    PARCHMENT,
    MOONSTONE,
    TERRACOTTA_LIGHT,
    pi_path,
)

# Canvas
W, H = 1440, 900

# Window geometry (centered)
WW, WH = 1200, 760
WX = (W - WW) // 2
WY = (H - WH) // 2
WIN_R = 14

# Sidebar
SIDE_W = 300
SIDE_BG = PANEL
SIDE_PAD = 22

# Warm neutral ground that complements the warm-black window
BG = "#E2D8CC"


def svg() -> str:
    d, bbox, _ = pi_path()
    gx = (bbox[0] + bbox[2]) / 2
    gy = (bbox[1] + bbox[3]) / 2

    # Sidebar π mark + pidex wordmark
    mark_cx = WX + 36
    mark_cy = WY + 44
    mark_scale = 0.036  # ~37px tall
    mark_transform = (
        f"translate({mark_cx} {mark_cy}) "
        f"scale({mark_scale} -{mark_scale}) "
        f"translate({-gx} {-gy})"
    )

    # Workspace cards
    cards = []
    card_y = WY + 100
    for i in range(4):
        cy = card_y + i * 72
        cards.append(
            f'<rect x="{WX + SIDE_PAD}" y="{cy}" width="{SIDE_W - SIDE_PAD * 2}" height="56" rx="10" fill="{PANEL_SOFT}" opacity="0.55"/>'
            f'<rect x="{WX + SIDE_PAD + 16}" y="{cy + 14}" width="14" height="14" rx="3" fill="{PARCHMENT}" opacity="0.35"/>'
            f'<rect x="{WX + SIDE_PAD + 40}" y="{cy + 16}" width="{130 + i * 20}" height="9" rx="3" fill="{PARCHMENT}" opacity="0.78"/>'
            f'<rect x="{WX + SIDE_PAD + 40}" y="{cy + 33}" width="{70 + i * 14}" height="7" rx="3" fill="{PARCHMENT}" opacity="0.40"/>'
            f'<circle cx="{WX + SIDE_W - SIDE_PAD - 14}" cy="{cy + 28}" r="3" fill="{PARCHMENT}" opacity="0.55"/>'
        )

    pane_x = WX + SIDE_W
    pane_w = WW - SIDE_W
    header_y = WY + 22
    cards_y = WY + 110
    card_h = 132

    header = (
        f'<rect x="{pane_x + 30}" y="{header_y}" width="3" height="26" fill="{PARCHMENT}" opacity="0.55"/>'
        f'<rect x="{pane_x + 44}" y="{header_y + 4}" width="170" height="10" rx="3" fill="{PARCHMENT}" opacity="0.78"/>'
        f'<rect x="{pane_x + 44}" y="{header_y + 18}" width="110" height="7" rx="3" fill="{PARCHMENT}" opacity="0.38"/>'
        f'<rect x="{pane_x + pane_w - 140}" y="{header_y + 3}" width="110" height="20" rx="10" fill="{PARCHMENT}" opacity="0.08"/>'
        f'<circle cx="{pane_x + pane_w - 124}" cy="{header_y + 13}" r="3" fill="{TERRACOTTA_LIGHT}" opacity="0.95"/>'
        f'<rect x="{pane_x + pane_w - 114}" y="{header_y + 9}" width="74" height="7" rx="3" fill="{PARCHMENT}" opacity="0.45"/>'
    )

    main_cards = []
    for i in range(2):
        cy = cards_y + i * (card_h + 18)
        main_cards.append(
            f'<rect x="{pane_x + 30}" y="{cy}" width="{pane_w - 60}" height="{card_h}" rx="10" fill="{PARCHMENT}" opacity="0.04"/>'
            f'<rect x="{pane_x + 30}" y="{cy}" width="3" height="{card_h}" rx="1.5" fill="{PARCHMENT}" opacity="0.35"/>'
            f'<rect x="{pane_x + 50}" y="{cy + 18}" width="{80 + i * 30}" height="10" rx="3" fill="{PARCHMENT}" opacity="0.78"/>'
            f'<rect x="{pane_x + 50}" y="{cy + 44}" width="{pane_w - 100}" height="8" rx="3" fill="{PARCHMENT}" opacity="0.30"/>'
            f'<rect x="{pane_x + 50}" y="{cy + 60}" width="{pane_w - 200}" height="8" rx="3" fill="{PARCHMENT}" opacity="0.22"/>'
            f'<rect x="{pane_x + 50}" y="{cy + 76}" width="{int((pane_w - 100) * 0.6)}" height="8" rx="3" fill="{PARCHMENT}" opacity="0.18"/>'
            f'<rect x="{pane_x + 50}" y="{cy + 92}" width="{int((pane_w - 100) * 0.4)}" height="8" rx="3" fill="{PARCHMENT}" opacity="0.14"/>'
        )

    pill_y = WY + WH - 64
    pill = (
        f'<rect x="{pane_x + 30}" y="{pill_y}" width="{pane_w - 60}" height="40" rx="20" fill="{PARCHMENT}" opacity="0.06"/>'
        f'<rect x="{pane_x + 50}" y="{pill_y + 14}" width="1.5" height="12" fill="{PARCHMENT}" opacity="0.8"/>'
        f'<rect x="{pane_x + pane_w - 70}" y="{pill_y + 8}" width="40" height="24" rx="12" fill="{PARCHMENT}" opacity="0.14"/>'
        f'<rect x="{pane_x + pane_w - 58}" y="{pill_y + 17}" width="16" height="6" rx="3" fill="{PARCHMENT}" opacity="0.7"/>'
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <filter id="ds" x="-10%" y="-10%" width="120%" height="125%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dx="0" dy="26" result="o"/>
      <feComponentTransfer in="o" result="o2">
        <feFuncA type="linear" slope="0.45"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="o2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect x="0" y="0" width="{W}" height="{H}" fill="{BG}"/>

  <g filter="url(#ds)">
    <rect x="{WX}" y="{WY}" width="{WW}" height="{WH}" rx="{WIN_R}" ry="{WIN_R}" fill="{WARM_BLACK}"/>
  </g>

  <!-- traffic lights -->
  <circle cx="{WX + 22}" cy="{WY + 22}" r="6" fill="#FF5F57"/>
  <circle cx="{WX + 42}" cy="{WY + 22}" r="6" fill="#FEBC2E"/>
  <circle cx="{WX + 62}" cy="{WY + 22}" r="6" fill="#28C840"/>

  <!-- sidebar -->
  <rect x="{WX}" y="{WY + 44}" width="{SIDE_W}" height="{WH - 44}" fill="{SIDE_BG}"/>
  <rect x="{WX + SIDE_W - 1}" y="{WY + 44}" width="1" height="{WH - 44}" fill="#000" opacity="0.35"/>

  <!-- sidebar mark + wordmark -->
  <g transform="{mark_transform}">
    <path d="{d}" fill="{PARCHMENT}"/>
  </g>
  <text x="{mark_cx + 30}" y="{mark_cy + 6}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" font-size="18" font-weight="600" fill="{PARCHMENT}" opacity="0.92">pidex</text>

  {''.join(cards)}

  {header}
  {''.join(main_cards)}
  {pill}
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
    svg_path = OUT / "screenshot.svg"
    png_path = OUT / "screenshot.png"
    svg_path.write_text(svg())
    render_png(svg_path, png_path, W)
    print(f"wrote {svg_path}")
    print(f"wrote {png_path}")


if __name__ == "__main__":
    main()