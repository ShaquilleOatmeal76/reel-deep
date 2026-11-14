"""The Flipside: zones, creatures and their pixel art, and the monster versions of the characters.

Used by web_export.py. Like the topside species list, CREATURES is append-only: saves refer to creature ids.
Names come from the approved list (claude/Reel Deep - Flipside creature names.md in the project). Drop 4 (the Crossing)
draws the first three zones; the other seven zones' creatures are added with the endgame (drop 5).
"""
import random
import numpy as np
import pygame

# Flipside zones, measured in metres up from the crack. Each mirrors a topside zone of the same length,
# so the Flipside at height f sits where the topside is at depth 1160 - f.
ZONES = [("THE SEAM", 0, 50), ("THE MAW", 50, 200), ("MARROW FIELDS", 200, 330), ("THE BOIL", 330, 460), ("THE HOLLOWS", 460, 590),
         ("THE SINK", 590, 720), ("THE HULK", 720, 840), ("THE MURK", 840, 960), ("THE TANGLE", 960, 1050), ("MIRROR SHALLOWS", 1050, 1160)]
CROSSING_M = 330            # the Crossing climbs the first three zones; your other self waits at the top

PAL = {"w": (236, 228, 210), "s": (206, 196, 176), "S": (150, 138, 120), "p": (226, 156, 166), "m": (200, 100, 122), "r": (176, 42, 62),
       "d": (96, 22, 42), "v": (146, 32, 62), "y": (255, 226, 80), "k": (30, 10, 20), "g": (130, 200, 100), "b": (74, 52, 62),
       "c": (212, 216, 224), "o": (126, 132, 154), "t": (255, 204, 64), "l": (196, 164, 236)}

