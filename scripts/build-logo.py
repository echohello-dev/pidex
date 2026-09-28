"""Build the pidex emblem: the Pi logo painted on an isometric cube.

The Pi coding-agent mark (the block P and its square dot) is mapped onto
the top face. Variants are recolors and lockups of that same drawing.

Outputs:
  assets/mark.svg            emblem, design-system surfaces
  assets/mark-mono.svg       single-colour emblem
  assets/mark-inverse.svg    light-ground emblem
  assets/logo.svg            horizontal lockup
  assets/logo-stacked.svg    stacked lockup
  assets/icon.svg            squircle app icon
  assets/icon.png            rasterised icon for electron-builder
  src/renderer/components/PidexMark.tsx
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
FONT = REPO / "src/renderer/assets/fonts/Newsreader-Variable.woff2"
MARK_TSX = REPO / "src/renderer/components/PidexMark.tsx"

# Faces sit above both dark grounds (deep #0d1116 and canvas #161d27).
# A light rim holds the silhouette; a dark keyline disappears into the page.
TOP = "#2a3b50"
RIGHT = "#3d536b"
LEFT = "#1c2838"
EDGE = "#6e849c"
INK = "#ebe7e4"
ICON_BG = "#0d1116"

# Isometric cube. Edge 48, top-face centre (60, 40).
E = 48.0
DX = E * 0.8660254037844386
DY = E * 0.5
CX, CY = 60.0, 40.0

# Pi logo paths (pi.dev, 800 viewBox). Content box is 165.29..634.72.
P_D = (
    "M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z "
    "M282.65 282.65 V400 H400 V282.65 Z"
)
I_DOT_D = "M517.36 400 H634.72 V634.72 H517.36 Z"
PI_SPAN = 634.72 - 165.29

WORD = "pidex"
WORD_SIZE = 46.0
WORD_WEIGHT = 560.0
WORD_OPSZ = 48.0
WORD_GAP = 22.0

ICON_SIZE = 1024
ICON_RADIUS = 229


def face_xy(p: float, q: float) -> tuple[float, float]:
    return (CX + q * DX, (CY - DY) + p * DY)


def poly(points: list[tuple[float, float]]) -> str:
    body = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    return f'<polygon points="{body}"'


class Palette:
    def __init__(self, top: str, right: str, left: str, edge: str, pi: str, stroke_width: float = 1.5):
        self.top = top
        self.right = right
        self.left = left
        self.edge = edge
        self.pi = pi
        self.stroke_width = stroke_width


PRIMARY = Palette(TOP, RIGHT, LEFT, EDGE, INK)
# The icon plate is the same ink as the shadow face, so the cube
# needs its own steps or the left plane disappears into the squircle.
ICON = Palette(TOP, RIGHT, LEFT, EDGE, INK, 1.25)
MONO = Palette("none", "none", "none", INK, INK, 1.75)
INVERSE = Palette("#f4ece6", "#e7ddd4", "#d5c9bf", "#b7a99e", "#0d1116")


def pi_transform() -> str:
    # Map the 470-unit Pi content square onto the top-face rhombus.
    a = DX / PI_SPAN
    b = DY / PI_SPAN
    return f"matrix({a:.8f} {b:.8f} {-a:.8f} {b:.8f} {CX:.2f} 0)"


def cube_markup(palette: Palette = PRIMARY, clip_id: str = "pi-face") -> str:
    top = [face_xy(0, 0), face_xy(1, 1), face_xy(2, 0), face_xy(1, -1)]
    right = [face_xy(1, 1), face_xy(2, 0), (CX, CY + DY + E), (CX + DX, CY + E)]
    left = [face_xy(1, -1), face_xy(2, 0), (CX, CY + DY + E), (CX - DX, CY + E)]
    edge = (
        f'stroke="{palette.edge}" stroke-width="{palette.stroke_width}" '
        'stroke-linejoin="round"'
    )

    def face(points: list[tuple[float, float]], fill: str) -> str:
        return f'{poly(points)} fill="{fill}" {edge}/>'

    top_points = " ".join(f"{x:.2f},{y:.2f}" for x, y in top)
    return "\n".join(
        [
            "  <defs>",
            f'    <clipPath id="{clip_id}">',
            f'      <polygon points="{top_points}"/>',
            "    </clipPath>",
            "  </defs>",
            f"  {face(left, palette.left)}",
            f"  {face(right, palette.right)}",
            f"  {face(top, palette.top)}",
            f'  <g clip-path="url(#{clip_id})">',
            f'    <g transform="{pi_transform()}">',
            f'      <path fill="{palette.pi}" fill-rule="evenodd" d="{P_D}"/>',
            f'      <path fill="{palette.pi}" d="{I_DOT_D}"/>',
            "    </g>",
            "  </g>",
        ]
    )


def wordmark_markup(origin_x: float) -> tuple[str, tuple[float, float, float, float]]:
    """Outline WORD in Newsreader. Returns SVG and the ink box in lockup space."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.varLib.instancer import instantiateVariableFont
    import uharfbuzz as hb

    variable = TTFont(FONT)
    variable.flavor = None
    tmp = ASSETS / ".newsreader-wordmark.ttf"
    variable.save(tmp)
    static = instantiateVariableFont(variable, {"wght": WORD_WEIGHT, "opsz": WORD_OPSZ})

    blob = hb.Blob.from_file_path(str(tmp))
    face = hb.Face(blob)
    font = hb.Font(face)
    upem = face.upem
    font.scale = (upem, upem)
    font.set_variations({"wght": WORD_WEIGHT, "opsz": WORD_OPSZ})
    buf = hb.Buffer()
    buf.add_str(WORD)
    buf.guess_segment_properties()
    hb.shape(font, buf)

    scale = WORD_SIZE / upem
    glyphset = static.getGlyphSet()
    order = static.getGlyphOrder()
    paths: list[str] = []
    cursor = 0.0
    ink: list[tuple[float, float]] = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(glyphset)
        glyphset[name].draw(pen)
        commands = pen.getCommands()
        gx = origin_x + (cursor + pos.x_offset) * scale
        gy = pos.y_offset * scale
        if commands:
            paths.append(f'<path d="{commands}" transform="translate({gx:.2f} {gy:.2f}) scale({scale:.6f} {-scale:.6f})"/>')
            glyph = static["glyf"][name]
            if glyph.numberOfContours != 0:
                x0 = gx + glyph.xMin * scale
                x1 = gx + glyph.xMax * scale
                y0 = gy - glyph.yMax * scale
                y1 = gy - glyph.yMin * scale
                ink.extend([(x0, y0), (x1, y1)])
        cursor += pos.x_advance
    tmp.unlink(missing_ok=True)

    xs = [p[0] for p in ink]
    ys = [p[1] for p in ink]
    box = (min(xs), min(ys), max(xs), max(ys))
    body = "\n".join(f"  {path}" for path in paths)
    return body, box


