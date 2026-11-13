"""
CRITTER HOP - cartoony pixel-art road crosser for the FLAPPI arcade.

  tap = hop forward        swipe = hop left / right / back
  arrows + space work too  (one button: every press hops forward)

Cross roads, ride logs over rivers, beat the train, and keep moving or the
hawk gets you. The world changes every 40 rows: meadow, desert, snowfields,
neon city, then round again, faster.

Rendered at 120x200 and scaled 4x.
"""
import os, sys, math, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import arcade_core as ac
from arcade_core import lerp, lerp_col, clamp

LW, LH, PX = 120, 200, 4
T = 12                       # tile size
COLS = LW // T
BIOME_LEN = 40
HOP_TIME = 0.12
INK = (26, 22, 40)           # outline colour
WHITE = (250, 250, 255)
GOLD = (255, 210, 70)
RED = (240, 80, 80)

# ------------------------------------------------------------------ critters
CRITTERS = [
    {"name": "FOX", "blink": "d",
     "pal": {"o": (244, 134, 52), "d": (196, 92, 34), "w": (255, 246, 232), "k": (44, 34, 44), "e": (30, 24, 36)},
     "front": (["..o......o..", ".oko....oko.", ".oooooooooo.", "oooooooooooo", "oooeooooeooo", "owwewwwwewwo",
                ".wwwwkkwwww.", "..wwwwwwww..", "..oooooooo..", ".oowwwwwwoo.", ".oowwwwwwoo."],
               "..kk....kk..", ".kk......kk."),
     "back": (["..o......o..", ".odo....odo.", ".oooooooooo.", "oooooooooooo", "oooooooooooo", "oodoooooodoo",
               ".oooooooooo.", "..oooooooo.w", "..oooooooodw", ".ooooooooodd", ".oooooooooo."],
              "..kk....kk..", ".kk......kk."),
     "side": (["....o...o...", "...oko.oko..", "...ooooooo..", "..ooooooooo.", "..ooooooeoo.", "..oooowwwwwk",
               "..ooowwwww..", "w..oooooo...", "ww.oooooo...", "woooowwoo...", ".oooowwoo..."],
              "...kk..kk...", "..kk....kk..")},
    {"name": "FROG", "blink": "m",
     "pal": {"g": (96, 204, 84), "l": (208, 244, 156), "w": (255, 255, 255), "e": (30, 24, 36), "m": (52, 132, 56), "d": (64, 164, 64)},
     "front": ([".gg......gg.", "gwwg....gwwg", "gweg....gewg", "gggggggggggg", "gggggggggggg", "gmmmmmmmmmmg",
                ".gggggggggg.", "..gllllllg..", ".ggllllllgg.", ".ggllllllgg.", "ggg.gggg.ggg"],
               "gg........gg", "g.g......g.g"),
     "back": ([".gg......gg.", "gggg....gggg", "gggg....gggg", "gggggggggggg", "ggdggggggdgg", "gggggddggggg",
               ".gggggggggg.", "..gggggggg..", ".ggdggggdgg.", ".gggggggggg.", "ggg.gggg.ggg"],
              "gg........gg", "g.g......g.g"),
     "side": (["......ggg...", ".....gwwg...", ".....gweg...", "..gggggggggg", ".ggggggggggg", ".gggggmmmmmm",
               ".ggggggggg..", ".gglllllg...", "ggglllllg...", "gggglllgg...", "gg.ggg.gg..."],
              "ggg....gg...", "g.gg....gg..")},
    {"name": "PENGUIN", "blink": "w",
     "pal": {"b": (46, 52, 84), "w": (255, 255, 255), "y": (255, 164, 44), "e": (30, 24, 36)},
     "front": (["....bbbb....", "...bbbbbb...", "..bbbbbbbb..", "..bwwbbwwb..", "..bwewwewb..", "..bwwyywwb..",
                ".bbwwwwwwbb.", "bbbwwwwwwbbb", "bb.wwwwww.bb", "...wwwwww...", "...bwwwwb..."],
               "..yyy..yyy..", ".yyy....yyy."),
     "back": (["....bbbb....", "...bbbbbb...", "..bbbbbbbb..", "..bbbbbbbb..", "..bbbbbbbb..", "..bbbbbbbb..",
               ".bbbbbbbbbb.", "bbbbbbbbbbbb", "bb.bbbbbb.bb", "...bbbbbb...", "...bbbbbb..."],
              "..yyy..yyy..", ".yyy....yyy."),
     "side": (["....bbbb....", "...bbbbbb...", "...bbbbwwb..", "...bbbwwew..", "...bbbwwwyyy", "...bbbwwwb..",
               "..bbbwwwww..", "..bbbwwwww..", "..bbbwwwww..", "...bbwwwww..", "...bbbwwwb.."],
              "....yyy.yy..", "...yyy..yyy.")},
]
HAWK = ["kk...........kk", ".kkk.......kkk.", "..kkkkkkkkkkk..", "....kkwkwkk....", ".....kkykk.....", "......kkk......"]
HAWK_PAL = {"k": (120, 78, 46), "w": (255, 255, 255), "y": (255, 190, 60)}

BIOMES = [
    {"name": "MEADOW", "grass": [(124, 204, 92), (112, 192, 84)], "tuft": (84, 160, 70), "dot": [(255, 240, 120), (255, 150, 170), WHITE],
     "road": (74, 76, 94), "water": (72, 152, 232), "ripple": (150, 205, 250), "obs": ["tree", "rock", "bush"],
     "cars": [("car", (236, 84, 84)), ("car", (80, 150, 240)), ("car", (250, 200, 70)), ("truck", (240, 240, 245)), ("car", (150, 110, 220))],
     "float": "log", "train": ((220, 70, 70), (240, 232, 214))},
    {"name": "DESERT", "grass": [(238, 204, 134), (230, 194, 124)], "tuft": (206, 166, 100), "dot": [(250, 226, 170), (196, 150, 90)],
     "road": (98, 84, 80), "water": (56, 176, 182), "ripple": (150, 232, 226), "obs": ["cactus", "boulder", "skull"],
     "cars": [("buggy", (240, 120, 50)), ("truck", (200, 150, 90)), ("car", (240, 232, 214)), ("buggy", (90, 170, 160))],
     "float": "log", "train": ((120, 90, 60), (214, 170, 110))},
    {"name": "SNOWFIELDS", "grass": [(238, 246, 254), (224, 236, 250)], "tuft": (190, 210, 236), "dot": [(255, 255, 255), (170, 200, 240)],
     "road": (92, 100, 122), "water": (96, 170, 236), "ripple": (214, 238, 255), "obs": ["pine", "snowman", "icerock"],
     "cars": [("plow", (250, 170, 40)), ("car", (220, 70, 80)), ("truck", (70, 120, 200)), ("car", (60, 170, 150))],
     "float": "ice", "train": ((60, 110, 190), (220, 232, 246))},
    {"name": "NEON CITY", "grass": [(70, 76, 108), (62, 68, 98)], "tuft": (48, 52, 80), "dot": [(90, 98, 134)],
     "road": (34, 36, 54), "water": (30, 52, 120), "ripple": (90, 220, 255), "obs": ["lamp", "hydrant", "planter"],
     "cars": [("taxi", (255, 206, 50)), ("bus", (255, 96, 60)), ("car", (60, 220, 240)), ("car", (255, 255, 255)), ("bus", (90, 230, 140))],
     "float": "barge", "train": ((255, 190, 40), (70, 76, 108))},
]