# (id, name, zone, (min lb, max lb), speed, spawn weight, legendary, pixel rows)
CREATURES = [
    # ---- 1. The Seam: pale things that live in the crack
    ("crawler", "CRACK CRAWLER", 0, (2, 5), 14, 6, False, ["..c..c..c..c..", ".cccccccccccyk", "coccocccoccccy", ".cccccccccccyk", "..c..c..c..c.."]),
    ("gapgrub", "GAP GRUB", 0, (1, 4), 8, 6, False, ["..ccccc..", ".cocococ.", "cccccccky", "cocococcc", ".ccccccc."]),
    ("skitter", "SEAM SKITTER", 0, (2, 6), 20, 5, False, ["c.c...c.c", ".c.ccc.c.", "..cyyyc..", ".c.ccc.c.", "c.c...c.c"]),
    ("palething", "PALE THING", 0, (4, 9), 10, 4, False, ["..ccccc..", ".ccccccc.", "ccykcykcc", "ccccccccc", "c.cc.cc.c", "..c...c.."]),
    ("hingemouth", "HINGE MOUTH", 0, (6, 12), 6, 3, False, ["oooooooo.", "occccccco", "wkwkwkwk.", "kwkwkwkw.", "occccccco", "oooooooo."]),
    ("stitcher", "THE STITCHER", 0, (60, 90), 16, 0, True, ["..................yy", "r...r...r..cccccccyk", ".r.r.r.r.rccooooocc.", "..r...r...ccccccccy.", "............c.c.c..."]),
    ("keyhole", "THE KEYHOLE", 0, (80, 120), 4, 0, True, ["....ooooo....", "...ocwwwco...", "..ocwwwwwco..", "..cwwkkkwwc..", "..cwwkykwwc..", "..cwwkkkwwc..", "..ocwwwwwco..",
                                                          "...occccco...", "....ocwco....", "...occccco...", "..ooooooooo.."]),
    # ---- 2. The Maw: mouths and teeth
    ("tootheel", "TOOTH-EEL", 1, (8, 16), 26, 6, False, [".w.w.w.w.w.w.w.w..", "rrrrrrrrrrrrrrrrry", "dvdvdvdvdvdvdvrrrk", ".w.w.w.w.w.w.w.w.."]),
    ("looselips", "LOOSE LIPS", 1, (5, 10), 14, 5, False, ["..rrrrrrr..", ".rmmmmmmmr.", "rwkwkwkwkwr", "rk.......kr", "rwkwkwkwkwr", ".rmmmmmmmr.", "..rrrrrrr.."]),
    ("gumworm", "GUMWORM", 1, (3, 7), 12, 6, False, ["..w..w..w..", ".ppppppppmy", "ppmpmpmpmpk", ".pppppppp.."]),
    ("molarmite", "MOLAR MITE", 1, (2, 5), 18, 6, False, [".wwww.", "wwwwww", "wwSwSw", "wwwwww", "w.ww.w", "m.mm.m"]),
    ("gnasher", "GNASHER", 1, (10, 18), 22, 4, False, ["..rrrrr..", ".rrrrrryr", "rrwkwkwkr", "rk.....kd", "rrwkwkwkr", ".rrrrrrr.", "..r...r.."]),
    ("droolray", "DROOL RAY", 1, (15, 25), 16, 3, False, ["r.......r", "rrr...rrr", "rrrrrrrrr", ".rrwkwrr.", "..rrrrr..", "...g.g...", "...g....."]),
    ("fangflounder", "FANG FLOUNDER", 1, (8, 14), 12, 4, False, [".mmmmmmmmy.", "mmmmmmmmmmk", "mpmpmpmmwkw", ".mmmmmmmw.w"]),
    ("sparejaw", "SPARE JAW", 1, (4, 8), 10, 4, False, ["w.w.w.w.....", "ssssssssss..", "s........ss.", "ss........ss"]),
    ("swallower", "THE SWALLOWER", 1, (120, 180), 14, 0, True, ["...rrrrrrrrrrr....", "..rrrrrrrrrrrrry..", ".rrwwkwwkwwkwwrrk.", "rrk..........krrr.", "rrk....dd....krrrr", "rrk..........krrr.",
                                                                 ".rrwwkwwkwwkwwrrk.", "..rrrrrrrrrrrrr...", "...rrrrrrrrrrr...."]),
    ("underbite", "THE UNDERBITE", 1, (90, 140), 18, 0, True, ["..mmmmmmmm..", ".mmmmmmmmmy.", "mmmmmmmmmmmk", "mmmmmmmmmw.w", "mmmmmmmmmmww", "mpmpmpmmmmmm", ".mmmmmmmmmm."]),
    ("overbite", "KING OVERBITE", 1, (140, 200), 12, 0, True, ["...t.t.t...", "...ttttt...", "..rrrrrrr..", ".rrrrrrryr.", "rrrrrrrrrrk", "rrrwwwwwwwr", "rrrw.w.w.w.", ".rrrrrrr...", "..r...r...."]),
    # ---- 3. Marrow Fields: bones that walked off
    ("ribcage", "RIBCAGE WALKER", 2, (12, 20), 10, 5, False, ["..ssssss..", ".s.s.s.s.s", "s.s.s.s.s.", ".s.s.s.s.s", "..ssssss..", "..s....s..", ".s....s..."]),
    ("marrowworm", "MARROW WORM", 2, (3, 6), 14, 6, False, ["..mmmmmmmmmy", ".mpmpmpmpmmy", "mmmmmmmmmmm.", "m.m.m.m.m..."]),
    ("knucklecrab", "KNUCKLE CRAB", 2, (6, 11), 12, 5, False, ["s.s....s.s", ".ss....ss.", "..ssssss..", ".sSsSsSss.", "ssssyyssss", ".s.s..s.s."]),
    ("spinesnake", "SPINE SNAKE", 2, (10, 18), 24, 4, False, ["s.s.s.s.s.s.s...", "ssssssssssssssyy", "SsSsSsSsSsSsssss", "s.s.s.s.s.s.s..."]),
    ("hiphopper", "HIP HOPPER", 2, (8, 14), 18, 4, False, [".ssssss.", "ss.ss.ss", "s..ss..s", ".ssssss.", ".s....s.", "s......s"]),
    ("skullsnail", "SKULL SNAIL", 2, (5, 9), 6, 5, False, ["..sssss...", ".sskskss..", ".sssssss..", "..s.s.s...", "pppppppppy"]),
    ("femurfish", "FEMUR FISH", 2, (9, 15), 20, 4, False, ["ss........ss", "sssssssssssy", "sssssssssssk", "ss........ss"]),
    ("toepicker", "TOE PICKER", 2, (2, 5), 16, 5, False, [".ss..", "sssy.", ".sss.", ".s.s.", "s..s.", "s...s"]),
    ("bonemoth", "BONE MOTH", 2, (1, 4), 22, 5, False, ["s.s...s.s", "sSs.s.sSs", "sssssssss", ".s.sys.s.", "....s...."]),
    ("ossuary", "THE OSSUARY", 2, (150, 220), 5, 0, True, ["SSSSSSSSSSSSSS", "SsssssssssssSS", "SskskSskskSskS", "SsssssSsssssSs", "SskskSskskSskS", "SsssssSsssssSs", "SskskSskskSskS",
                                                         "SSSSSSSSSSSSSS", ".S..........S."]),
    ("stilts", "OLD STILTS", 2, (110, 170), 8, 0, True, ["....ssssss....", "...ssykssyks...", "...ssssssss....", "....s.s.s.s....", "....ssssss.....", "....s....s.....", "...s......s....",
                                                       "...s......s....", "..s........s...", "..s........s...", ".s..........s..", ".s..........s.."]),
    # ---- outside the 123: junk and the mythic (spawn weight 0: placed specially)
    ("ftooth", "LOOSE TOOTH", 1, (1, 1), 0, 0, False, [".www.", "wwwww", "wwwww", "ww.ww", "w...w", "r...r"]),
    ("hairball", "WET HAIRBALL", 0, (1, 1), 0, 0, False, ["..bbbb..", ".bbkbbbb", "bbbbbkbb", "bkbbbbbb", ".bbbbkb.", "..g..g..", "..g....."]),
    ("prettyone", "THE PRETTY ONE", 2, (40, 40), 18, 0, False, ["...tt.....", "..twwt..ll", ".twwwwt.ll", "twwwkwwtll", ".twwwwt.ll", "..twwt..ll", "...tt....."]),
]
JUNK = ("ftooth", "hairball")
MYTHIC = "prettyone"
LURKER = ["...mmmmmmm...", "..mpmmmmmpm..", ".mmmmyymmmmm.", "mmmmmmmmmmmmm", "mvmvmvmvmvmvm", "v..v..v..v..v", ".v..v..v..v..", "v..v.....v..v", ".v.......v..."]   # the flesh jelly: touch it and the trip ends