def shift_wordmark(markup: str, dx: float, dy: float) -> str:
    # Baseline is applied as a group so the per-glyph transforms stay put.
    return f'<g transform="translate({dx:.2f} {dy:.2f})" fill="{INK}">\n{markup}\n</g>'


def build_lockup_from(raw: str, box: tuple[float, float, float, float]) -> str:
    cube_right = CX + DX
    cube_top = CY - DY
    cube_bottom = CY + DY + E
    cube_mid = (cube_top + cube_bottom) / 2
    ink_w = box[2] - box[0]
    ink_mid = (box[1] + box[3]) / 2
    dx = cube_right + WORD_GAP - box[0]
    dy = cube_mid - ink_mid
    word = shift_wordmark(raw, dx, dy)
    pad = 8
    min_x = (CX - DX) - pad
    min_y = cube_top - pad
    max_x = cube_right + WORD_GAP + ink_w + pad
    max_y = cube_bottom + pad
    return svg_wrap(
        f"{cube_markup(PRIMARY, 'pi-face-lockup')}\n{word}",
        f"{min_x:.2f} {min_y:.2f} {max_x - min_x:.2f} {max_y - min_y:.2f}",
    )


def emblem_viewbox() -> str:
    """Square frame around the cube so the mark does not stretch."""
    side = 112.0
    return f"{CX - side / 2:.2f} {(CY + E / 2) - side / 2:.2f} {side:.2f} {side:.2f}"


