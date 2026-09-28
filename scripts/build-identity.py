"""Extra pidex marks, lockups, and the desk mascot.

The cube emblem stays the primary mark. These are the other ways it is drawn:
a plate, a stencil, a blueprint, a seal, two ink styles, type lockups, and
the mascot (the cube, with the square dot standing beside it).

Outputs live in assets/ and are not the files build-logo.py owns.
"""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
DEPARTURE = REPO / "src/renderer/assets/fonts/DepartureMono-Regular.woff2"

spec = importlib.util.spec_from_file_location("build_logo", REPO / "scripts/build-logo.py")
logo = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(logo)

INK = logo.INK
EDGE = logo.EDGE
ACCENT = "#6a9fcc"
DEEP = "#0d1116"
WARM = "#e1b06e"
WARM_INK = "#13110f"


def svg(inner: str, view: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">\n{inner}\n</svg>\n'


def write(name: str, body: str) -> None:
    path = ASSETS / name
    path.write_text(body)
    print(f"wrote {path}")


def pi_group(x: float, y: float, size: float, fill: str) -> str:
    scale = size / logo.PI_SPAN
    return (
        f'<g transform="translate({x:.2f} {y:.2f}) scale({scale:.6f}) translate({-165.29:.2f} {-165.29:.2f})" '
        f'fill="{fill}">\n'
        f'  <path fill-rule="evenodd" d="{logo.P_D}"/>\n'
        f'  <path d="{logo.I_DOT_D}"/>\n'
        "</g>"
    )


def plate() -> str:
    return svg(
        "\n".join(
            [
                f'<rect x="8" y="8" width="144" height="144" fill="none" stroke="{EDGE}" stroke-width="1.5"/>',
                pi_group(22, 22, 116, INK),
            ]
        ),
        "0 0 160 160",
    )


def stencil() -> str:
    scale = 116 / logo.PI_SPAN
    return svg(
        "\n".join(
            [
                "<defs>",
                '  <mask id="plate" maskUnits="userSpaceOnUse">',
                '    <rect x="8" y="8" width="144" height="144" fill="#fff"/>',
                f'    <g transform="translate(22 22) scale({scale:.6f}) translate(-165.29 -165.29)" fill="#000">',
                f'      <path fill-rule="evenodd" d="{logo.P_D}"/>',
                f'      <path d="{logo.I_DOT_D}"/>',
                "    </g>",
                "  </mask>",
                "</defs>",
                '<rect x="8" y="8" width="144" height="144" fill="#ebe7e4" mask="url(#plate)"/>',
            ]
        ),
        "0 0 160 160",
    )


def blueprint() -> str:
    lines = []
    for i in range(0, 161, 8):
        major = i % 40 == 0
        opacity = "0.55" if major else "0.16"
        lines.append(
            f'<path d="M{i} 0 V160 M0 {i} H160" stroke="{ACCENT}" stroke-opacity="{opacity}" stroke-width="0.6"/>'
        )
    corners = []
    for x, y, sx, sy in ((10, 10, 1, 1), (150, 10, -1, 1), (10, 150, 1, -1), (150, 150, -1, -1)):
        corners.append(
            f'<path d="M{x} {y + sy * 14} V{y} H{x + sx * 14}" fill="none" stroke="{INK}" stroke-width="1.25"/>'
        )
    cube = logo.cube_markup(logo.MONO, "pi-face-blueprint")
    return svg(
        "\n".join(
            [
                *lines,
                *corners,
                '<g transform="translate(24 28) scale(0.96)">',
                cube,
                "</g>",
            ]
        ),
        "0 0 160 160",
    )


def outline_glyphs(font_path: Path, text: str, size: float) -> list[tuple[str, float]]:
    font = TTFont(font_path)
    font.flavor = None
    glyphset = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = font["head"].unitsPerEm
    scale = size / upem
    hmtx = font["hmtx"]
    runs: list[tuple[str, float]] = []
    for char in text:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphset)
        glyphset[name].draw(pen)
        advance, _ = hmtx[name]
        runs.append((pen.getCommands(), advance * scale))
    return runs


