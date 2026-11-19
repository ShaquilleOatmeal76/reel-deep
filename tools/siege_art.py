"""Siege of the Deep art: towers, guardians, the Admiral, his gunboat and the Flipside spawn.
Writes ../assets/siege.png and ../siege_art.js (const SIEGE_ART = {key: [x, y, w, h]}). Needs Pillow (pip install pillow).
The drawings are the approved mock-ups (Nov 19, 2026). Same output every run. Run from this folder: python3 siege_art.py"""
import json, math, random, os
from PIL import Image, ImageDraw

INK = (30, 24, 36, 255)


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def outline(im, col=INK):
    """A 1 px dark outline around every opaque pixel (the game's sprite look)."""
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(im, (1, 1))
    src = out.load(); res = out.copy(); r = res.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3] < 40:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3] >= 40:
                        r[x, y] = col; break
    return res

# ---- towers

W, H = 26, 30
STONE = [(92, 86, 98, 255), (122, 114, 126, 255), (150, 142, 150, 255)]
GOLD = (250, 206, 70, 255)


def base(d, wide=18, tall=6, gold=False):
    x0 = (W - wide) // 2
    y0 = H - tall
    d.ellipse([x0, y0, x0 + wide - 1, H + tall - 2], fill=STONE[0])
    d.ellipse([x0 + 1, y0, x0 + wide - 3, H + tall - 4], fill=STONE[1])
    d.line([x0 + 3, y0 + 1, x0 + wide - 6, y0 + 1], fill=STONE[2])
    if gold:
        d.line([x0 + 2, H - 2, x0 + wide - 3, H - 2], fill=GOLD)


def branch(d, x, y, length, ang, col, tip=None, w=2):
    ex = x + math.cos(ang) * length
    ey = y - math.sin(ang) * length
    d.line([x, y, ex, ey], fill=col, width=w)
    if tip:
        d.rectangle([ex - 1, ey - 1, ex, ey], fill=tip)
    return ex, ey


