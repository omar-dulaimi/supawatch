#!/usr/bin/env python3
"""supawatch visual identity: one source for every shipped asset.

Text is converted to outlines rather than referenced by family name.
A README image on GitHub loads no webfonts at all, so a <text> element
would silently fall back to whatever the viewer happens to have, which is
the classic way a banner ends up looking wrong for everyone but its author.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

# ---------------------------------------------------------------- palette
# Instrument ground with two accents at matched chroma and lightness:
# amber marks the signal (a schema change fired, output regenerated),
# cyan marks what has been proven against real rows.
INK = {
    "bg":      "#0B1114",
    "bg2":     "#121A1F",
    "rule":    "#1F2C33",
    "rule2":   "#2E3F48",
    "fg":      "#E3EAED",
    "mut":     "#8095A0",
    "dim":     "#5A6E78",
    "signal":  "#E39338",
    "trace":   "#46B2C4",
}
PAPER = {
    "bg":      "#F1F4F5",
    "bg2":     "#FFFFFF",
    "rule":    "#D6DEE1",
    "rule2":   "#B4C2C7",
    "fg":      "#0F171B",
    "mut":     "#56686F",
    "dim":     "#7C8E99",
    "signal":  "#A9631A",
    "trace":   "#1F7C8C",
}

import fonts as _fonts

_F = _fonts.ensure()
MONO600 = _F["PlexMono-600"]
MONO500 = _F["PlexMono-500"]
MONO400 = _F["PlexMono-400"]
SANS400 = _F["PlexSans-400"]
SANS600 = _F["PlexSans-600"]


class Face:
    """A TTF turned into SVG path data."""

    _cache = {}

    def __init__(self, path):
        self.font = TTFont(path)
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upem = self.font["head"].unitsPerEm

    @classmethod
    def get(cls, path):
        if path not in cls._cache:
            cls._cache[path] = cls(path)
        return cls._cache[path]

    def width(self, text, size, tracking=0.0):
        adv = 0
        for ch in text:
            g = self.cmap.get(ord(ch))
            if g is None:
                continue
            adv += self.gs[g].width
        return adv * size / self.upem + tracking * size * max(0, len(text) - 1)

    def paths(self, text, x, y, size, fill, tracking=0.0, opacity=None):
        """Outlined text. (x, y) is the left edge on the baseline."""
        s = size / self.upem
        out = []
        cx = x
        for ch in text:
            g = self.cmap.get(ord(ch))
            if g is None:
                cx += size * 0.6 + tracking * size
                continue
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(pen)
            d = pen.getCommands()
            if d:
                out.append(
                    f'<path d="{d}" fill="{fill}"'
                    + (f' opacity="{opacity}"' if opacity else "")
                    + f' transform="translate({cx:.2f},{y:.2f}) scale({s:.5f},{-s:.5f})"/>'
                )
            cx += self.gs[g].width * s + tracking * size
        return "".join(out), cx - x


# ------------------------------------------------------------------- mark
# Locked geometry, expressed as ratios of the 48-unit box so every size
# is the same drawing rather than a re-guess.
MARK = dict(box=48, arm=10, sw=5.5, off=9, h=24, gap=10)


def mark(x, y, size, fg, sig, mono=False):
    """Offset bracket pair. The left bracket is the schema going in, the
    right is what comes back out, at a different level and in signal
    colour. Passing mono=True renders both in fg for single-colour use."""
    u = size / MARK["box"]
    arm, sw, off, h, gap = (MARK[k] * u for k in ("arm", "sw", "off", "h", "gap"))
    c = x + size / 2
    lx = c - gap / 2 - arm
    rx = c + gap / 2 + arm
    ly = y + size / 2 - h / 2 + off / 2
    ry = y + size / 2 - h / 2 - off / 2
    right = fg if mono else sig
    return (
        f'<path d="M{lx + arm:.2f} {ly:.2f} L{lx:.2f} {ly:.2f} '
        f'L{lx:.2f} {ly + h:.2f} L{lx + arm:.2f} {ly + h:.2f}" '
        f'fill="none" stroke="{fg}" stroke-width="{sw:.2f}" stroke-linecap="butt"/>'
        f'<path d="M{rx - arm:.2f} {ry:.2f} L{rx:.2f} {ry:.2f} '
        f'L{rx:.2f} {ry + h:.2f} L{rx - arm:.2f} {ry + h:.2f}" '
        f'fill="none" stroke="{right}" stroke-width="{sw:.2f}" stroke-linecap="butt"/>'
    )


def lockup(x, y, size, fg, sig, mono=False, tracking=0.0):
    """Offset brackets wrapping the name: the CLI prefix, as a logo.

    (x, y) is the top-left of the drawn box. Returns (svg, width, height).
    """
    f = Face.get(MONO600)
    h = size * 1.06                       # bracket run
    sw = size * 0.105
    arm = size * 0.26
    off = h * 0.16
    gap = size * 0.30

    tw = f.width("supawatch", size, tracking)
    # baseline: lowercase optically centred in the bracket span
    base = y + off / 2 + h / 2 + size * 0.245

    parts = []
    # left bracket, low
    ly = y + off
    parts.append(
        f'<path d="M{x + arm:.2f} {ly:.2f} L{x:.2f} {ly:.2f} '
        f'L{x:.2f} {ly + h:.2f} L{x + arm:.2f} {ly + h:.2f}" '
        f'fill="none" stroke="{fg}" stroke-width="{sw:.2f}" stroke-linecap="butt"/>'
    )
    nx = x + arm + gap
    tp, _ = f.paths("supawatch", nx, base, size, fg, tracking)
    parts.append(tp)
    rx = nx + tw + gap + arm
    ry = y
    parts.append(
        f'<path d="M{rx - arm:.2f} {ry:.2f} L{rx:.2f} {ry:.2f} '
        f'L{rx:.2f} {ry + h:.2f} L{rx - arm:.2f} {ry + h:.2f}" '
        f'fill="none" stroke="{fg if mono else sig}" stroke-width="{sw:.2f}" '
        f'stroke-linecap="butt"/>'
    )
    return "".join(parts), rx - x, h + off


def arrow(x, y, w, colour, sw=1.6):
    """A mapping arrow, drawn rather than typed so no glyph coverage is
    assumed once the text is outlined. The head is a filled triangle: a
    stroked chevron loses its point once the banner is scaled down to the
    width a README actually renders at."""
    head = 5.4
    return (
        f'<path d="M{x:.2f} {y:.2f} L{x + w - head:.2f} {y:.2f}" '
        f'stroke="{colour}" stroke-width="{sw}" fill="none"/>'
        f'<path d="M{x + w - head:.2f} {y - head * 0.55:.2f} '
        f'L{x + w:.2f} {y:.2f} '
        f'L{x + w - head:.2f} {y + head * 0.55:.2f} Z" fill="{colour}"/>'
    )


def logomark_src(P, size=48, mono=False, bg=None):
    """The mark as a standalone SVG document."""
    return (svg_open(size, size, bg)
            + mark(0, 0, size, P["fg"], P["signal"], mono=mono)
            + "</svg>")


def svg_open(w, h, bg=None):
    o = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" aria-label="supawatch">'
    )
    if bg:
        o += f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    return o
