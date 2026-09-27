"""
FORGE brand marks, traced from the game's logo (My project/Assets/Resources/Signs/mark_white.png) so they stay sharp
at any size: the angled F with its pink accent, and the full FORGE wordmark.

    python scripts/brand.py

Writes public/brand/forge-mark.svg, forge-logo.svg (white, pink accent), the web icons (icon-192/512, apple-icon,
favicon.ico) and the Android launcher icons and splash screens.
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..")
SRC = os.path.join(APP, "..", "My project", "Assets", "Resources", "Signs", "mark_white.png")
PINK, WHITE, BG = "#FF2E78", "#FFFFFF", (14, 16, 22)

alpha = np.asarray(Image.open(SRC).convert("RGBA"))[..., 3] > 128
labels, n = ndimage.label(alpha)
parts = []  # (polygon points in source pixels, is_accent, is_mark)
for i, sl in enumerate(ndimage.find_objects(labels), 1):
    comp = np.pad(labels == i, 1)
    # Every contour of the piece: the outline first, then its holes (the counters of O, R and G).
    rings = sorted(measure.find_contours(comp.astype(float), .5), key=len, reverse=True)
    rings = [[(float(x) - 1, float(y) - 1) for y, x in measure.approximate_polygon(r, tolerance=1.2)] for r in rings if len(r) > 12]
    x0 = sl[1].start
    size = (labels[sl] == i).sum()
    parts.append((rings, size < 3000, x0 < 270))  # the small piece is the pink accent; left of x 270 is the F mark

def bbox(ps):
    xs = [x for p in ps for x, _ in p[0][0]]; ys = [y for p in ps for _, y in p[0][0]]
    return min(xs), min(ys), max(xs), max(ys)

def svg(ps, name, white=WHITE):
    x0, y0, x1, y1 = bbox(ps)
    ring = lambda pts: "M" + " L".join(f"{x - x0:.1f},{y - y0:.1f}" for x, y in pts) + " Z"
    paths = "".join(f'<path fill="{PINK if acc else white}" fill-rule="evenodd" d="{" ".join(ring(r) for r in rings)}"/>' for rings, acc, _ in ps)
    open(os.path.join(APP, "public", "brand", name), "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x1 - x0:.1f} {y1 - y0:.1f}">{paths}</svg>')

def raster(ps, height, pad=0.0, bg=None, size=None):
    """The marks drawn at `height` px (supersampled 4x), optionally centred on a square `size` background."""
    x0, y0, x1, y1 = bbox(ps)
    k = 4; sc = height * k / (y1 - y0)
    w, h = int((x1 - x0) * sc), int((y1 - y0) * sc)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for rings, acc, _ in ps:
        for j, r in enumerate(rings):  # outline filled, holes cut back out
            d.polygon([((x - x0) * sc, (y - y0) * sc) for x, y in r], fill=(PINK if acc else WHITE) if j == 0 else (0, 0, 0, 0))
    im = im.resize((max(1, w // k), max(1, h // k)), Image.LANCZOS)
    if size is None: return im
    canvas = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas

os.makedirs(os.path.join(APP, "public", "brand"), exist_ok=True)
mark = [p for p in parts if p[2]]
svg(mark, "forge-mark.svg"); svg(parts, "forge-logo.svg")
svg(mark, "forge-mark-ink.svg", "#0E1016"); svg(parts, "forge-logo-ink.svg", "#0E1016")  # for light backgrounds
raster(parts, 256).save(os.path.join(APP, "public", "brand", "forge-logo.png"))

# Web icons: the F on the dark ground (maskable: inside the central 60 %).
for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-icon.png")):
    raster(mark, int(size * .5), bg=BG, size=size).convert("RGB").save(os.path.join(APP, "public", name))
raster(mark, 26, bg=BG, size=32).save(os.path.join(APP, "public", "favicon.ico"), sizes=[(32, 32)])

# Android: launcher (legacy, round, adaptive foreground) and splash.
res = os.path.join(APP, "android", "app", "src", "main", "res")
for d, (leg, fg) in {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216), "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}.items():
    raster(mark, int(fg * .42), size=fg).save(os.path.join(res, f"mipmap-{d}", "ic_launcher_foreground.png"))
    sq = raster(mark, int(leg * .56), bg=BG, size=leg); sq.save(os.path.join(res, f"mipmap-{d}", "ic_launcher.png"))
    m = Image.new("L", (leg * 4, leg * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, leg * 4 - 1, leg * 4 - 1), fill=255)
    rd = sq.copy(); rd.putalpha(m.resize((leg, leg), Image.LANCZOS)); rd.save(os.path.join(res, f"mipmap-{d}", "ic_launcher_round.png"))
for root, dirs, files in os.walk(res):
    if "splash.png" in files:
        p = os.path.join(root, "splash.png"); W, H = Image.open(p).size
        s = Image.new("RGB", (W, H), BG); logo = raster(parts, int(min(W, H) * .15)); s.paste(logo, ((W - logo.width) // 2, (H - logo.height) // 2), logo); s.save(p)
print("brand: marks, web icons, Android icons and splash written")
