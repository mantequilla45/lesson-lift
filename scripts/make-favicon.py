#!/usr/bin/env python3
"""Generate the Jooma favicon and app icons from the brand mark.

Run:  python scripts/make-favicon.py

Reads the four "J" stroke paths out of public/logo/icon.svg and renders them
onto a solid purple disc, writing:

    app/favicon.ico       multi-resolution, 16 -> 256
    app/apple-icon.png    180x180, for iOS home screens
    public/logo/icon-v2.svg   the same mark as vector

Why a script rather than a checked-in binary someone hand-exported: the mark is
derived from the real path data, so if the logo changes the icons can be
regenerated rather than redrawn.

Two things worth knowing before editing this:

  1. The mark is four concentric strokes. At 16px they blur into a single
     illegible blob. So the small sizes render ONLY the outermost stroke,
     dilated slightly, which reads as one clean bold J. 48px and up get the
     full four-stroke mark. Same geometry, size-appropriate detail. This is
     the standard trick for a detailed mark in a browser tab.

  2. Everything is rendered at SS times the target size and downsampled with
     LANCZOS. Pillow has no antialiased polygon fill, so supersampling is
     what keeps the curves smooth.

Dependencies: Pillow only (already present). No cairosvg, no sharp, no
ImageMagick, so this runs anywhere the repo does.
"""

import io
import os
import re

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "logo", "icon.svg")

PURPLE = (91, 46, 214, 255)  # --j-purple #5B2ED6
WHITE = (255, 255, 255, 255)

VB = 87   # the source viewBox is 87x87
SS = 8    # supersample factor
INSET = 0.10  # padding around the mark, as a fraction of the canvas

# Sizes that go into the .ico. 16/32 get the simplified mark.
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
SIMPLIFY_AT_OR_BELOW = 32

TOKEN = re.compile(r"([MmLlHhVvCcSsZz])|(-?\d*\.?\d+(?:e-?\d+)?)")


def read_paths(svg_path):
    """Pull the `d` attribute of every <path> out of the SVG, in order."""
    with io.open(svg_path, encoding="utf-8") as fh:
        svg = fh.read()
    paths = re.findall(r'\sd="([^"]+)"', svg)
    if len(paths) != 4:
        raise SystemExit(
            "expected 4 stroke paths in %s, found %d. If the logo changed, "
            "check the simplified-mark assumption below still holds."
            % (svg_path, len(paths))
        )
    return paths


def flatten(d, steps=24):
    """Turn one path's `d` into a list of polygons (lists of points).

    Only the commands the brand mark actually uses are handled: M/L/H/V/C/Z in
    both absolute and relative form. Cubics are flattened to `steps` segments,
    which is far finer than a 256px render can show.
    """
    toks = []
    for m in TOKEN.finditer(d):
        toks.append(m.group(1) if m.group(1) else float(m.group(2)))

    def cubic(p0, p1, p2, p3):
        out = []
        for k in range(1, steps + 1):
            t = k / steps
            mt = 1 - t
            out.append((
                mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
                mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1],
            ))
        return out

    polys, pts = [], []
    cur = start = (0.0, 0.0)
    cmd = None
    i = 0
    while i < len(toks):
        if isinstance(toks[i], str):
            cmd = toks[i]
            i += 1
        if cmd in ("M", "m"):
            x, y = toks[i], toks[i + 1]
            i += 2
            if cmd == "m":
                x, y = cur[0] + x, cur[1] + y
            if pts:
                polys.append(pts)
            pts = [(x, y)]
            cur = start = (x, y)
            cmd = "L" if cmd == "M" else "l"  # implicit lineto after moveto
        elif cmd in ("L", "l"):
            x, y = toks[i], toks[i + 1]
            i += 2
            if cmd == "l":
                x, y = cur[0] + x, cur[1] + y
            pts.append((x, y))
            cur = (x, y)
        elif cmd in ("H", "h"):
            x = toks[i]
            i += 1
            if cmd == "h":
                x = cur[0] + x
            pts.append((x, cur[1]))
            cur = (x, cur[1])
        elif cmd in ("V", "v"):
            y = toks[i]
            i += 1
            if cmd == "v":
                y = cur[1] + y
            pts.append((cur[0], y))
            cur = (cur[0], y)
        elif cmd in ("C", "c"):
            x1, y1, x2, y2, x, y = toks[i:i + 6]
            i += 6
            if cmd == "c":
                x1, y1 = cur[0] + x1, cur[1] + y1
                x2, y2 = cur[0] + x2, cur[1] + y2
                x, y = cur[0] + x, cur[1] + y
            pts.extend(cubic(cur, (x1, y1), (x2, y2), (x, y)))
            cur = (x, y)
        elif cmd in ("Z", "z"):
            if pts:
                pts.append(start)
                polys.append(pts)
                pts = []
            cur = start
        else:
            i += 1  # command we don't use; skip the number
    if pts:
        polys.append(pts)
    return polys


def render(size, paths, simplified=False):
    """One square icon: white J knocked out of a purple disc."""
    s = size * SS
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)

    inset = s * INSET
    scale = (s - 2 * inset) / VB
    use = [paths[-1]] if simplified else paths
    for d in use:
        for poly in flatten(d):
            if len(poly) > 2:
                md.polygon([(inset + x * scale, inset + y * scale) for x, y in poly], fill=255)

    if simplified:
        # Fatten the single stroke so it holds up once downsampled. Tuned so
        # the 16px render reads as a J rather than a stripe.
        r = max(3, int(s * 0.012))
        mask = mask.filter(ImageFilter.MaxFilter(r * 2 + 1))

    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse([0, 0, s - 1, s - 1], fill=PURPLE)
    img.paste(Image.new("RGBA", (s, s), WHITE), (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)


SVG_TEMPLATE = """<svg width="87" height="87" viewBox="0 0 87 87" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="87" height="87" rx="43.5" fill="#5B2ED6"/>
{paths}
</svg>
"""


def main():
    paths = read_paths(SRC)

    frames = [
        render(n, paths, simplified=n <= SIMPLIFY_AT_OR_BELOW)
        for n in ICO_SIZES
    ]
    ico = os.path.join(ROOT, "app", "favicon.ico")
    # Pillow's ICO writer drops any requested size larger than the image it is
    # called on, so save from the LARGEST frame and hand it the rest through
    # append_images. Saving from the smallest silently yields a 1-frame icon.
    frames.sort(key=lambda f: f.size[0])
    frames[-1].save(ico, format="ICO", sizes=[(n, n) for n in ICO_SIZES],
                    append_images=frames[:-1])
    print("wrote %s (%s)" % (ico, ", ".join("%dx%d" % (n, n) for n in ICO_SIZES)))

    apple = os.path.join(ROOT, "app", "apple-icon.png")
    render(180, paths).save(apple, format="PNG")
    print("wrote %s (180x180)" % apple)

    out_svg = os.path.join(ROOT, "public", "logo", "icon-v2.svg")
    body = "\n".join('<path d="%s" fill="#FFFFFF"/>' % d for d in paths)
    with io.open(out_svg, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(SVG_TEMPLATE.format(paths=body))
    print("wrote %s" % out_svg)


if __name__ == "__main__":
    main()