def rows_surface(pg, rows, outlined):
    """Pixel rows -> an outlined surface, in the same style as the topside fish."""
    from hopper import from_rows  # noqa: E402  (the project's own helpers)
    return outlined(pg, from_rows(pg, rows, PAL))


def monsterify(surf, seed, eyes=3, teeth=True):
    """Your character, gone wrong: sickly reddish colours (but still recognisable), extra eyes, a fanged mouth, drips."""
    rng = random.Random(seed)
    w, h = surf.get_size()
    rgb = pygame.surfarray.array3d(surf).transpose(1, 0, 2).astype(float)       # -> [y][x][c]
    alpha = pygame.surfarray.array_alpha(surf).T
    out = np.zeros((h + 3, w, 4), np.uint8)
    out[:h, :, :3] = rgb.clip(0, 255).astype(np.uint8)
    out[:h, :, 3] = alpha
    a = out[..., 3] > 0
    lum = out[..., :3].astype(float) @ [0.3, 0.59, 0.11]
    outline = a & (lum < 45)
    body = a & ~outline
    c = out[..., :3].astype(float)
    grey = (c @ [0.3, 0.59, 0.11])[..., None]
    c = c * 0.62 + grey * 0.38                       # keep most of its own colour, so you can tell who it is
    c = (c * 0.8 + np.array([150, 50, 70]) * 0.2) * 0.92
    out[..., :3] = np.where(body[..., None], c.clip(0, 255), out[..., :3]).astype(np.uint8)
    ys, xs = np.nonzero(body)
    if len(ys):
        top, bot = ys.min(), ys.max()
        if teeth:                                    # a fanged mouth across the middle
            r = top + int((bot - top) * 0.55)
            cols = [x for x in range(w) if body[r, x]]
            if len(cols) >= 4:
                x0, x1 = cols[0] + 1, cols[-1] - 1
                for x in range(x0, x1 + 1):
                    out[r, x] = (40, 8, 18, 255)
                    if (x - x0) % 2 == 0 and r + 1 < h and a[r + 1, x]:
                        out[r + 1, x] = (236, 230, 210, 255)
                    if (x - x0) % 2 == 1 and body[r - 1, x]:
                        out[r - 1, x] = (236, 230, 210, 255)
        cand = [(y, x) for y, x in zip(ys, xs) if y < top + (bot - top) * 0.5 and all(
            0 <= y + dy < h and 0 <= x + dx < w and body[y + dy, x + dx] for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)))]
        rng.shuffle(cand)
        placed = []
        for y, x in cand:                            # too many eyes
            if len(placed) >= eyes:
                break
            if all(abs(y - py) + abs(x - px) >= 3 for py, px in placed):
                out[y, x] = (255, 226, 80, 255)
                placed.append((y, x))
                if y + 1 < h and body[y + 1, x]:
                    out[y + 1, x] = (110, 20, 30, 255)
        bottoms = [(x, max(y for y in range(h) if a[y, x])) for x in range(w) if a[:h, x].any()]
        rng.shuffle(bottoms)
        for x, y in bottoms[:3]:                     # something dripping
            for k in range(1, rng.randint(2, 3) + 1):
                if y + k < h + 3:
                    out[y + k, x] = (120, 200, 90, 255) if k < 3 else (90, 160, 70, 255)
    s = pygame.Surface((w, h + 3), pygame.SRCALPHA)
    px = pygame.surfarray.pixels3d(s)
    pa = pygame.surfarray.pixels_alpha(s)
    px[...] = out[..., :3].transpose(1, 0, 2)
    pa[...] = out[..., 3].T
    del px, pa
    return s
