"""Design tokens for pidex, sourced from the Pi coding agent website
(pi.dev/style.css) so the workbench visually aligns with the Pi runtime
it drives.

Provenance: https://pi.dev/style.css, lines ~85-130 (the `:root` token
block). Update these hexes if pi.dev revs its palette.

Token groups:
  - Warm darks (window bg, panel surfaces)
  - Creams (text, marks, lit facet)
  - Terracotta / sunkissed (warm accents, the fluid-crest peak)
  - Sage / accent-blue (secondary accents)
"""

from __future__ import annotations

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

# --- Warm darks ---
# pi.dev: --color-warm-black
WARM_BLACK = "#13110f"
# pi.dev: --panel-base
PANEL = "#212730"
# pi.dev: --panel-soft-base
PANEL_SOFT = "#252f3d"
# pi.dev: --bg-deep, --bg-canvas
BG_DEEP = "#0d1116"
BG_CANVAS = "#161d27"

# --- Creams ---
# pi.dev: --color-parchment  (the named "cream")
PARCHMENT = "#dacbc2"
# pi.dev: --color-moonstone  (lighter cream / near-white)
MOONSTONE = "#ebe7e4"
# pi.dev: --color-driftwood  (warm mid-gray, shadow tone)
DRIFTWOOD = "#5c5752"

# --- Warm accents (the fluid bronze / terracotta aesthetic) ---
# pi.dev: --color-terracotta
TERRACOTTA = "#844f3b"
# pi.dev: --color-terracotta-light
TERRACOTTA_LIGHT = "#b86b52"
# pi.dev: --color-sunkissed
SUNKISSED = "#e1b06e"

# --- Secondary accents ---
# pi.dev: --color-sage
SAGE = "#a3a473"
# pi.dev: --color-accent-blue / --accent
ACCENT_BLUE = "#6a9fcc"
# pi.dev: --color-tidal-blue / --thread-blue
TIDAL_BLUE = "#4b607c"

# --- Text ---
# pi.dev: --text
TEXT = "#ebe7e4"
# pi.dev: --muted
MUTED = "#9fa4ab"

DEFAULT_FONT = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"


def pi_path(font_path: str = DEFAULT_FONT) -> tuple[str, tuple[int, int, int, int], int]:
    """Return (svg_path_d, bbox, unitsPerEm) for the π glyph (U+03C0)."""
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    gname = cmap[ord("π")]
    pen = SVGPathPen(font.getGlyphSet())
    font.getGlyphSet()[gname].draw(pen)
    glyf = font["glyf"][gname]
    bbox = (glyf.xMin, glyf.yMin, glyf.xMax, glyf.yMax)
    return pen.getCommands(), bbox, font["head"].unitsPerEm