def coral(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, gold=lv >= 3)
    cx, by = W // 2, H - 6
    if spec == "A":  # Sniper Coral: one long tube, scope pearl
        c1, c2 = (190, 40, 50, 255), (240, 90, 80, 255)
        d.polygon([(cx - 2, by), (cx + 2, by), (cx + 1, by - 10), (cx - 1, by - 10)], fill=c1)
        d.line([cx - 1, by - 10, cx + 9, by - 19], fill=c1, width=3)
        d.line([cx, by - 11, cx + 9, by - 19], fill=c2, width=1)
        d.ellipse([cx + 7, by - 22, cx + 11, by - 18], fill=(255, 245, 230, 255))
        d.point([cx + 9, by - 20], fill=(30, 24, 36, 255))
        d.ellipse([cx - 5, by - 14, cx - 2, by - 11], fill=(230, 240, 255, 255))
        return outline(im)
    if spec == "B":  # Brain Coral: dome with three nozzles
        d.ellipse([cx - 9, by - 13, cx + 9, by + 1], fill=(226, 120, 160, 255))
        d.ellipse([cx - 7, by - 12, cx + 6, by - 3], fill=(244, 156, 186, 255))
        for k in range(-6, 7, 3):
            d.arc([cx + k - 2, by - 11, cx + k + 2, by - 5], 0, 180, fill=(190, 80, 120, 255))
        for nx in (-7, 0, 7):
            d.rectangle([cx + nx - 1, by - 17 + abs(nx) // 2, cx + nx + 1, by - 12], fill=(250, 110, 70, 255))
            d.point([cx + nx, by - 17 + abs(nx) // 2], fill=(30, 24, 36, 255))
        return outline(im)
    col = [(232, 98, 64, 255), (240, 112, 70, 255), (246, 120, 72, 255)][lv - 1]
    tip = GOLD if lv >= 3 else (255, 180, 140, 255)
    n = [2, 3, 4][lv - 1]
    hgt = [8, 11, 13][lv - 1]
    d.line([cx, by, cx, by - hgt], fill=col, width=3)
    angs = [math.radians(a) for a in (140, 40, 115, 65)][:n]
    for i, a in enumerate(angs):
        branch(d, cx, by - hgt + 2 + i * 2, 5 + lv, a, col, tip)
    d.ellipse([cx - 2, by - hgt - 3, cx + 2, by - hgt + 1], fill=col)
    d.point([cx, by - hgt - 1], fill=(30, 24, 36, 255))
    return outline(im)


def urchin_body(d, cx, cy, r, body, spike, n=12):
    for k in range(n):
        a = k * 2 * math.pi / n
        d.line([cx, cy, cx + math.cos(a) * (r + 3), cy + math.sin(a) * (r + 3)], fill=spike)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body)
    d.point([cx - r // 2, cy - r // 2], fill=(255, 255, 255, 160))


def mortar(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, gold=lv >= 3)
    cx, by = W // 2, H - 6
    # stone bowl
    bw = 8 if spec else [6, 7, 8][lv - 1]
    d.chord([cx - bw, by - 9, cx + bw, by + 3], 0, 180, fill=(110, 96, 84, 255))
    d.line([cx - bw, by - 3, cx + bw, by - 3], fill=(150, 130, 110, 255))
    if spec == "A":
        for ox, oy in ((-4, -7), (4, -7), (0, -12)):
            urchin_body(d, cx + ox, by + oy, 3, (110, 60, 150, 255), (200, 170, 240, 255), 10)
    elif spec == "B":
        d.polygon([(cx - 5, by - 8), (cx, by - 22), (cx + 5, by - 8)], fill=(250, 140, 40, 200))
        d.polygon([(cx - 3, by - 8), (cx, by - 17), (cx + 3, by - 8)], fill=(255, 230, 120, 230))
        urchin_body(d, cx, by - 7, 4, (200, 50, 40, 255), (255, 170, 60, 255), 12)
    else:
        r = [3, 4, 5][lv - 1]
        spike = GOLD if lv >= 3 else (200, 170, 240, 255)
        urchin_body(d, cx, by - 5 - r, r, (96, 56, 140, 255), spike, 10 + 2 * lv)
    return outline(im)


def tentacle(d, x, y, length, sway, col, tip, w=2):
    pts = []
    for i in range(length + 1):
        t = i / max(1, length)
        pts.append((x + math.sin(t * 2.6) * sway * t, y - i))
    d.line(pts, fill=col, width=w)
    ex, ey = pts[-1]
    d.ellipse([ex - 1, ey - 1, ex + 1, ey + 1], fill=tip)


def anemone(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, wide=20 if spec == "A" else 18, gold=lv >= 3)
    cx, by = W // 2, H - 6
    if spec == "A":
        col, tip, n, ln = (90, 190, 110, 255), (250, 150, 190, 255), 9, 15
    elif spec == "B":
        col, tip, n, ln = (150, 80, 190, 255), (255, 240, 90, 255), 7, 13
    else:
        col, tip = (80, 180, 120, 255), (GOLD if lv >= 3 else (250, 140, 180, 255))
        n, ln = [4, 5, 7][lv - 1], [8, 10, 12][lv - 1]
    span = 14 if spec == "A" else 10
    for i in range(n):
        t = i / (n - 1) - 0.5
        tentacle(d, cx + t * span, by - 3, ln - int(abs(t) * 6), t * 8, col, tip, 2)
    d.ellipse([cx - span // 2 - 1, by - 5, cx + span // 2 + 1, by + 1], fill=(220, 90, 120, 255))
    if spec == "B":
        for p in ((cx - 6, by - 16), (cx + 5, by - 14), (cx, by - 18)):
            d.point(p, fill=(255, 255, 160, 255))
    return outline(im)


def jelly(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, gold=lv >= 3)
    cx, by = W // 2, H - 6
    # copper coil post
    d.rectangle([cx - 1, by - 10, cx + 1, by], fill=(180, 110, 60, 255))
    for yy in range(by - 9, by, 2):
        d.line([cx - 2, yy, cx + 2, yy], fill=(230, 160, 90, 255))
    if spec == "A":
        d.chord([cx - 8, by - 26, cx + 8, by - 10], 180, 360, fill=(170, 210, 255, 230))
        d.rectangle([cx - 8, by - 18, cx + 8, by - 16], fill=(120, 170, 240, 255))
        d.line([(cx - 3, by - 15), (cx - 6, by - 11), (cx - 3, by - 11), (cx - 6, by - 7)], fill=(255, 250, 120, 255))
        d.line([(cx + 4, by - 15), (cx + 2, by - 12), (cx + 5, by - 12), (cx + 2, by - 8)], fill=(255, 250, 120, 255))
    elif spec == "B":
        d.rectangle([cx - 6, by - 23, cx + 6, by - 13], fill=(150, 230, 170, 220))
        d.rectangle([cx - 5, by - 22, cx + 5, by - 19], fill=(200, 250, 210, 230))
        for x in range(cx - 5, cx + 6, 3):
            d.line([x, by - 13, x, by - 9], fill=(110, 200, 120, 255))
    else:
        r = [5, 6, 7][lv - 1]
        top = by - 13 - r
        d.chord([cx - r, top, cx + r, top + 2 * r], 180, 360, fill=(160, 200, 255, 230))
        d.chord([cx - r + 2, top + 1, cx + r - 2, top + r], 180, 360, fill=(210, 230, 255, 240))
        for x in range(cx - r + 1, cx + r, 3):
            d.line([x, top + r, x + 1, top + r + 4], fill=(140, 180, 250, 255))
        if lv >= 3:
            d.point([cx, top + 1], fill=GOLD)
        d.line([cx - r - 2, top + r - 3, cx - r - 4, top + r], fill=(255, 250, 120, 255))
        d.line([cx + r + 2, top + r - 3, cx + r + 4, top + r], fill=(255, 250, 120, 255))
    return outline(im)


def clam(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, gold=lv >= 3)
    cx, by = W // 2, H - 6
    def one(x, y, r, shell, pearl):
        d.chord([x - r, y - r, x + r, y + r], 0, 180, fill=shell)
        d.chord([x - r, y - r - 6, x + r, y + r - 8], 180, 360, fill=shell)
        for k in range(-r + 2, r - 1, 3):
            d.line([x, y - 2, x + k, y - r - 1], fill=(shell[0] - 40, shell[1] - 40, shell[2] - 40, 255))
        d.ellipse([x - 2, y - 4, x + 2, y], fill=pearl)
        d.point([x - 1, y - 3], fill=(255, 255, 255, 255))
    if spec == "A":
        one(cx - 5, by - 2, 5, (230, 190, 150, 255), (250, 240, 250, 255))
        one(cx + 5, by - 2, 5, (230, 190, 150, 255), (250, 240, 250, 255))
        one(cx, by - 11, 5, (240, 200, 160, 255), GOLD)
    elif spec == "B":
        d.ellipse([cx - 11, by - 22, cx + 11, by + 2], outline=(150, 220, 255, 200))
        one(cx, by - 3, 8, (90, 70, 110, 255), (40, 30, 60, 255))
        d.point([cx - 1, by - 6], fill=(200, 160, 255, 255))
    else:
        r = [5, 7, 8][lv - 1]
        one(cx, by - 2, r, (234, 196, 156, 255), GOLD if lv >= 3 else (250, 240, 250, 255))
    return outline(im)


def buoy(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, gold=lv >= 3)
    cx, by = W // 2, H - 6
    if spec == "A":
        for i, y in enumerate(range(by - 2, by - 22, -4)):
            col = (230, 60, 60, 255) if i % 2 == 0 else (250, 250, 250, 255)
            w = 5 - i // 2
            d.rectangle([cx - w, y - 4, cx + w, y], fill=col)
        d.rectangle([cx - 3, by - 26, cx + 3, by - 22], fill=(255, 240, 150, 255))
        d.polygon([(cx - 4, by - 26), (cx, by - 30), (cx + 4, by - 26)], fill=(60, 60, 70, 255))
        d.line([cx + 4, by - 24, cx + 12, by - 27], fill=(255, 250, 180, 160))
        d.line([cx - 4, by - 24, cx - 12, by - 27], fill=(255, 250, 180, 160))
        return outline(im)
    if spec == "B":
        d.rectangle([cx - 1, by - 12, cx + 1, by], fill=(160, 160, 170, 255))
        d.chord([cx - 8, by - 20, cx + 8, by - 8], 180, 360, fill=(200, 210, 220, 255))
        d.line([cx, by - 14, cx + 3, by - 19], fill=(60, 60, 70, 255))
        d.point([cx + 3, by - 20], fill=(255, 80, 80, 255))
        for r in (11, 14):
            d.arc([cx - r, by - 14 - r, cx + r, by - 14 + r], 210, 330, fill=(120, 255, 160, 200))
        return outline(im)
    h = [10, 12, 14][lv - 1]
    d.line([cx, by, cx, by - 4], fill=(90, 90, 100, 255))
    d.ellipse([cx - 5, by - h, cx + 5, by - 3], fill=(230, 60, 60, 255))
    d.rectangle([cx - 5, by - h + 4, cx + 5, by - h + 6], fill=(250, 250, 250, 255))
    d.rectangle([cx - 2, by - h - 5, cx + 2, by - h], fill=(255, 236, 140, 255))
    d.rectangle([cx - 3, by - h - 6, cx + 3, by - h - 6], fill=(60, 60, 70, 255))
    if lv >= 2:
        d.ellipse([cx - 9, by - h - 9, cx + 9, by - h + 4], outline=(255, 240, 160, 90))
    if lv >= 3:
        d.point([cx, by - h - 7], fill=GOLD)
    return outline(im)


def kraken(lv, spec):
    im = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(im)
    base(d, wide=22, gold=lv >= 3)
    cx, by = W // 2, H - 6
    d.ellipse([cx - 7, by - 2, cx + 7, by + 3], fill=(16, 12, 24, 255))
    if spec == "B":
        for r, c in ((10, (60, 120, 200, 230)), (7, (100, 170, 240, 230)), (4, (180, 220, 255, 240))):
            d.arc([cx - r, by - 14 - r // 2, cx + r, by - 14 + r // 2], 0, 300, fill=c, width=2)
        d.point([cx, by - 14], fill=(255, 255, 255, 255))
        return outline(im)
    col = (150, 60, 110, 255) if spec != "A" else (120, 40, 90, 255)
    n = {1: 2, 2: 3, 3: 4}.get(lv, 5) if spec != "A" else 5
    ln = [9, 11, 13][lv - 1] if spec != "A" else 17
    for i in range(n):
        t = i / max(1, n - 1) - 0.5
        tentacle(d, cx + t * 10, by, ln - int(abs(t) * 4), t * 10 + 2, col, (240, 160, 200, 255), 2 if spec != "A" else 3)
    if spec == "A":
        d.ellipse([cx - 5, by - 9, cx + 5, by + 1], fill=col)
        d.ellipse([cx - 2, by - 6, cx + 2, by - 2], fill=(255, 220, 80, 255))
        d.line([cx, by - 6, cx, by - 3], fill=(30, 24, 36, 255))
    return outline(im)


TOWERS = [
    ("CORAL SPITTER", coral, "SNIPER CORAL", "BRAIN CORAL"),
    ("URCHIN MORTAR", mortar, "SPINE STORM", "FIRE URCHIN"),
    ("ANEMONE TRAP", anemone, "GIANT ANEMONE", "STINGER"),
    ("JELLY COIL", jelly, "STORM BELL", "BOX JELLY"),
    ("PEARL CLAM", clam, "PEARL BANK", "BLACK PEARL"),
    ("LANTERN BUOY", buoy, "LIGHTHOUSE", "SONAR BUOY"),
    ("KRAKEN PIT", kraken, "KRAKEN", "MAELSTROM"),
]


def tower(i, lv=1, spec=None):
    return TOWERS[i][1](lv if not spec else 3, spec)


# ---- guardians

GW, GH = 64, 52
GOLD = (250, 206, 70, 255)
INKC = (30, 24, 36, 255)


def new():
    im = Image.new("RGBA", (GW, GH)); return im, ImageDraw.Draw(im)


def eye(d, x, y, r=2, col=(255, 240, 120, 255), pupil=INKC):
    d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    d.point([x, y], fill=pupil)


def king_crab():
    im, d = new()
    body, hi, dark = (210, 60, 50, 255), (240, 110, 80, 255), (150, 34, 34, 255)
    for k in range(3):  # legs
        for s in (-1, 1):
            x0 = 32 + s * (10 + k * 4)
            d.line([32 + s * 8, 36, x0, 40, x0 + s * 4, 49], fill=dark, width=2)
    d.ellipse([16, 22, 48, 42], fill=body)
    d.ellipse([20, 24, 44, 34], fill=hi)
    # claws
    d.line([20, 30, 10, 22], fill=body, width=3); d.line([44, 30, 54, 22], fill=body, width=3)
    d.ellipse([1, 8, 15, 24], fill=body); d.polygon([(2, 9), (8, 15), (2, 14)], fill=(0, 0, 0, 0))
    d.ellipse([49, 8, 63, 24], fill=body); d.polygon([(62, 9), (56, 15), (62, 14)], fill=(0, 0, 0, 0))
    d.line([4, 12, 10, 12], fill=hi); d.line([52, 12, 58, 12], fill=hi)
    # eye stalks + crown
    d.line([27, 24, 26, 17], fill=dark, width=2); d.line([37, 24, 38, 17], fill=dark, width=2)
    eye(d, 26, 16, 2, (255, 255, 255, 255)); eye(d, 38, 16, 2, (255, 255, 255, 255))
    d.polygon([(26, 11), (28, 5), (30, 9), (32, 3), (34, 9), (36, 5), (38, 11)], fill=GOLD)
    d.point([32, 6], fill=(220, 40, 60, 255))
    d.arc([27, 30, 37, 36], 20, 160, fill=dark)
    return outline(im)


def kelp_witch():
    im, d = new()
    g1, g2, g3 = (40, 110, 60, 255), (70, 150, 80, 255), (110, 190, 100, 255)
    rnd = random.Random(3)
    for i in range(12):  # kelp hair strands
        x = 14 + i * 3
        d.line([(x, 12), (x - 2 + rnd.randint(-2, 2), 30), (x + rnd.randint(-3, 3), 50)], fill=[g1, g2][i % 2], width=2)
    d.polygon([(32, 2), (16, 22), (18, 50), (46, 50), (48, 22)], fill=g1)
    d.polygon([(32, 4), (22, 20), (42, 20)], fill=g2)
    d.ellipse([24, 14, 40, 30], fill=(20, 30, 24, 255))
    eye(d, 28, 21, 2); eye(d, 36, 21, 2)
    d.line([28, 26, 36, 26], fill=(200, 230, 120, 255))
    # staff with a glowing bulb
    d.line([52, 10, 50, 50], fill=(110, 80, 50, 255), width=2)
    d.ellipse([48, 4, 57, 13], fill=(180, 255, 140, 255)); d.ellipse([50, 6, 54, 10], fill=(240, 255, 220, 255))
    for x, y in ((20, 40), (40, 44), (30, 36)):
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=g3)
    return outline(im)


def mantis_king():
    im, d = new()
    cols = [(60, 160, 120, 255), (80, 190, 150, 255), (230, 120, 60, 255), (240, 70, 90, 255), (120, 80, 200, 255)]
    for i, c in enumerate(cols):  # segmented body, curling
        x = 14 + i * 8
        d.ellipse([x, 26 + (i % 2) * 2, x + 12, 42 + (i % 2) * 2], fill=c)
    d.polygon([(54, 34), (63, 26), (63, 44)], fill=(240, 200, 80, 255))  # tail fan
    # head
    d.ellipse([4, 18, 22, 36], fill=(60, 160, 120, 255))
    d.line([10, 20, 8, 8], fill=(40, 120, 90, 255), width=2); d.line([16, 20, 18, 8], fill=(40, 120, 90, 255), width=2)
    eye(d, 8, 7, 3, (250, 220, 120, 255)); eye(d, 18, 7, 3, (250, 220, 120, 255))
    d.polygon([(9, 3), (11, 0), (13, 3), (15, 0), (17, 3)], fill=GOLD)
    # club arms
    d.line([12, 34, 6, 44], fill=(230, 120, 60, 255), width=3); d.ellipse([1, 42, 11, 51], fill=(250, 150, 70, 255))
    d.line([18, 34, 22, 46], fill=(230, 120, 60, 255), width=3); d.ellipse([18, 43, 28, 51], fill=(250, 150, 70, 255))
    for k in range(6):
        d.line([24 + k * 5, 42, 23 + k * 5, 48], fill=(200, 90, 60, 255))
    return outline(im)


def gloom_ray():
    im, d = new()
    d.ellipse([0, 4, 63, 48], fill=(70, 40, 120, 70))
    d.polygon([(32, 14), (2, 30), (12, 34), (32, 40), (52, 34), (62, 30)], fill=(52, 34, 88, 255))
    d.polygon([(32, 16), (10, 29), (32, 34), (54, 29)], fill=(80, 56, 130, 255))
    d.line([32, 40, 34, 51], fill=(52, 34, 88, 255), width=2)
    d.polygon([(26, 14), (24, 9), (29, 13)], fill=(52, 34, 88, 255)); d.polygon([(38, 14), (40, 9), (35, 13)], fill=(52, 34, 88, 255))
    eye(d, 27, 20, 2, (180, 140, 255, 255)); eye(d, 37, 20, 2, (180, 140, 255, 255))
    for x, y in ((14, 30), (50, 30), (22, 33), (42, 33)):
        d.point([x, y], fill=(200, 170, 255, 255))
    return outline(im)


def ghost_ship():
    im, d = new()
    hull, hi, sail = (120, 200, 170, 200), (180, 240, 210, 220), (220, 250, 235, 170)
    d.polygon([(4, 34), (60, 34), (54, 48), (10, 48)], fill=hull)
    d.line([6, 36, 58, 36], fill=hi)
    for x in (16, 28, 40):
        d.ellipse([x - 2, 40, x + 2, 44], fill=(20, 40, 36, 255))
    d.line([24, 34, 24, 4], fill=hi, width=2); d.line([42, 34, 42, 10], fill=hi, width=2)
    d.polygon([(25, 6), (38, 10), (36, 22), (25, 26)], fill=sail); d.polygon([(43, 12), (54, 15), (52, 26), (43, 28)], fill=sail)
    d.line([29, 12, 33, 18], fill=(80, 140, 120, 255)); d.line([46, 18, 50, 22], fill=(80, 140, 120, 255))
    d.polygon([(20, 4), (24, 2), (24, 7)], fill=(230, 80, 80, 200))
    eye(d, 8, 30, 2, (180, 255, 200, 255))
    for x in (12, 32, 50):
        d.line([x, 48, x - 2, 51], fill=hull)
    return outline(im)


def gulper():
    im, d = new()
    body = (34, 30, 44, 255)
    d.line([(40, 30), (52, 36), (60, 44), (62, 50)], fill=body, width=4)
    d.polygon([(6, 12), (44, 20), (46, 36), (6, 46)], fill=body)
    d.polygon([(8, 16), (40, 23), (8, 30)], fill=(90, 20, 40, 255))  # open mouth
    d.polygon([(8, 32), (40, 31), (8, 42)], fill=(90, 20, 40, 255))
    for x in range(9, 40, 4):
        d.polygon([(x, 17 + (x - 8) // 5), (x + 2, 21 + (x - 8) // 5), (x + 3, 17 + (x - 8) // 5)], fill=(240, 236, 220, 255))
        d.polygon([(x, 41 - (x - 8) // 4), (x + 2, 37 - (x - 8) // 4), (x + 3, 41 - (x - 8) // 4)], fill=(240, 236, 220, 255))
    eye(d, 40, 22, 2, (230, 255, 120, 255))
    d.line([(38, 18), (30, 6), (20, 3)], fill=(80, 70, 90, 255))
    d.ellipse([15, 0, 22, 7], fill=(160, 255, 220, 255)); d.point([18, 3], fill=(255, 255, 255, 255))
    return outline(im)


def spider_queen():
    im, d = new()
    leg, glass, hi = (150, 200, 230, 230), (170, 220, 250, 210), (230, 250, 255, 240)
    for s in (-1, 1):
        for k in range(4):
            y0 = 24 + k * 4
            d.line([(32 + s * 6, y0), (32 + s * (16 + k * 2), y0 - 12 + k * 3), (32 + s * (26 + k), 50)], fill=leg, width=2)
    d.ellipse([20, 22, 44, 46], fill=glass)  # abdomen
    d.polygon([(32, 26), (38, 34), (32, 42), (26, 34)], fill=(120, 230, 255, 255))
    d.ellipse([24, 10, 40, 26], fill=glass)
    d.line([27, 13, 31, 12], fill=hi)
    for x, y in ((28, 17), (32, 16), (36, 17), (30, 21), (34, 21), (26, 20), (38, 20)):
        eye(d, x, y, 1, (255, 60, 120, 255), (255, 60, 120, 255))
    d.polygon([(27, 10), (29, 4), (32, 8), (35, 4), (37, 10)], fill=(200, 240, 255, 255))
    return outline(im)


def the_boil():
    im, d = new()
    rnd = random.Random(8)
    d.ellipse([8, 14, 56, 50], fill=(190, 60, 40, 255))
    d.ellipse([12, 16, 50, 40], fill=(225, 90, 50, 255))
    for _ in range(14):
        x, y, r = rnd.randint(14, 50), rnd.randint(18, 46), rnd.randint(2, 4)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(250, 170, 90, 255))
        d.point([x - 1, y - 1], fill=(255, 240, 200, 255))
    eye(d, 26, 28, 3, (255, 250, 200, 255)); eye(d, 38, 26, 2, (255, 250, 200, 255))
    d.arc([24, 32, 42, 42], 10, 170, fill=(90, 20, 20, 255), width=2)
    for x in (18, 32, 46):
        d.line([(x, 12), (x - 2, 7), (x + 1, 2)], fill=(230, 230, 240, 150), width=2)
    return outline(im)


def ossuary():
    im, d = new()
    bone, sh = (232, 222, 196, 255), (180, 168, 140, 255)
    d.line([32, 18, 32, 46], fill=bone, width=3)
    for k in range(5):
        y = 22 + k * 5
        d.arc([16, y - 4, 48, y + 8], 200, 340, fill=bone, width=2)
    d.line([20, 46, 14, 51], fill=bone, width=3); d.line([44, 46, 50, 51], fill=bone, width=3)
    d.line([18, 22, 6, 34], fill=bone, width=3); d.line([46, 22, 58, 34], fill=bone, width=3)
    d.ellipse([2, 32, 10, 40], fill=sh); d.ellipse([54, 32, 62, 40], fill=sh)
    d.ellipse([22, 0, 42, 18], fill=bone)
    d.ellipse([26, 6, 31, 11], fill=INKC); d.ellipse([33, 6, 38, 11], fill=INKC)
    d.point([28, 8], fill=(255, 70, 70, 255)); d.point([35, 8], fill=(255, 70, 70, 255))
    for x in range(27, 38, 2):
        d.line([x, 14, x, 16], fill=INKC)
    return outline(im)


def the_maw():
    im, d = new()
    def mouth(x, y, r):
        d.ellipse([x - r, y - r // 2, x + r, y + r // 2 + 2], fill=(200, 80, 110, 255))
        d.ellipse([x - r + 2, y - r // 2 + 2, x + r - 2, y + r // 2], fill=(70, 10, 30, 255))
        for k in range(-r + 3, r - 2, 3):
            d.polygon([(k + x, y - r // 2 + 2), (k + x + 1, y - r // 2 + 5), (k + x + 2, y - r // 2 + 2)], fill=(245, 240, 220, 255))
            d.polygon([(k + x, y + r // 2), (k + x + 1, y + r // 2 - 3), (k + x + 2, y + r // 2)], fill=(245, 240, 220, 255))
    mouth(32, 26, 16); mouth(12, 10, 8); mouth(52, 12, 8); mouth(14, 44, 7); mouth(52, 42, 8)
    return outline(im)


def sleeper():
    im, d = new()
    bone, flesh = (200, 190, 200, 255), (140, 60, 80, 255)
    d.rectangle([0, 38, 63, 51], fill=(60, 20, 30, 255))  # rising from the crack
    d.polygon([(6, 51), (14, 26), (50, 26), (58, 51)], fill=flesh)
    d.ellipse([12, 2, 52, 38], fill=bone)
    d.ellipse([16, 6, 48, 30], fill=(220, 212, 220, 255))
    eye(d, 24, 16, 5, (255, 80, 60, 255)); eye(d, 40, 16, 5, (255, 80, 60, 255))
    for x, y in ((32, 9), (18, 26), (46, 26), (32, 24)):
        eye(d, x, y, 2, (255, 200, 60, 255))
    for x in range(22, 43, 3):
        d.polygon([(x, 31), (x + 1, 35), (x + 2, 31)], fill=(250, 245, 230, 255))
    for s in (-1, 1):  # tentacles
        d.line([(32 + s * 18, 34), (32 + s * 26, 24), (32 + s * 30, 10)], fill=flesh, width=3)
    return outline(im)


GUARDIANS = [
    ("SHALLOWS", "KING CRAB", king_crab), ("KELP FOREST", "KELP WITCH", kelp_witch),
    ("CORAL REEF", "MANTIS KING", mantis_king), ("TWILIGHT", "GLOOM RAY", gloom_ray),
    ("THE WRECK", "GHOST SHIP", ghost_ship), ("THE ABYSS", "THE GULPER", gulper),
    ("CRYSTAL CAVES", "GLASS SPIDER QUEEN", spider_queen), ("VENT FIELDS", "THE BOIL", the_boil),
    ("BONE YARD", "THE OSSUARY", ossuary), ("THE TRENCH", "THE MAW", the_maw), ("THE FLOOR", "THE SLEEPER", sleeper),
]


# ---- the Admiral, the gunboat, the spawn
ADMIRAL = [  # a walrus admiral, front view (critter style like the island folk)
    "....kkkkkkkk....",
    "..kkbbbbbbbbkk..",
    ".kbbbbggbbbbbbk.",
    "kbbbbbbbbbbbbbbk",
    ".kkkkkkkkkkkkkk.",
    "..kssssssssssk..",
    ".ksssskkssssssk.",
    ".kssspkksswwssk.",
    ".ksssssssssssk..",
    "ksswwwwsswwwwssk",
    "ksswiwwsswwiwssk",
    ".kswiwwkkwwiwsk.",
    "..kwiwnnnnwiwk..",
    ".knnnnngnnnnnnk.",
    "knnnnnngnnnnnnnk",
    "knnynnngnnnnynnk",
    ".knnnnngnnnnnnk.",
    "..kkk......kkk..",
]
APAL = {"k": INK, "b": (40, 44, 80, 255), "g": (250, 206, 70, 255), "s": (150, 110, 90, 255),
        "p": (20, 16, 24, 255), "w": (240, 236, 226, 255), "i": (255, 252, 240, 255),
        "n": (44, 60, 110, 255), "y": (250, 206, 70, 255)}


def rows_img(rows, pal):
    im = Image.new("RGBA", (max(map(len, rows)), len(rows)))
    p = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal:
                p[x, y] = pal[c]
    return im


def gunboat():
    im = Image.new("RGBA", (50, 26)); d = ImageDraw.Draw(im)
    d.polygon([(0, 14), (50, 14), (44, 24), (6, 24)], fill=(70, 74, 86, 255), outline=INK)
    d.line([2, 16, 48, 16], fill=(120, 124, 136, 255))
    for x in range(8, 44, 6):
        d.point((x, 20), fill=(160, 164, 176, 255))
    d.rectangle([16, 6, 30, 14], fill=(90, 94, 106, 255), outline=INK)
    d.rectangle([18, 8, 21, 11], fill=(255, 230, 140, 255))
    d.rectangle([33, 2, 37, 14], fill=(50, 50, 60, 255), outline=INK)
    d.rectangle([33, 2, 37, 4], fill=(200, 60, 60, 255))
    d.line([4, 11, 14, 12], fill=(40, 40, 50, 255), width=3)  # cannon
    d.line([40, 14, 46, 2], fill=(110, 80, 50, 255))
    d.polygon([(46, 2), (49, 4), (46, 6)], fill=(230, 60, 60, 255))
    return im


def spawn_egg(big=False):
    s = 2 if big else 1
    im = Image.new("RGBA", (14 * s, 14 * s)); d = ImageDraw.Draw(im)
    d.ellipse([0, 0, 13 * s, 13 * s], fill=(255, 60, 80, 60))
    d.ellipse([3 * s, 2 * s, 10 * s, 11 * s], fill=(180, 30, 60, 255), outline=INK)
    d.ellipse([4 * s, 3 * s, 8 * s, 8 * s], fill=(240, 90, 110, 255))
    d.point((5 * s, 4 * s), fill=(255, 220, 220, 255))
    d.point((7 * s, 9 * s), fill=(90, 10, 30, 255)); d.point((6 * s, 6 * s), fill=(90, 10, 30, 255))
    return im




def pack():
    items = []
    for i in range(len(TOWERS)):
        for lv in (1, 2, 3):
            items.append(("t%d_%d" % (i, lv), tower(i, lv)))
        items.append(("t%d_A" % i, tower(i, 3, "A")))
        items.append(("t%d_B" % i, tower(i, 3, "B")))
    for i, (zone, name, fn) in enumerate(GUARDIANS):
        items.append(("g%d" % i, fn()))
    items.append(("admiral", outline(rows_img(ADMIRAL, APAL))))
    items.append(("gunboat", gunboat()))
    items.append(("egg", spawn_egg()))
    W = 512
    x = y = rowh = 0
    pos = {}
    for k, im in items:
        if x + im.width > W:
            x, y, rowh = 0, y + rowh + 1, 0
        pos[k] = [x, y, im.width, im.height]
        x += im.width + 1; rowh = max(rowh, im.height)
    sheet = Image.new("RGBA", (W, y + rowh + 1))
    for k, im in items:
        sheet.alpha_composite(im, tuple(pos[k][:2]))
    here = os.path.dirname(os.path.abspath(__file__))
    sheet.save(os.path.join(here, "..", "assets", "siege.png"), optimize=True)
    with open(os.path.join(here, "..", "siege_art.js"), "w") as f:
        f.write("// Generated by tools/siege_art.py. Do not edit by hand.\n")
        f.write("const SIEGE_ART = " + json.dumps(pos, separators=(",", ":")) + ";\n")
    print("siege.png", sheet.size, len(items), "sprites")


if __name__ == "__main__":
    pack()