def svg_wrap(inner: str, view: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">\n{inner}\n</svg>\n'


def build_mark_svg(palette: Palette = PRIMARY, clip_id: str = "pi-face") -> str:
    return svg_wrap(cube_markup(palette, clip_id), emblem_viewbox())


def build_stacked(word: str, box: tuple[float, float, float, float]) -> str:
    cube_bottom = CY + DY + E
    cube_left = CX - DX
    cube_right = CX + DX
    ink_w = box[2] - box[0]
    dx = CX - (box[0] + box[2]) / 2
    dy = cube_bottom + 18 - box[1]
    pad = 8
    min_x = min(cube_left, box[0] + dx) - pad
    max_x = max(cube_right, box[2] + dx) + pad
    min_y = (CY - DY) - pad
    max_y = box[3] + dy + pad
    return svg_wrap(
        f"{cube_markup(PRIMARY, 'pi-face-stacked')}\n{shift_wordmark(word, dx, dy)}",
        f"{min_x:.2f} {min_y:.2f} {max_x - min_x:.2f} {max_y - min_y:.2f}",
    )


def build_icon_svg() -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ICON_SIZE} {ICON_SIZE}">\n'
        f'  <rect width="{ICON_SIZE}" height="{ICON_SIZE}" rx="{ICON_RADIUS}" fill="{ICON_BG}"/>\n'
        f'  <g transform="translate(512 500) scale(7.4) translate(-60 -64)">\n'
        f"{cube_markup(ICON, 'pi-face-icon')}\n"
        f"  </g>\n"
        "</svg>\n"
    )


def build_mark_tsx() -> str:
    inner = cube_markup(PRIMARY, "pi-face")
    indented = "\n".join(f"      {line}" if line else "" for line in inner.splitlines())
    return f"""// Generated by scripts/build-logo.py. Do not edit by hand.

type PidexMarkProps = {{
  size?: number;
  className?: string;
}};

function PidexMark({{ size = 40, className }}: PidexMarkProps) {{
  return (
    <svg
      className={{className}}
      width={{size}}
      height={{size}}
      viewBox="{emblem_viewbox()}"
      aria-hidden="true"
      focusable="false"
    >
{indented}
    </svg>
  );
}}

export {{ PidexMark }};
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
    marks = {
        "mark.svg": build_mark_svg(PRIMARY, "pi-face"),
        "mark-mono.svg": build_mark_svg(MONO, "pi-face-mono"),
        "mark-inverse.svg": build_mark_svg(INVERSE, "pi-face-inverse"),
    }
    for name, svg in marks.items():
        (ASSETS / name).write_text(svg)
        print(f"wrote {ASSETS / name}")

    raw, box = wordmark_markup(0)
    logo = ASSETS / "logo.svg"
    logo.write_text(build_lockup_from(raw, box))
    render_png(logo, ASSETS / "logo.png", 1200)
    stacked = ASSETS / "logo-stacked.svg"
    stacked.write_text(build_stacked(raw, box))
    print(f"wrote {logo}")
    print(f"wrote {stacked}")

    icon = ASSETS / "icon.svg"
    icon.write_text(build_icon_svg())
    render_png(icon, ASSETS / "icon.png", ICON_SIZE)
    print(f"wrote {icon}")
    MARK_TSX.write_text(build_mark_tsx())
    print(f"wrote {MARK_TSX}")


if __name__ == "__main__":
    main()