def seal_with_upem(upem: int) -> str:
    ticks = []
    for i in range(72):
        angle = math.radians(i * 5 - 90)
        inner = 64 if i % 6 else 58
        outer = 72
        x0, y0 = 90 + inner * math.cos(angle), 90 + inner * math.sin(angle)
        x1, y1 = 90 + outer * math.cos(angle), 90 + outer * math.sin(angle)
        ticks.append(
            f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}" stroke="{EDGE}" stroke-width="0.9"/>'
        )
    size = 13.0
    letters = outline_glyphs(DEPARTURE, "PIDEX", size)
    gap = size * 0.42
    width = sum(advance for _, advance in letters) + gap * (len(letters) - 1)
    radius = 52
    cursor = -width / 2
    glyphs = []
    scale = size / upem
    for commands, advance in letters:
        mid = cursor + advance / 2
        theta = mid / radius
        x = 90 + radius * math.sin(theta)
        y = 90 - radius * math.cos(theta)
        deg = math.degrees(theta)
        if commands:
            glyphs.append(
                f'<path d="{commands}" fill="{INK}" '
                f'transform="translate({x:.2f} {y:.2f}) rotate({deg:.2f}) scale({scale:.6f} {-scale:.6f})"/>'
            )
        cursor += advance + gap
    cube = logo.cube_markup(logo.PRIMARY, "pi-face-seal")
    return svg(
        "\n".join(
            [
                f'<circle cx="90" cy="90" r="84" fill="none" stroke="{INK}" stroke-width="1.5"/>',
                f'<circle cx="90" cy="90" r="76" fill="none" stroke="{EDGE}" stroke-width="0.75"/>',
                *ticks,
                *glyphs,
                '<g transform="translate(90 108) scale(0.62) translate(-60 -64)">',
                cube,
                "</g>",
            ]
        ),
        "0 0 180 180",
    )


def wordmark() -> str:
    raw, box = logo.wordmark_markup(0)
    pad = 2
    view = f"{box[0] - pad:.2f} {box[1] - pad:.2f} {box[2] - box[0] + pad * 2:.2f} {box[3] - box[1] + pad * 2:.2f}"
    return svg(logo.shift_wordmark(raw, 0, 0), view)


def editorial() -> str:
    raw, box = logo.wordmark_markup(0)
    word_h = box[3] - box[1]
    pi = word_h * 1.05
    gap = 16
    dx = pi + gap - box[0]
    dy = -box[1]
    pad = 2
    width = pi + gap + (box[2] - box[0]) + pad * 2
    height = max(pi, word_h) + pad * 2
    return svg(
        "\n".join(
            [
                pi_group(pad, pad + (height - pad * 2 - pi) / 2, pi, INK),
                logo.shift_wordmark(raw, dx + pad, dy + pad),
            ]
        ),
        f"0 0 {width:.2f} {height:.2f}",
    )


def label_lockup(upem: int) -> str:
    size = 18.0
    letters = outline_glyphs(DEPARTURE, "PIDEX", size)
    gap = size * 0.22
    width = sum(advance for _, advance in letters)
    tracked = width + gap * (len(letters) - 1)
    scale = size / upem
    cursor = 0.0
    glyphs = []
    for commands, advance in letters:
        if commands:
            glyphs.append(
                f'<path d="{commands}" transform="translate({cursor:.2f} 0) scale({scale:.6f} {-scale:.6f})"/>'
            )
        cursor += advance + gap
    cube_bottom = logo.CY + logo.DY + logo.E
    cube_top = logo.CY - logo.DY
    cube_right = logo.CX + logo.DX
    cube_h = cube_bottom - cube_top
    # Departure sits on the baseline. Cap height is roughly 0.7 of the em.
    text_h = size * 0.72
    text_y = cube_top + (cube_h + text_h) / 2
    text_x = cube_right + 18
    pad = 8
    view_w = text_x + tracked + pad - (logo.CX - logo.DX - pad)
    view_h = cube_h + pad * 2
    return svg(
        "\n".join(
            [
                logo.cube_markup(logo.PRIMARY, "pi-face-label"),
                f'<g fill="{INK}" transform="translate({text_x:.2f} {text_y:.2f})">',
                *glyphs,
                "</g>",
            ]
        ),
        f"{logo.CX - logo.DX - pad:.2f} {cube_top - pad:.2f} {view_w:.2f} {view_h:.2f}",
    )