def outlined(pg, s, col=INK):
    """Give a sprite a 1px cartoon outline."""
    w, h = s.get_size()
    out = pg.Surface((w + 2, h + 2), pg.SRCALPHA)
    sil = pg.mask.from_surface(s).to_surface(setcolor=col + (255,), unsetcolor=(0, 0, 0, 0))
    for dx, dy in ((0, 1), (2, 1), (1, 0), (1, 2)):
        out.blit(sil, (dx, dy))
    out.blit(s, (1, 1))
    return out


def from_rows(pg, rows, pal):
    s = pg.Surface((len(rows[0]), len(rows)), pg.SRCALPHA)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in pal:
                s.set_at((x, y), pal[ch])
    return s


def dk(c, k=0.3):
    return lerp_col(c, (0, 0, 0), k)


def lt(c, k=0.35):
    return lerp_col(c, (255, 255, 255), k)


class Art:
    """Every sprite in the game, built once."""

    def __init__(self, pg):
        self.pg = pg
        self.cache = {}
        self.critters = []
        for c in CRITTERS:
            fr = {}
            for view in ("front", "back", "side"):
                rows, stand, jump = c[view]
                for name, legs in (("stand", stand), ("jump", jump)):
                    fr[(view, name)] = outlined(pg, from_rows(pg, rows + [legs], c["pal"]))
                blink = [r.replace("e", c["blink"]) for r in rows]
                fr[(view, "blink")] = outlined(pg, from_rows(pg, blink + [stand], c["pal"]))
            for k in list(fr):
                if k[0] == "side":
                    fr[("left", k[1])] = pg.transform.flip(fr[k], True, False)
            self.critters.append(fr)
        self.hawk = outlined(pg, from_rows(pg, HAWK, HAWK_PAL))
        self.shadow = pg.Surface((10, 4), pg.SRCALPHA)
        pg.draw.ellipse(self.shadow, (0, 0, 0, 70), (0, 0, 10, 4))

    def get(self, key, maker):
        s = self.cache.get(key)
        if s is None:
            s = self.cache[key] = maker()
        return s

    # ------------------------------------------------------------ obstacles
    def obstacle(self, kind):
        return self.get(("obs", kind), lambda: outlined(self.pg, getattr(self, "_" + kind)()))

    def _surf(self, w, h):
        return self.pg.Surface((w, h), self.pg.SRCALPHA)

    def _tree(self):
        s = self._surf(10, 16)
        s.fill((126, 84, 50), (4, 11, 3, 5)); s.fill((96, 62, 38), (6, 11, 1, 5))
        s.fill((70, 170, 78), (0, 2, 10, 10)); s.fill((104, 206, 100), (0, 0, 10, 4))
        s.fill((50, 136, 64), (8, 4, 2, 8)); s.fill((50, 136, 64), (0, 10, 10, 2))
        s.fill((140, 228, 124), (1, 1, 3, 1)); s.fill((255, 120, 120), (2, 6, 1, 1)); s.fill((255, 120, 120), (6, 8, 1, 1))
        return s

    def _bush(self):
        s = self._surf(10, 8)
        s.fill((70, 170, 78), (1, 2, 8, 6)); s.fill((104, 206, 100), (2, 0, 6, 3)); s.fill((104, 206, 100), (0, 3, 10, 2))
        s.fill((50, 136, 64), (0, 6, 10, 2)); s.fill((255, 240, 120), (3, 2, 1, 1)); s.fill((255, 240, 120), (7, 4, 1, 1))
        return s

    def _rock(self, base=(150, 156, 172)):
        s = self._surf(10, 8)
        s.fill(base, (1, 2, 8, 6)); s.fill(base, (0, 4, 10, 4)); s.fill(lt(base), (2, 1, 5, 2)); s.fill(lt(base), (1, 3, 3, 1))
        s.fill(dk(base), (0, 6, 10, 2)); s.fill(dk(base), (7, 3, 2, 3))
        return s

    def _boulder(self):
        return self._rock((206, 130, 84))

    def _icerock(self):
        return self._rock((160, 206, 244))

    def _cactus(self):
        s = self._surf(10, 15)
        g, h = (74, 170, 96), (120, 210, 128)
        s.fill(g, (3, 0, 4, 15)); s.fill(h, (3, 0, 1, 15)); s.fill(dk(g, 0.25), (6, 1, 1, 14))
        s.fill(g, (0, 5, 3, 2)); s.fill(g, (0, 2, 2, 4)); s.fill(g, (7, 8, 3, 2)); s.fill(g, (8, 4, 2, 5))
        s.fill((255, 130, 170), (4, 0, 2, 1)); s.fill(h, (0, 2, 1, 3)); s.fill(h, (8, 4, 1, 3))
        return s

    def _skull(self):
        s = self._surf(8, 7)
        b = (244, 236, 214)
        s.fill(b, (1, 0, 6, 5)); s.fill(b, (0, 1, 8, 3)); s.fill(b, (2, 5, 4, 2))
        s.fill(INK, (1, 2, 2, 2)); s.fill(INK, (5, 2, 2, 2)); s.fill(INK, (3, 5, 1, 2)); s.fill(dk(b, 0.2), (2, 4, 4, 1))
        return s

    def _pine(self):
        s = self._surf(10, 17)
        g, d = (40, 130, 100), (26, 96, 80)
        s.fill((110, 76, 50), (4, 13, 2, 4))
        for i, (w, y) in enumerate(((4, 0), (6, 3), (8, 6), (10, 9))):
            s.fill(g, ((10 - w) // 2, y, w, 4)); s.fill(d, ((10 - w) // 2, y + 3, w, 1))
            s.fill(WHITE, ((10 - w) // 2 + 1, y, w - 2, 1)); s.fill(WHITE, (4, y + 1, 1 + i % 2, 1))
        return s

    def _snowman(self):
        s = self._surf(9, 14)
        pg = self.pg
        pg.draw.circle(s, WHITE, (4, 10), 4); pg.draw.circle(s, WHITE, (4, 4), 3)
        s.fill((214, 228, 246), (2, 12, 6, 2)); s.fill(INK, (3, 3, 1, 1)); s.fill(INK, (5, 3, 1, 1))
        s.fill((255, 150, 40), (4, 5, 3, 1)); s.fill((220, 70, 80), (1, 7, 7, 1)); s.fill(INK, (2, 0, 5, 2)); s.fill(INK, (1, 1, 7, 1))
        return s

    def _lamp(self):
        s = self._surf(8, 18)
        s.fill((40, 44, 66), (3, 4, 2, 14)); s.fill((30, 32, 50), (2, 16, 4, 2))
        s.fill((255, 236, 150), (1, 0, 6, 4)); s.fill((255, 255, 220), (2, 1, 4, 2)); s.fill((40, 44, 66), (1, 0, 6, 1))
        return s

    def _hydrant(self):
        s = self._surf(7, 9)
        r = (236, 70, 70)
        s.fill(r, (1, 2, 5, 7)); s.fill(r, (0, 4, 7, 2)); s.fill(lt(r), (2, 0, 3, 2)); s.fill(lt(r), (1, 2, 1, 6)); s.fill(dk(r), (5, 3, 1, 6))
        s.fill((230, 230, 240), (3, 4, 1, 2))
        return s

    def _planter(self):
        s = self._surf(10, 9)
        s.fill((120, 126, 150), (0, 4, 10, 5)); s.fill((150, 156, 180), (0, 4, 10, 1)); s.fill((90, 96, 120), (0, 8, 10, 1))
        s.fill((60, 200, 130), (1, 1, 8, 3)); s.fill((90, 240, 160), (2, 0, 3, 2)); s.fill((255, 90, 200), (6, 1, 1, 1)); s.fill((90, 220, 255), (3, 2, 1, 1))
        return s

    # ------------------------------------------------------------- vehicles
    def vehicle(self, kind, col, d):
        def make():
            s = getattr(self, "_v_" + kind)(col)
            s = outlined(self.pg, s)
            return s if d > 0 else self.pg.transform.flip(s, True, False)
        return self.get(("veh", kind, col, d), make)

    def _wheels(self, s, xs, y):
        for x in xs:
            s.fill((30, 30, 44), (x, y, 4, 3)); s.fill((120, 124, 140), (x + 1, y + 1, 2, 1))

    def _v_car(self, c, w=20, sign=None):
        s = self._surf(w, 11)
        s.fill(lt(c, 0.25), (4, 0, w - 10, 5))                       # cabin
        s.fill((170, 226, 255), (5, 1, w - 12, 3)); s.fill(lt(c, 0.25), (4 + (w - 10) // 2, 1, 1, 3))
        s.fill(WHITE, (5, 1, 2, 1))
        s.fill(c, (0, 4, w, 5)); s.fill(lt(c), (0, 4, w, 1)); s.fill(dk(c), (0, 7, w, 2))
        s.fill((255, 240, 150), (w - 2, 5, 2, 2)); s.fill((220, 40, 60), (0, 5, 1, 2))
        if sign:
            s.fill(sign, (w // 2 - 3, 0, 5, 1))
        self._wheels(s, (2, w - 7), 8)
        return s

    def _v_taxi(self, c):
        s = self._v_car(c, 20, sign=WHITE)
        for x in range(4, 16, 2):
            s.fill(INK, (x, 6, 1, 1))
        return s

    def _v_buggy(self, c):
        s = self._surf(15, 10)
        s.fill((60, 60, 76), (4, 0, 7, 1)); s.fill((60, 60, 76), (4, 0, 1, 4)); s.fill((60, 60, 76), (10, 0, 1, 4))
        s.fill(c, (0, 3, 15, 4)); s.fill(lt(c), (0, 3, 15, 1)); s.fill(dk(c), (0, 6, 15, 1)); s.fill((255, 240, 150), (13, 4, 2, 2))
        self._wheels(s, (1, 10), 7)
        return s

    def _v_truck(self, c):
        s = self._surf(28, 12)
        box = (236, 236, 244) if c != (240, 240, 245) else (120, 180, 240)
        s.fill(box, (0, 0, 18, 9)); s.fill(lt(box), (0, 0, 18, 1)); s.fill(dk(box, 0.2), (0, 7, 18, 2)); s.fill(c, (2, 3, 14, 2))
        s.fill(c, (19, 2, 9, 7)); s.fill(lt(c), (19, 2, 9, 1)); s.fill(dk(c), (19, 7, 9, 2))
        s.fill((170, 226, 255), (22, 3, 5, 3)); s.fill(WHITE, (22, 3, 2, 1)); s.fill((255, 240, 150), (27, 6, 1, 2))
        self._wheels(s, (2, 12, 21), 9)
        return s

    def _v_plow(self, c):
        s = self._surf(26, 12)
        s.fill(c, (0, 2, 20, 7)); s.fill(lt(c), (0, 2, 20, 1)); s.fill(dk(c), (0, 7, 20, 2))
        s.fill((170, 226, 255), (12, 3, 6, 3)); s.fill(INK, (2, 4, 7, 1)); s.fill(INK, (2, 6, 7, 1))
        s.fill((255, 90, 60), (9, 0, 3, 2))
        s.fill((190, 200, 216), (21, 1, 3, 10)); s.fill((240, 244, 250), (23, 0, 3, 11)); s.fill((150, 160, 180), (20, 5, 2, 2))
        self._wheels(s, (2, 13), 9)
        return s

    def _v_bus(self, c):
        s = self._surf(34, 12)
        s.fill(c, (0, 0, 34, 9)); s.fill(lt(c), (0, 0, 34, 1)); s.fill(dk(c), (0, 7, 34, 2)); s.fill(WHITE, (0, 5, 34, 1))
        for x in range(2, 28, 6):
            s.fill((170, 226, 255), (x, 2, 4, 3)); s.fill(WHITE, (x, 2, 1, 1))
        s.fill((170, 226, 255), (29, 2, 4, 4)); s.fill((255, 240, 150), (33, 6, 1, 2))
        self._wheels(s, (3, 26), 9)
        return s

    def train(self, cols, d):
        def make():
            a, b = cols
            s = self._surf(170, 13)
            s.fill(a, (140, 0, 30, 10)); s.fill(lt(a), (140, 0, 30, 1)); s.fill(dk(a), (140, 8, 30, 2))
            s.fill((170, 226, 255), (158, 2, 9, 4)); s.fill(GOLD, (140, 4, 16, 1)); s.fill((255, 240, 150), (168, 7, 2, 2))
            s.fill((40, 44, 60), (146, 0, 4, 1))
            for i in range(5):
                x = i * 28
                s.fill(b, (x, 1, 26, 9)); s.fill(lt(b), (x, 1, 26, 1)); s.fill(dk(b), (x, 8, 26, 2)); s.fill(a, (x, 6, 26, 1))
                for wx in range(x + 3, x + 22, 6):
                    s.fill((170, 226, 255), (wx, 3, 4, 2))
                s.fill((40, 44, 60), (x + 26, 6, 2, 2))
            for x in list(range(3, 136, 28)) + list(range(19, 136, 28)) + [144, 160]:
                s.fill((30, 30, 44), (x, 10, 4, 3))
            s = outlined(self.pg, s)
            return s if d > 0 else self.pg.transform.flip(s, True, False)
        return self.get(("train", cols, d), make)

    def floater(self, kind, w):
        def make():
            s = self._surf(w, 9)
            if kind == "log":
                c = (156, 102, 58)
                s.fill(c, (0, 0, w, 9)); s.fill(lt(c, 0.25), (0, 0, w, 2)); s.fill(dk(c), (0, 7, w, 2))
                for x in range(6, w - 4, 9):
                    s.fill(dk(c, 0.22), (x, 3, 4, 1)); s.fill(dk(c, 0.22), (x + 3, 5, 3, 1))
                for x in (0, w - 3):
                    s.fill(dk(c, 0.2), (x, 0, 3, 9)); s.fill((226, 180, 120), (x + 1, 2, 1, 5))
            elif kind == "ice":
                c = (232, 246, 255)
                s.fill(c, (1, 0, w - 2, 9)); s.fill(c, (0, 1, w, 7)); s.fill((170, 214, 250), (0, 6, w, 2)); s.fill((170, 214, 250), (1, 8, w - 2, 1))
                for x in range(5, w - 4, 8):
                    s.fill((196, 228, 252), (x, 2, 3, 1))
            else:                                                     # barge
                c = (124, 132, 156)
                s.fill(c, (0, 0, w, 9)); s.fill(lt(c), (0, 0, w, 1)); s.fill(dk(c), (0, 7, w, 2))
                for i, x in enumerate(range(3, w - 8, 9)):
                    cc = ((255, 96, 60), (90, 220, 255), (255, 206, 50))[i % 3]
                    s.fill(cc, (x, 2, 7, 4)); s.fill(lt(cc), (x, 2, 7, 1))
            return outlined(self.pg, s)
        return self.get(("float", kind, w), make)

    # ------------------------------------------------------------ lane art
    def lane_bg(self, kind, biome, row, rnd, above, below):
        pg, B = self.pg, BIOMES[biome]
        s = pg.Surface((LW, T)).convert()
        if kind == "grass":
            s.fill(B["grass"][row % 2])
            for _ in range(7):
                x, y = rnd.randrange(LW - 2), rnd.randrange(1, T - 2)
                s.fill(B["tuft"], (x, y, 1, 2)); s.fill(B["tuft"], (x + 1, y + 1, 1, 1))
            for _ in range(3):
                s.set_at((rnd.randrange(LW), rnd.randrange(T)), rnd.choice(B["dot"]))
            if biome == 3:                                            # pavement slabs
                for x in range(0, LW, T):
                    s.fill(B["tuft"], (x, 0, 1, T))
                s.fill(B["tuft"], (0, T - 1, LW, 1))
        elif kind == "road":
            c = B["road"]
            s.fill(c)
            for _ in range(10):
                s.set_at((rnd.randrange(LW), rnd.randrange(T)), lt(c, 0.12))
            if above == "road":
                for x in range(2, LW, 12):
                    s.fill((230, 230, 210) if biome != 3 else (255, 206, 50), (x, 0, 6, 1))
            else:
                s.fill(lt(c, 0.45), (0, 0, LW, 1))
            if below != "road":
                s.fill(dk(c, 0.3), (0, T - 1, LW, 1))
        elif kind == "rail":
            s.fill((132, 124, 116) if biome != 2 else (176, 186, 204))
            for x in range(1, LW, 6):
                s.fill((112, 76, 50), (x, 1, 3, T - 2))
            s.fill((206, 210, 224), (0, 3, LW, 1)); s.fill((90, 94, 110), (0, 4, LW, 1))
            s.fill((206, 210, 224), (0, 8, LW, 1)); s.fill((90, 94, 110), (0, 9, LW, 1))
        return s

    def water(self, biome, frame, edge_top, edge_bot):
        def make():
            B = BIOMES[biome]
            s = self.pg.Surface((LW, T)).convert()
            s.fill(B["water"])
            rnd = random.Random(biome * 7 + 1)
            for _ in range(9):
                x, y = rnd.randrange(LW), rnd.randrange(2, T - 2)
                s.fill(B["ripple"], ((x + frame * 3) % LW, y, 4, 1))
            if edge_top:
                s.fill(dk(B["water"], 0.25), (0, 0, LW, 2))
                for x in range(frame * 2, LW, 5):
                    s.fill(WHITE, (x, 1, 2, 1))
            if edge_bot:
                s.fill(lt(B["water"], 0.3), (0, T - 1, LW, 1))
            return s
        return self.get(("water", biome, frame, edge_top, edge_bot), make)


# ==================================================================== world
class World:
    def __init__(self, art, rng):
        self.art, self.rng = art, rng
        self.lanes = {}
        self.top = -1                 # highest generated row
        self.pending = []
        for r in range(-6, 4):
            self.add("grass", r, safe=True)

    def biome(self, row):
        return (max(0, row) // BIOME_LEN) % len(BIOMES)

    def diff(self, row):
        return min(1.0, max(0, row) / 240.0)

    def need(self, upto):
        while self.top < upto:
            if not self.pending:
                self.plan()
            self.add(self.pending.pop(0), self.top + 1)

    def plan(self):
        rng, d = self.rng, self.diff(self.top)
        k = rng.random()
        if k < 0.46:
            group = ["road"] * rng.randint(1, 2 + int(d * 3))
        elif k < 0.76:
            group = ["river"] * rng.randint(1, 2 + int(d * 1.5))
        elif k < 0.88:
            group = ["rail"]
        else:
            group = []
        self.pending = group + ["grass"] * rng.randint(1, 2)

    def add(self, kind, row, safe=False):
        rng, art = self.rng, self.art
        b, d = self.biome(row), self.diff(row)
        B = BIOMES[b]
        below = self.lanes[row - 1]["kind"] if row - 1 in self.lanes else "grass"
        lane = {"kind": kind, "row": row, "biome": b, "obs": {}, "movers": [], "speed": 0.0, "loop": 0, "below": below, "above": None}
        if row - 1 in self.lanes:
            self.lanes[row - 1]["above"] = kind
            if self.lanes[row - 1]["kind"] in ("grass", "road", "rail"):
                self.rebg(self.lanes[row - 1])
        if kind == "grass" and not safe and below != "river":
            under = self.lanes.get(row - 1)
            walls = under["obs"] if under and under["kind"] == "grass" else None
            for c in rng.sample(range(COLS), rng.randint(0, 3)):
                if walls is not None and c not in walls:
                    boxed = (c == 0 or c - 1 in walls) and (c == COLS - 1 or c + 1 in walls)
                    if boxed:
                        continue                                     # never wall a critter into a pocket
                lane["obs"][c] = rng.choice(B["obs"])
        elif kind == "grass" and safe and row in (-1, -2, -3, -4, -5, -6):
            for c in range(COLS):
                lane["obs"][c] = B["obs"][0]
        elif kind == "grass" and safe:
            for c in (0, 9):
                if rng.random() < 0.6:
                    lane["obs"][c] = rng.choice(B["obs"])
        elif kind == "road":
            lane["speed"] = rng.choice([-1, 1]) * rng.uniform(20, 46) * (1 + 0.6 * d)
            lane["loop"] = rng.randint(220, 300)
            x = 0
            while x < lane["loop"] - 60:
                k, col = rng.choice(B["cars"])
                spr = art.vehicle(k, col, 1 if lane["speed"] > 0 else -1)
                lane["movers"].append({"x0": x, "w": spr.get_width(), "spr": spr})
                x += spr.get_width() + rng.randint(46, 110) - int(d * 20)
        elif kind == "river":
            prev = self.lanes.get(row - 1)
            sign = -1 if (prev and prev["kind"] == "river" and prev["speed"] > 0) else 1
            if not (prev and prev["kind"] == "river"):
                sign = rng.choice([-1, 1])
            lane["speed"] = sign * rng.uniform(14, 26) * (1 + 0.5 * d)
            lane["loop"] = 240
            x = 0
            while x < lane["loop"] - 30:
                w = rng.choice([24, 36, 36, 48]) if d < 0.5 else rng.choice([24, 24, 36])
                if x + w > lane["loop"] - 12:
                    break
                lane["movers"].append({"x0": x, "w": w + 2, "spr": art.floater(B["float"], w)})
                x += w + rng.randint(18, 34)
        elif kind == "rail":
            lane["period"] = rng.uniform(5.0, 8.0)
            lane["phase"] = rng.uniform(0, 8)
            lane["dir"] = rng.choice([-1, 1])
            lane["spr"] = art.train(B["train"], lane["dir"])
        lane["seed"] = rng.randrange(1 << 30)
        self.lanes[row] = lane
        self.rebg(lane)
        self.top = max(self.top, row)

    def rebg(self, lane):
        if lane["kind"] != "river":
            lane["bg"] = self.art.lane_bg(lane["kind"], lane["biome"], lane["row"], random.Random(lane["seed"]),
                                          lane["above"], lane["below"])

    def mover_x(self, lane, m, t):
        return ((m["x0"] + lane["speed"] * t) % lane["loop"]) - 60

    def train_x(self, lane, t):
        """x of the train's left edge, or None when it isn't passing. Also returns warning flag."""
        tt = (t + lane["phase"]) % lane["period"]
        warn = tt > lane["period"] - 1.3
        if tt < 1.4:
            k = tt / 1.4
            x = lerp(-180, LW + 10, k) if lane["dir"] > 0 else lerp(LW + 10, -180, k)
            return x, True
        return None, warn

    def prune(self, below_row):
        for r in [r for r in self.lanes if r < below_row]:
            del self.lanes[r]


# ===================================================================== game
class Game:
    def __init__(self, ctx):
        self.scr = ctx.scr
        self.pg = pg = self.scr.pg
        self.snd = getattr(ctx, "snd", None) or ac.Synth(pg)
        self.cv = pg.Surface((LW, LH)).convert()
        self.art = Art(pg)
        self.critter = 0
        self.t = 0.0
        self.build_sounds()

    def build_sounds(self):
        s = self.snd
        if not s.ok:
            return
        T_, mk = s._tone, s._make
        for i, f in enumerate((520, 580, 640)):
            s.sounds["hop%d" % i] = mk(T_(f, 0.07, "tri", 0.4, slide=f * 1.5))
        s.sounds["splash"] = mk(s._seq([T_(0, 0.25, "noise", 0.3, decay=0.3), T_(200, 0.2, "sine", 0.3, slide=70)]))
        s.sounds["crash"] = mk(s._seq([T_(0, 0.08, "noise", 0.4), T_(160, 0.25, "square", 0.25, slide=50)]))
        s.sounds["bell"] = mk(s._seq([T_(1320, 0.07, "square", 0.12), T_(990, 0.07, "square", 0.12)]))
        s.sounds["hawk"] = mk(T_(1500, 0.45, "saw", 0.16, slide=700))
        s.sounds["zone"] = mk(s._seq([T_(523, 0.08, "tri", 0.35), T_(784, 0.08, "tri", 0.35), T_(1047, 0.2, "tri", 0.35)]))

    # ----------------------------------------------------------------- run
    def play(self, ctx):
        self.daily, self.best = ctx.daily, ctx.best
        self.rng = random.Random(ctx.seed) if ctx.daily else random.Random()
        self.world = World(self.art, self.rng)
        self.world.need(24)
        self.row, self.px = 0, float(4 * T)          # logical row, pixel x (float while riding)
        self.face = "back"
        self.hop = None                              # (t0, x0, row0, x1, row1)
        self.land_t = -1.0
        self.queue = None
        self.ride = None
        self.cam = 0.0
        self.score = 0
        self.started = False
        self.idle = 0.0
        self.dead = None                             # (kind, time)
        self.parts, self.popups = [], []
        self.shake = 0.0
        self.zone = 0
        self.touch = None
        self.hawk_pos = None
        self.state = "play" if getattr(ctx, "again", False) else "title"
        self.done, self.out = False, None
        while not self.done:
            dt = self.scr.tick(60)
            self.frame(dt, self.pg.event.get())
        return self.out

    # --------------------------------------------------------------- input
    def read_input(self, events):
        pg = self.pg
        for e in events:
            if e.type == pg.QUIT or (e.type == pg.KEYDOWN and e.key == pg.K_ESCAPE):
                self.done, self.out = True, (self.score if self.dead else None)
            elif e.type == pg.KEYDOWN:
                d = {pg.K_UP: "up", pg.K_SPACE: "up", pg.K_RETURN: "up", pg.K_w: "up", pg.K_LEFT: "left", pg.K_a: "left",
                     pg.K_RIGHT: "right", pg.K_d: "right", pg.K_DOWN: "down", pg.K_s: "down"}.get(e.key)
                if d:
                    self.command(d)
            elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                x, y = self.scr.to_logical(e.pos)
                self.touch = [x, y, False]
                lx, ly = x / PX, y / PX
                if lx < 16 and ly < 14 and not self.dead:
                    self.done, self.out = True, None
                    self.touch = None
                elif self.state == "title" and ly > 168:
                    if lx < 30 or lx > 90:
                        self.critter = (self.critter + (1 if lx > 90 else -1)) % len(CRITTERS)
                        self.snd.play("move")
                        self.touch = None
            elif e.type == pg.MOUSEMOTION and self.touch and not self.touch[2]:
                x, y = self.scr.to_logical(e.pos)
                dx, dy = x - self.touch[0], y - self.touch[1]
                if max(abs(dx), abs(dy)) > 26:                      # swipe fires the moment it's clear
                    self.touch[2] = True
                    self.command(("right" if dx > 0 else "left") if abs(dx) > abs(dy) else ("down" if dy > 0 else "up"))
            elif e.type == pg.MOUSEBUTTONUP and e.button == 1 and self.touch:
                if not self.touch[2]:
                    self.command("up")                               # plain tap = hop forward
                self.touch = None

    def command(self, d):
        if self.state == "title":
            self.state = "play"
        if self.dead:
            if self.t - self.dead[1] > 0.7:
                self.done, self.out = True, self.score
            return
        self.queue = d

    # -------------------------------------------------------------- moving
    def try_hop(self, d):
        w = self.world
        row1 = self.row + (1 if d == "up" else -1 if d == "down" else 0)
        x1 = self.px + (T if d == "right" else -T if d == "left" else 0)
        self.face = {"up": "back", "down": "front", "left": "left", "right": "side"}[d]
        w.need(row1 + 2)
        lane = w.lanes.get(row1)
        if lane is None or row1 < math.floor(self.cam) - 3:
            return
        if lane["kind"] != "river":
            col = int(clamp(round(x1 / T), 0, COLS - 1))
            if not (-2 <= x1 <= LW - T + 2) and d in ("left", "right"):
                return
            if col in lane["obs"]:
                return                                               # bonk: something's in the way
            x1 = col * T
        elif not (-4 <= x1 <= LW - T + 4):
            return
        self.hop = (self.t, self.px, self.row, float(x1), row1)
        self.row = row1
        self.ride = None
        self.started = True
        self.idle = 0.0
        self.snd.play("hop%d" % random.randrange(3), 0.7)

    def land(self):
        _, _, row0, x1, row1 = self.hop
        self.hop = None
        self.px = x1
        self.land_t = self.t
        lane = self.world.lanes[row1]
        if row1 > self.score:
            self.score = row1
            z = self.world.biome(row1) + (row1 // (BIOME_LEN * len(BIOMES))) * len(BIOMES)
            if z != self.zone:
                self.zone = z
                self.popups.append([BIOMES[self.world.biome(row1)]["name"], 2.2, GOLD])
                self.snd.play("zone")
            elif self.best and row1 == self.best + 1:
                self.popups.append(["NEW BEST!", 1.6, (255, 140, 50)])
        if lane["kind"] == "river":
            m = self.floater_under(lane)
            if m is None:
                return self.die("water")
            self.ride = m
        for _ in range(3):
            self.parts.append([self.px + 6 + random.uniform(-4, 4), row1 * T + 1, random.uniform(-14, 14), random.uniform(4, 14), 0.25, (255, 255, 255)])

    def floater_under(self, lane):
        cx = self.px + T / 2
        for m in lane["movers"]:
            x = self.world.mover_x(lane, m, self.t)
            if x + 1 <= cx <= x + m["w"] - 1:
                return m
        return None

    def die(self, kind):
        if self.dead:
            return
        self.dead = (kind, self.t)
        self.hop = None
        self.shake = 0.25 if kind != "water" else 0.0
        self.snd.play({"water": "splash", "hawk": "hawk"}.get(kind, "crash"))
        cx, wy = self.px + 6, self.row * T + 4
        if kind == "water":
            B = BIOMES[self.world.biome(self.row)]
            for _ in range(16):
                self.parts.append([cx + random.uniform(-3, 3), wy, random.uniform(-32, 32), random.uniform(20, 70), 0.7, random.choice([WHITE, B["ripple"]])])
        elif kind != "hawk":
            for _ in range(10):
                self.parts.append([cx, wy + 4, random.uniform(-50, 50), random.uniform(10, 60), 0.5, random.choice([GOLD, WHITE])])

    # -------------------------------------------------------------- update
    def frame(self, dt, events):
        self.t += dt
        self.read_input(events)
        if self.done:
            return
        self.update(dt)
        self.draw()
        self.scr.surf.blit(self.pg.transform.scale(self.cv, (ac.W, ac.H)), (0, 0))
        self.scr.present(crt=False)

    def update(self, dt):
        w, t = self.world, self.t
        self.shake = max(0, self.shake - dt)
        for p in self.parts:
            p[0] += p[2] * dt; p[1] += p[3] * dt; p[3] -= 190 * dt; p[4] -= dt
        self.parts = [p for p in self.parts if p[4] > 0]
        for p in self.popups:
            p[1] -= dt
        self.popups = [p for p in self.popups if p[1] > 0]
        if self.dead:
            kind, t0 = self.dead
            if kind == "hawk":
                k = (t - t0) / 0.5
                if k >= 1 and self.hawk_pos:
                    self.hawk_pos[1] += 150 * dt                     # carried off the top
            if t - t0 > 2.2:
                self.done, self.out = True, self.score
            return
        if self.state != "play":
            return
        if self.hop and t - self.hop[0] >= HOP_TIME:
            self.land()
            if self.dead:
                return
        if not self.hop and self.queue:
            d, self.queue = self.queue, None
            self.try_hop(d)
        lane = w.lanes[self.row]
        if self.ride and not self.hop:                               # carried by the log
            self.px += lane["speed"] * dt
            if self.px < -8 or self.px > LW - 4:
                return self.die("water")
        if not self.hop or (t - self.hop[0]) > HOP_TIME * 0.5:       # hit checks once we're over the lane
            box = (self.px + 2, self.px + T - 2)
            if lane["kind"] == "road":
                for m in lane["movers"]:
                    x = w.mover_x(lane, m, t)
                    if x + 2 < box[1] and x + m["w"] - 2 > box[0]:
                        return self.die("car")
            elif lane["kind"] == "rail":
                x, _ = w.train_x(lane, t)
                if x is not None and x + 2 < box[1] and x + 170 > box[0]:
                    return self.die("train")
        # camera: follows you up, and creeps on its own so you can't dawdle
        if self.started:
            self.idle += dt
            self.cam += (0.22 + 0.5 * w.diff(self.score)) * dt
        target = self.row - 0.0
        if target > self.cam:
            self.cam += (target - self.cam) * min(1, dt * 5)
        if self.row < self.cam - 4.4 or self.idle > 9:
            self.hawk_pos = [self.px - 2, -20.0]
            return self.die("hawk")
        w.need(int(self.cam) + 22)
        w.prune(int(self.cam) - 10)

    # ---------------------------------------------------------------- draw
    def row_y(self, row):
        """Screen y of the top of a row."""
        return int(round(150 - (row - self.cam) * T))

    def player_pose(self):
        """-> (x, ground_y, lift, sprite)"""
        t, fr = self.t, self.art.critters[self.critter]
        if self.hop:
            t0, x0, r0, x1, r1 = self.hop
            k = clamp((t - t0) / HOP_TIME, 0, 1)
            x = lerp(x0, x1, k)
            gy = lerp(self.row_y(r0), self.row_y(r1), k) + T
            lift = math.sin(k * math.pi) * 6
            spr = fr[(self.face, "jump")]
            sx, sy = 0.9, 1.15
        else:
            x, gy, lift = self.px, self.row_y(self.row) + T, 0
            blink = (t * 0.37 + self.critter) % 1 > 0.955
            spr = fr[(self.face, "blink" if blink else "stand")]
            since = t - self.land_t
            if since < 0.09:
                sx, sy = 1.18, 0.8                                   # landing squash
            else:
                b = math.sin(t * 5) > 0.6 and self.state != "title"
                sx, sy = (1.0, 0.94) if b else (1.0, 1.0)             # idle breathe
        if (sx, sy) != (1.0, 1.0):
            w0, h0 = spr.get_size()
            spr = self.pg.transform.scale(spr, (max(1, round(w0 * sx)), max(1, round(h0 * sy))))
        return x, gy, lift, spr

    def draw(self):
        pg, cv, w, t, art = self.pg, self.cv, self.world, self.t, self.art
        top_row = int(self.cam) + 14
        bot_row = int(self.cam) - 5
        w.need(top_row + 1)
        frame = int(t * 2.5) % 2
        for r in range(bot_row, top_row + 1):                        # ground first
            lane = w.lanes.get(r)
            if not lane:
                continue
            y = self.row_y(r)
            if lane["kind"] == "river":
                cv.blit(art.water(lane["biome"], frame, lane["above"] != "river", lane["below"] != "river"), (0, y))
            else:
                cv.blit(lane["bg"], (0, y))
        px, gy, lift, pspr = self.player_pose()
        prow = min(self.row, self.hop[2]) if self.hop else self.row
        kind = self.dead[0] if self.dead else None
        for r in range(top_row, bot_row - 1, -1):                    # far rows first, near rows on top
            lane = w.lanes.get(r)
            if not lane:
                continue
            y = self.row_y(r)
            base = y + T - 1
            if lane["kind"] == "river":
                for m in lane["movers"]:
                    x = w.mover_x(lane, m, t)
                    if -m["w"] < x < LW:
                        cv.blit(m["spr"], (int(x), y + 1))
            if r == prow and kind not in ("water", "car", "train"):
                self.draw_player(px, gy, lift, pspr)
            elif r == prow and kind in ("car", "train"):
                flat = pg.transform.scale(art.critters[self.critter][("front", "stand")], (18, 5))
                cv.blit(flat, (int(px) - 3, gy - 6))
            for c, k in lane["obs"].items():
                s = art.obstacle(k)
                cv.blit(s, (c * T + (T - s.get_width()) // 2, base - s.get_height() + 1))
            if lane["kind"] == "road":
                for m in lane["movers"]:
                    x = w.mover_x(lane, m, t)
                    if -m["w"] < x < LW:
                        cv.blit(m["spr"], (int(x), base - m["spr"].get_height() + 1))
            elif lane["kind"] == "rail":
                x, warn = w.train_x(lane, t)
                on = warn and int(t * 8) % 2
                for sx_ in (3, LW - 8):                              # crossing lights
                    cv.fill(INK, (sx_ + 1, y - 2, 3, 12)); cv.fill((255, 60, 60) if on else (110, 40, 50), (sx_, y - 5, 5, 5))
                    cv.fill(INK, (sx_, y - 5, 5, 1))
                if warn and x is None and int(t * 8) % 4 == 0 and abs(r - self.row) < 8 and not self.dead:
                    self.snd.play("bell", 0.35)
                if x is not None:
                    cv.blit(lane["spr"], (int(x), base - lane["spr"].get_height() + 1))
        for p in self.parts:
            x, y = int(p[0]), int(round(150 - (p[1] / T - self.cam) * T)) + T
            if 0 <= x < LW and 0 <= y < LH:
                cv.fill(p[5], (x, y, 2, 2))
        if kind == "hawk" and self.hawk_pos:
            k = clamp((t - self.dead[1]) / 0.5, 0, 1)
            hx = self.hawk_pos[0]
            hy = lerp(-20, gy - 22, ac.ease_in_out(k)) if k < 1 else gy - 22 - self.hawk_pos[1] - 20
            if k < 1:
                self.draw_player(px, gy, 0, pspr)
            else:
                cv.blit(pspr, (int(px) - 1, int(hy) + 5))
            cv.blit(art.hawk, (int(hx) - 1, int(hy)))
        self.draw_hud()
        if self.shake > 0:
            tmp = cv.copy()
            cv.blit(tmp, (random.choice([-1, 0, 1]), random.choice([-1, 0, 1])))

    def draw_player(self, px, gy, lift, spr):
        cv = self.cv
        if lift < 3:
            cv.blit(self.art.shadow, (int(px) + 1, int(gy) - 4))
        else:
            self.pg.draw.ellipse(cv, (0, 0, 0), (int(px) + 3, int(gy) - 3, 6, 2))
        w0, h0 = spr.get_size()
        cv.blit(spr, (int(round(px + T / 2 - w0 / 2)), int(round(gy - h0 - lift))))

    def text(self, s, x, y, scale=1, col=WHITE, anchor="center", shadow=INK):
        ac.draw_text(self.cv, self.pg, s, (x, y), scale, col, anchor, shadow=shadow)

    def draw_hud(self):
        pg, cv, t = self.pg, self.cv, self.t
        if not self.dead:
            pg.draw.rect(cv, INK, (2, 2, 12, 10)); pg.draw.rect(cv, WHITE, (2, 2, 12, 10), 1)
            self.text("<", 8, 7, 1, WHITE, shadow=None)
        if self.state == "title":
            for i, (word, col) in enumerate((("CRITTER", (255, 140, 50)), ("HOP", GOLD))):
                self.text(word, LW // 2, 30 + i * 18 + int(math.sin(t * 2.5 + i) * 2), 2, col)
            if self.daily:
                self.text("DAILY CHALLENGE", LW // 2, 66, 1, WHITE)
            elif self.best:
                self.text("BEST %d" % self.best, LW // 2, 66, 1, WHITE)
            if int(t * 2.5) % 2:
                self.text("TAP TO HOP", LW // 2, 84, 1, WHITE)
            self.text("SWIPE TO TURN", LW // 2, 96, 1, (220, 230, 250))
            pg.draw.rect(cv, INK, (0, 170, LW, 30)); pg.draw.rect(cv, WHITE, (0, 170, LW, 1))
            self.text("<", 14, 185, 2, GOLD, shadow=None); self.text(">", LW - 14, 185, 2, GOLD, shadow=None)
            self.text(CRITTERS[self.critter]["name"], LW // 2 + 8, 185, 1, WHITE, shadow=None)
            cv.blit(self.art.critters[self.critter][("front", "blink" if (t % 2.4) > 2.25 else "stand")], (28, 177))
            return
        self.text(str(self.score), LW // 2, 13, 2)
        if self.daily:
            self.text("DAILY", LW - 3, 7, 1, GOLD, "right")
        elif self.best:
            self.text("BEST %d" % self.best, LW - 3, 7, 1, WHITE, "right")
        for i, p in enumerate(self.popups[-2:]):
            if p[1] > 0.3 or int(t * 20) % 2:
                tw = ac.text_size(p[0], 1)[0]
                pg.draw.rect(cv, INK, (LW // 2 - tw // 2 - 4, 29 + i * 13, tw + 8, 11))
                pg.draw.rect(cv, p[2], (LW // 2 - tw // 2 - 4, 29 + i * 13, tw + 8, 11), 1)
                self.text(p[0], LW // 2, 34 + i * 13, 1, p[2], shadow=None)
        if self.dead and t - self.dead[1] > 0.6:
            msg = {"car": "SPLAT!", "train": "CHOO CHOO!", "water": "SPLASH!", "hawk": "TOO SLOW!"}[self.dead[0]]
            pg.draw.rect(cv, INK, (10, 78, 100, 34)); pg.draw.rect(cv, WHITE, (10, 78, 100, 34), 1)
            self.text(msg, LW // 2, 90, 2 if len(msg) < 9 else 1, RED, shadow=None)
            self.text("%d HOPS" % self.score, LW // 2, 104, 1, WHITE, shadow=None)


_GAME = None


def play(ctx):
    global _GAME
    if _GAME is None:
        _GAME = Game(ctx)
    return _GAME.play(ctx)


def card_scene(pg, t):
    """80x58 animated pixel-art scene for the launcher card."""
    global _CARD
    try:
        art = _CARD
    except NameError:
        art = _CARD = Art(pg)
    cv = pg.Surface((80, 58))
    rnd = random.Random(4)
    kinds = ["grass", "river", "road", "road", "grass"]
    for i, k in enumerate(kinds):
        y = i * 12 - 2
        above, below = (kinds[i - 1] if i else "grass"), (kinds[i + 1] if i < 4 else "grass")
        if k == "river":
            cv.blit(art.water(0, int(t * 2.5) % 2, True, True), (0, y))
            for x0 in (0, 52):
                cv.blit(art.floater("log", 36), (int((x0 + t * 16) % 120) - 40, y + 1))
        else:
            cv.blit(art.lane_bg(k, 0, i, rnd, above, below), (0, y))
    for c, k in ((0, "tree"), (5, "bush"), (6, "tree")):
        s = art.obstacle(k)
        cv.blit(s, (c * 12 + 1, 10 - s.get_height()))
    cv.blit(art.vehicle("car", (236, 84, 84), 1), (int((t * 34) % 130) - 30, 24))
    cv.blit(art.vehicle("truck", (240, 240, 245), -1), (100 - int((t * 26) % 150), 35))
    s = art.obstacle("rock"); cv.blit(s, (62, 48))
    k = (t * 1.6) % 1
    hop = k < 0.25
    spr = art.critters[0][("back", "jump" if hop else "stand")]
    cv.blit(art.shadow, (31, 52))
    cv.blit(spr, (29, 42 - int(math.sin(k / 0.25 * math.pi) * 5) if hop else 42))
    return cv


if __name__ == "__main__":
    from types import SimpleNamespace
    _scr = ac.Screen("CRITTER HOP")
    while play(SimpleNamespace(scr=_scr, snd=None, daily=False, seed=0, best=0, again=False)) is not None:
        pass