def iso_cube(cx: float, cy: float, e: float, top: str, right: str, left: str, edge: str) -> tuple[str, tuple[float, float, float, float]]:
    dx = e * 0.8660254037844386
    dy = e * 0.5

    def xy(p: float, q: float) -> tuple[float, float]:
        return (cx + q * dx, (cy - dy) + p * dy)

    top_pts = [xy(0, 0), xy(1, 1), xy(2, 0), xy(1, -1)]
    right_pts = [xy(1, 1), xy(2, 0), (cx, cy + dy + e), (cx + dx, cy + e)]
    left_pts = [xy(1, -1), xy(2, 0), (cx, cy + dy + e), (cx - dx, cy + e)]

    def poly(points: list[tuple[float, float]], fill: str) -> str:
        body = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
        return (
            f'<polygon points="{body}" fill="{fill}" stroke="{edge}" '
            f'stroke-width="1.6" stroke-linejoin="round"/>'
        )

    markup = "\n".join([poly(left_pts, left), poly(right_pts, right), poly(top_pts, top)])
    bounds = (cx - dx, cy - dy, cx + dx, cy + dy + e)
    return markup, bounds


def diamond(cx: float, cy: float, e: float, scale: float) -> list[tuple[float, float]]:
    dx = e * 0.8660254037844386
    dy = e * 0.5

    def xy(p: float, q: float) -> tuple[float, float]:
        return (cx + q * dx, (cy - dy) + p * dy)

    corners = [(0, 0), (1, 1), (2, 0), (1, -1)]
    return [xy(1 + (p - 1) * scale, q * scale) for p, q in corners]


def mascot() -> str:
    body, _ = iso_cube(78, 78, 78, logo.TOP, logo.RIGHT, logo.LEFT, EDGE)
    dx = 78 * 0.8660254037844386
    dy = 78 * 0.5
    # Back tip of the top face is (cx, cy - dy). The Pi's top-left lands there.
    b = dy / logo.PI_SPAN
    ty = (78 - dy) - 2 * b * 165.29
    pi_scale_matrix = (
        f"matrix({dx / logo.PI_SPAN:.8f} {b:.8f} {-dx / logo.PI_SPAN:.8f} {b:.8f} 78.00 {ty:.2f})"
    )
    dot_cube, _ = iso_cube(168, 118, 36, logo.TOP, logo.RIGHT, logo.LEFT, EDGE)
    dot = diamond(168, 118, 36, 0.5)
    dot_pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in dot)
    left_foot, _ = iso_cube(52, 168, 20, "#243246", "#31475c", "#1a2432", EDGE)
    right_foot, _ = iso_cube(104, 168, 20, "#243246", "#31475c", "#1a2432", EDGE)
    return svg(
        "\n".join(
            [
                '<ellipse cx="112" cy="214" rx="96" ry="9" fill="#000" opacity="0.38"/>',
                left_foot,
                right_foot,
                body,
                "<defs>",
                '  <clipPath id="mascot-face">',
                f'    <polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in diamond(78, 78, 78, 1))}"/>',
                "  </clipPath>",
                "</defs>",
                '<g clip-path="url(#mascot-face)">',
                f'  <g transform="{pi_scale_matrix}" fill="{INK}">',
                f'    <path fill-rule="evenodd" d="{logo.P_D}"/>',
                f'    <path d="{logo.I_DOT_D}"/>',
                "  </g>",
                "</g>",
                dot_cube,
                f'<polygon points="{dot_pts}" fill="{INK}"/>',
            ]
        ),
        "0 0 230 230",
    )


def main() -> None:
    font = TTFont(DEPARTURE)
    upem = font["head"].unitsPerEm
    write("mark-plate.svg", plate())
    write("mark-stencil.svg", stencil())
    write("mark-blueprint.svg", blueprint())
    write("mark-seal.svg", seal_with_upem(upem))
    write("mark-accent.svg", logo.build_mark_svg(logo.Palette("#6a9fcc", "#4b607c", "#2c4058", "#d5e4f2", DEEP), "pi-face-accent"))
    write(
        "mark-warm.svg",
        logo.build_mark_svg(logo.Palette(WARM, "#a56a42", "#6e4632", "#f4e4cf", WARM_INK), "pi-face-warm"),
    )
    write("logo-wordmark.svg", wordmark())
    write("logo-editorial.svg", editorial())
    write("logo-label.svg", label_lockup(upem))
    write("mascot.svg", mascot())


if __name__ == "__main__":
    main()
