"""
arcade_core.py - shared engine for the FLAPPI desk arcade.

Every game and the launcher import this. It provides:
  - Screen: fullscreen portrait 480x800 logical canvas, scaled to the display
  - Input: taps, drags, swipes, and the one-button (Space) tap/hold controls
  - Pixel font: a chunky built-in bitmap font (no font files needed)
  - Synth: generated sound effects (no audio files needed)
  - Scores: shared leaderboards (today / this week / all time), daily seeds
  - report_score(): the one call a game makes to feed the leaderboard
"""
import os, sys, json, math, time, random, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
os.makedirs(DATA, exist_ok=True)

W, H = 480, 800

# ------------------------------------------------------------------ palette
INK = (7, 13, 40)
NIGHT = (11, 22, 62)
DEEP = (16, 36, 94)
PINK = (255, 122, 40)   # accent (orange; name kept for old imports)
CYAN = (60, 230, 255)
GOLD = (255, 204, 64)
LIME = (120, 255, 140)
WHITE = (245, 242, 255)
GREY = (91, 137, 183)
DIM = (49, 77, 128)
RED = (255, 80, 90)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_col(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def ease_out_back(t, s=1.70158):
    t = clamp(t, 0, 1) - 1
    return t * t * ((s + 1) * t + s) + 1


def ease_out_cubic(t):
    t = clamp(t, 0, 1) - 1
    return t * t * t + 1


def ease_in_out(t):
    t = clamp(t, 0, 1)
    return t * t * (3 - 2 * t)


def ease_out_bounce(t):
    t = clamp(t, 0, 1)
    n, d = 7.5625, 2.75
    if t < 1 / d:
        return n * t * t
    if t < 2 / d:
        t -= 1.5 / d
        return n * t * t + 0.75
    if t < 2.5 / d:
        t -= 2.25 / d
        return n * t * t + 0.9375
    t -= 2.625 / d
    return n * t * t + 0.984375


# =================================================================== screen
class Screen:
    """Owns the real display. Draw on .surf (480x800), call present()."""

    def __init__(self, caption="FLAPPI"):
        import pygame
        self.pg = pygame
        os.environ.setdefault("SDL_VIDEO_CENTERED", "1")
        pygame.mixer.pre_init(22050, -16, 2, 512)
        pygame.init()
        pygame.display.set_caption(caption)
        if os.environ.get("ARCADE_WINDOWED"):
            self.display = pygame.display.set_mode((W, H))
        else:
            self.display = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)
        dw, dh = self.display.get_size()
        # Landscape-reporting panel: we still render portrait and fit it.
        self.scale = min(dw / W, dh / H)
        self.out_size = (int(W * self.scale), int(H * self.scale))
        self.offset = ((dw - self.out_size[0]) // 2, (dh - self.out_size[1]) // 2)
        self.direct = self.out_size == (W, H) and self.offset == (0, 0)
        self.surf = self.display if self.direct else pygame.Surface((W, H)).convert()
        pygame.mouse.set_visible(bool(os.environ.get("ARCADE_WINDOWED")))
        self.clock = pygame.time.Clock()
        self.overlay = make_crt_overlay(pygame)

    def to_logical(self, pos):
        x = (pos[0] - self.offset[0]) / self.scale
        y = (pos[1] - self.offset[1]) / self.scale
        return (x, y)

    def present(self, crt=True):
        pg = self.pg
        if crt:
            self.surf.blit(self.overlay, (0, 0))
        if not self.direct:
            self.display.fill((0, 0, 0))
            if self.scale == 1:
                self.display.blit(self.surf, self.offset)
            else:
                self.display.blit(pg.transform.smoothscale(self.surf, self.out_size), self.offset)
        pg.display.flip()

    def tick(self, fps=60):
        return min(self.clock.tick(fps) / 1000.0, 0.05)


def make_crt_overlay(pg):
    """Subtle scanlines + vignette, pre-rendered once."""
    ov = pg.Surface((W, H), pg.SRCALPHA)
    for y in range(0, H, 3):
        pg.draw.line(ov, (0, 0, 0, 34), (0, y), (W, y))
    # vignette: dark edges built from concentric translucent rects
    steps = 26
    for i in range(steps):
        a = int(70 * (1 - i / steps) ** 2.2)
        pg.draw.rect(ov, (0, 0, 0, a), (i * 3, i * 4, W - i * 6, H - i * 8), 3, border_radius=40)
    return ov


# ==================================================================== input
class Input:
    """
    Turns raw events into gestures. Each frame call update(events) and read:
      .taps      list of (x, y) quick taps
      .swipe     'left'/'right'/'up'/'down' or None
      .down      True while a finger/mouse is held
      .pos       current pointer position (logical)
      .drag_dx/.drag_dy  offset from press point while held
      .pressed   (x, y) on the frame the finger went down, else None
      .released  True on the frame the finger lifted
      .btn_tap   one-button quick press (Space / Enter)
      .btn_hold  one-button long press (fires once, after HOLD seconds)
      .keys      set of named keys pressed this frame: left right up down back
    """
    HOLD = 0.55
    TAP_DIST = 18
    TAP_TIME = 0.45
    SWIPE_DIST = 60

    def __init__(self, screen):
        self.screen = screen
        self.down = False
        self.pos = (0, 0)
        self.start = (0, 0)
        self.start_t = 0
        self.btn_down_t = None
        self.btn_hold_fired = False
        self.last_activity = time.time()
        self.reset_frame()

    def reset_frame(self):
        self.taps = []
        self.swipe = None
        self.pressed = None
        self.released = False
        self.btn_tap = False
        self.btn_hold = False
        self.keys = set()
        self.quit = False

    @property
    def drag_dx(self):
        return (self.pos[0] - self.start[0]) if self.down else 0

    @property
    def drag_dy(self):
        return (self.pos[1] - self.start[1]) if self.down else 0

    def update(self, events):
        pg = self.screen.pg
        self.reset_frame()
        now = time.time()
        for e in events:
            if e.type == pg.QUIT:
                self.quit = True
            elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                self.down = True
                self.pos = self.start = self.screen.to_logical(e.pos)
                self.start_t = now
                self.pressed = self.pos
                self.last_activity = now
            elif e.type == pg.MOUSEMOTION:
                self.pos = self.screen.to_logical(e.pos)
                if self.down:
                    self.last_activity = now
            elif e.type == pg.MOUSEBUTTONUP and e.button == 1 and self.down:
                self.pos = self.screen.to_logical(e.pos)
                dx = self.pos[0] - self.start[0]
                dy = self.pos[1] - self.start[1]
                dist = math.hypot(dx, dy)
                if dist < self.TAP_DIST and now - self.start_t < self.TAP_TIME:
                    self.taps.append(self.start)
                elif dist >= self.SWIPE_DIST:
                    if abs(dx) > abs(dy):
                        self.swipe = "right" if dx > 0 else "left"
                    else:
                        self.swipe = "down" if dy > 0 else "up"
                self.down = False
                self.released = True
                self.last_activity = now
            elif e.type == pg.KEYDOWN:
                self.last_activity = now
                if e.key in (pg.K_SPACE, pg.K_RETURN):
                    if self.btn_down_t is None:
                        self.btn_down_t = now
                        self.btn_hold_fired = False
                elif e.key == pg.K_ESCAPE:
                    self.keys.add("back")
                elif e.key == pg.K_LEFT:
                    self.keys.add("left")
                elif e.key == pg.K_RIGHT:
                    self.keys.add("right")
                elif e.key == pg.K_UP:
                    self.keys.add("up")
                elif e.key == pg.K_DOWN:
                    self.keys.add("down")
            elif e.type == pg.KEYUP and e.key in (pg.K_SPACE, pg.K_RETURN):
                if self.btn_down_t is not None and not self.btn_hold_fired:
                    self.btn_tap = True
                self.btn_down_t = None
        if self.btn_down_t is not None and not self.btn_hold_fired:
            if now - self.btn_down_t >= self.HOLD:
                self.btn_hold = True
                self.btn_hold_fired = True

    @property
    def btn_hold_progress(self):
        if self.btn_down_t is None or self.btn_hold_fired:
            return 0.0
        return clamp((time.time() - self.btn_down_t) / self.HOLD, 0, 1)

    def idle_for(self):
        return time.time() - self.last_activity


# =============================================================== pixel font
_GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    " ": ["00000"] * 7,
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
    "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
    "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
    ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
    "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
    ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
    "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
    "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
    "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
    "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
    "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01111"],
    "^": ["00100", "01110", "10101", "00100", "00100", "00100", "00100"],  # up arrow
    "~": ["00100", "00100", "00100", "00100", "10101", "01110", "00100"],  # down arrow
    "$": ["00000", "01010", "11111", "11111", "01110", "00100", "00000"],  # heart
}
_text_cache = {}


def text_size(text, scale=2, spacing=1):
    n = len(text)
    if n == 0:
        return (0, 7 * scale)
    return (n * (5 + spacing) * scale - spacing * scale, 7 * scale)


def render_text(pg, text, scale=2, color=WHITE, spacing=1):
    text = str(text).upper()
    key = (text, scale, color, spacing)
    s = _text_cache.get(key)
    if s is not None:
        return s
    w, h = text_size(text, scale, spacing)
    s = pg.Surface((max(1, w), h), pg.SRCALPHA)
    x = 0
    for ch in text:
        g = _GLYPHS.get(ch, _GLYPHS["?"])
        for ry, row in enumerate(g):
            for rx, bit in enumerate(row):
                if bit == "1":
                    s.fill(color, (x + rx * scale, ry * scale, scale, scale))
        x += (5 + spacing) * scale
    if len(_text_cache) > 600:
        _text_cache.clear()
    _text_cache[key] = s
    return s


def draw_text(surf, pg, text, pos, scale=2, color=WHITE, anchor="center",
              shadow=None, spacing=1, alpha=255):
    """anchor: 'center', 'left', 'right', 'midtop', 'topleft'."""
    s = render_text(pg, text, scale, color, spacing)
    r = s.get_rect()
    setattr(r, {"center": "center", "left": "midleft", "right": "midright",
                "midtop": "midtop", "topleft": "topleft"}[anchor], (int(pos[0]), int(pos[1])))
    if shadow:
        sh = render_text(pg, text, scale, shadow, spacing)
        if alpha < 255:
            sh = sh.copy(); sh.set_alpha(alpha)
        o = min(scale, 4)
        surf.blit(sh, (r.x + o, r.y + o))
    if alpha < 255:
        s = s.copy(); s.set_alpha(alpha)
    surf.blit(s, r)
    return r


def wrap_text(text, max_w, scale=2):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if text_size(t, scale)[0] <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


# ===================================================================== synth
class Synth:
    """All sound effects generated at startup with numpy. Safe if no audio."""

    def __init__(self, pg):
        self.pg = pg
        self.sounds = {}
        self.ok = False
        try:
            import numpy as np
            self.np = np
            if not pg.mixer.get_init():
                pg.mixer.init(22050, -16, 2, 512)
            self.rate, _, self.ch = pg.mixer.get_init()
            self.ok = True
            self._build()
        except Exception:
            self.ok = False

    def _tone(self, freqs, dur, wave="square", vol=0.3, attack=0.005, decay=None, slide=None):
        np = self.np
        n = int(self.rate * dur)
        t = np.arange(n) / self.rate
        if slide:
            f = np.linspace(freqs, slide, n)
            phase = 2 * np.pi * np.cumsum(f) / self.rate
        else:
            phase = 2 * np.pi * freqs * t
        if wave == "square":
            y = np.sign(np.sin(phase)) * 0.6
        elif wave == "tri":
            y = 2 / np.pi * np.arcsin(np.sin(phase))
        elif wave == "saw":
            y = 2 * ((phase / (2 * np.pi)) % 1) - 1
        elif wave == "noise":
            y = np.random.uniform(-1, 1, n)
        else:
            y = np.sin(phase)
        env = np.ones(n)
        a = max(1, int(self.rate * attack))
        env[:a] = np.linspace(0, 1, a)
        d = decay if decay is not None else dur
        env *= np.exp(-t / max(0.001, d / 3))
        return y * env * vol

    def _seq(self, parts):
        np = self.np
        return np.concatenate(parts)

    def _make(self, mono):
        np = self.np
        mono = np.clip(mono, -1, 1)
        data = (mono * 32000).astype(np.int16)
        if self.ch == 2:
            data = np.column_stack([data, data])
        return self.pg.sndarray.make_sound(np.ascontiguousarray(data))

    def _build(self):
        T = self._tone
        mk = self._make
        self.sounds["tick"] = mk(T(1400, 0.03, "square", 0.12))
        self.sounds["move"] = mk(T(520, 0.06, "tri", 0.35, slide=780))
        self.sounds["select"] = mk(self._seq([T(660, 0.05, "square", 0.2), T(990, 0.09, "square", 0.2)]))
        self.sounds["back"] = mk(T(500, 0.1, "tri", 0.35, slide=260))
        self.sounds["error"] = mk(T(140, 0.18, "square", 0.25))
        self.sounds["type"] = mk(T(880, 0.04, "square", 0.14))
        self.sounds["launch"] = mk(self._seq([T(330, 0.06, "square", 0.22), T(440, 0.06, "square", 0.22),
                                              T(660, 0.06, "square", 0.22), T(880, 0.3, "square", 0.22)]))
        self.sounds["boot_beep"] = mk(T(1000, 0.08, "square", 0.15))
        self.sounds["drop"] = mk(T(300, 0.12, "tri", 0.4, slide=90))
        notes = [523, 659, 784, 1047]
        self.sounds["chime"] = mk(self._seq([T(f, 0.11, "tri", 0.35, decay=0.3) for f in notes]
                                            + [T(1319, 0.6, "tri", 0.35, decay=0.6)]))
        self.sounds["fanfare"] = mk(self._seq([T(523, 0.1, "square", 0.2), T(523, 0.1, "square", 0.2),
                                               T(523, 0.1, "square", 0.2), T(659, 0.3, "square", 0.2),
                                               T(784, 0.15, "square", 0.2), T(1047, 0.5, "square", 0.2)]))
        self.sounds["whoosh"] = mk(T(0, 0.25, "noise", 0.15, attack=0.08, decay=0.25))
        self.sounds["crt"] = mk(self._seq([T(60, 0.15, "saw", 0.25), T(0, 0.2, "noise", 0.08)]))

    def play(self, name, vol=1.0):
        if not self.ok:
            return
        s = self.sounds.get(name)
        if s:
            s.set_volume(vol)
            s.play()


# ================================================================ particles
class Particles:
    def __init__(self):
        self.items = []

    def burst(self, x, y, colors, n=24, speed=220, life=0.9, gravity=380, size=(3, 6)):
        for _ in range(n):
            a = random.uniform(0, math.tau)
            sp = random.uniform(speed * 0.3, speed)
            self.items.append([x, y, math.cos(a) * sp, math.sin(a) * sp - speed * 0.3,
                               random.uniform(life * 0.6, life), life, random.choice(colors),
                               random.randint(*size), gravity])

    def confetti(self, w, colors, n=60):
        for _ in range(n):
            self.items.append([random.uniform(0, w), random.uniform(-80, -10),
                               random.uniform(-40, 40), random.uniform(60, 180),
                               random.uniform(2.5, 4.5), 4.5, random.choice(colors),
                               random.randint(4, 8), 60])

    def update(self, dt):
        keep = []
        for p in self.items:
            p[0] += p[2] * dt
            p[1] += p[3] * dt
            p[3] += p[8] * dt
            p[4] -= dt
            if p[4] > 0:
                keep.append(p)
        self.items = keep

    def draw(self, surf, pg):
        for p in self.items:
            s = max(1, int(p[7] * min(1, p[4] / (p[5] * 0.4))))
            surf.fill(p[6], (int(p[0]), int(p[1]), s, s))


# =============================================================== background
class Backdrop:
    """Synthwave sky: gradient, twinkling stars, sun, and a moving floor grid."""

    def __init__(self, pg, top=INK, bottom=(15, 58, 98), horizon=560):
        self.pg = pg
        self.horizon = horizon
        self.base = pg.Surface((W, H)).convert()
        self.plain = None
        for y in range(H):
            t = y / H
            c = lerp_col(top, bottom, t ** 1.6) if y < horizon else lerp_col((7, 25, 58), INK, (y - horizon) / (H - horizon))
            pg.draw.line(self.base, c, (0, y), (W, y))
        self.plain = self.base.copy()
        # sun with stripes cut out
        sun = pg.Surface((220, 220), pg.SRCALPHA)
        for r in range(110, 0, -1):
            pg.draw.circle(sun, lerp_col(GOLD, PINK, 1 - r / 110) + (255,), (110, 110), r)
        for i in range(6):
            y = 130 + i * 15
            pg.draw.rect(sun, (0, 0, 0, 0), (0, y, 220, 3 + i))
        sun_clip = sun.subsurface((0, 0, 220, 110 + 1)).copy()
        self.base.blit(sun_clip, (W // 2 - 110, horizon - 110))
        glow = pg.Surface((W, 40), pg.SRCALPHA)
        for i in range(40):
            pg.draw.line(glow, (60, 150, 255) + (int(90 * (1 - i / 40)),), (0, 39 - i), (W, 39 - i))
        self.base.blit(glow, (0, horizon - 40))
        self.plain.blit(glow, (0, horizon - 40))
        rnd = random.Random(7)
        self.stars = [(rnd.randrange(W), rnd.randrange(horizon - 130), rnd.uniform(0, 6.28), rnd.choice([1, 1, 1, 2]))
                      for _ in range(70)]
        self.t = 0

    def update(self, dt):
        self.t += dt

    def draw(self, surf, intensity=1.0, sun=True):
        pg = self.pg
        surf.blit(self.base if sun else self.plain, (0, 0))
        for x, y, ph, sz in self.stars:
            b = 0.5 + 0.5 * math.sin(self.t * 2 + ph)
            surf.fill(lerp_col(DIM, WHITE, b * intensity), (x, y, sz, sz))
        hz = self.horizon
        col = lerp_col((14, 40, 110), (60, 150, 255), 0.6 * intensity)
        pg.draw.line(surf, CYAN, (0, hz), (W, hz), 2)
        # horizontal floor lines scrolling toward viewer
        off = (self.t * 0.6) % 1.0
        for i in range(12):
            z = (i + off) / 12
            y = hz + (H - hz) * z * z
            pg.draw.line(surf, col, (0, int(y)), (W, int(y)), 1)
        for i in range(-10, 11):
            x0 = W / 2 + i * 22
            x1 = W / 2 + i * 150
            pg.draw.line(surf, col, (int(x0), hz), (int(x1), H), 1)


def panel(surf, pg, rect, fill=(12, 25, 68), border=CYAN, radius=14, alpha=225, width=2):
    r = pg.Rect(rect)
    s = pg.Surface(r.size, pg.SRCALPHA)
    pg.draw.rect(s, fill + (alpha,), s.get_rect(), border_radius=radius)
    if border:
        pg.draw.rect(s, border + (255,), s.get_rect(), width, border_radius=radius)
    surf.blit(s, r)
    return r


# ==================================================================== games
def load_games():
    with open(os.path.join(BASE, "games.json")) as f:
        games = json.load(f)
    for g in games:
        if g.get("cwd"):
            g["cwd"] = os.path.expanduser(g["cwd"])
    return games


def today_str(d=None):
    return (d or datetime.date.today()).isoformat()


def week_str(d=None):
    y, w, _ = (d or datetime.date.today()).isocalendar()
    return f"{y}-W{w:02d}"


def daily_seed(d=None):
    d = d or datetime.date.today()
    return d.year * 10000 + d.month * 100 + d.day


def daily_game(games, d=None):
    pool = [g for g in games if g.get("status") == "ready" and g.get("daily", True)]
    if not pool:
        return None
    d = d or datetime.date.today()
    return pool[d.toordinal() % len(pool)]


# ===================================================================== scores
SCORES_FILE = os.path.join(DATA, "scores.json")
PENDING_FILE = os.path.join(DATA, "pending.json")
MAX_RUNS = 6000


def _read_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f)
    os.replace(tmp, path)


class Scores:
    def __init__(self):
        self.data = _read_json(SCORES_FILE, {"runs": [], "last_initials": "AAA"})
        self.data.setdefault("runs", [])
        self.data.setdefault("last_initials", "AAA")
        self.low = set()                  # games where the lowest score wins (golf)

    def save(self):
        if len(self.data["runs"]) > MAX_RUNS:
            # keep every run that could still matter: newest + best
            runs = sorted(self.data["runs"], key=lambda r: r["ts"])
            self.data["runs"] = runs[-MAX_RUNS:]
        _write_json(SCORES_FILE, self.data)

    def add(self, game, score, initials, daily=False):
        now = datetime.datetime.now()
        run = {"game": game, "score": int(score), "initials": initials[:3],
               "ts": now.timestamp(), "day": today_str(now.date()),
               "week": week_str(now.date()), "daily": bool(daily)}
        self.data["runs"].append(run)
        self.data["last_initials"] = initials[:3]
        self.save()
        return run

    def board(self, game, scope="all", n=10, daily_only=False):
        runs = [r for r in self.data["runs"] if r["game"] == game]
        if scope == "day":
            runs = [r for r in runs if r["day"] == today_str()]
        elif scope == "week":
            runs = [r for r in runs if r["week"] == week_str()]
        if daily_only:
            runs = [r for r in runs if r.get("daily")]
        if game in self.low:              # fewest wins, and one line per player
            runs.sort(key=lambda r: (r["score"], r["ts"]))
            seen, uniq = set(), []
            for r in runs:
                if r["initials"] not in seen:
                    seen.add(r["initials"])
                    uniq.append(r)
            return uniq[:n]
        runs.sort(key=lambda r: (-r["score"], r["ts"]))
        return runs[:n]

    def rank_of(self, game, score, scope="all", daily_only=False):
        """Rank a new score would get (1-based)."""
        runs = self.board(game, scope, n=100000, daily_only=daily_only)
        if game in self.low:
            return 1 + sum(1 for r in runs if r["score"] <= score)
        return 1 + sum(1 for r in runs if r["score"] >= score)

    def best(self, game):
        b = self.board(game, "all", 1)
        return b[0] if b else None

    def daily_champion(self, game):
        b = self.board(game, "day", 1, daily_only=True)
        return b[0] if b else None

    def weekly_champions(self, games):
        out = []
        for g in games:
            b = self.board(g["id"], "week", 1)
            if b:
                out.append((g, b[0]))
        return out

    def hall_of_fame(self, limit=8):
        """Past weekly winners: [(week, game_id, run)] newest first."""
        best = {}
        cur = week_str()
        for r in self.data["runs"]:
            if r["week"] == cur:
                continue
            k = (r["week"], r["game"])
            if k not in best or (r["score"] < best[k]["score"] if r["game"] in self.low else r["score"] > best[k]["score"]):
                best[k] = r
        items = sorted(best.items(), key=lambda kv: kv[0][0], reverse=True)
        return [(k[0], k[1], v) for k, v in items[:limit]]


def report_score(game_id=None, score=0):
    """
    Call from any game when a run ends. Keeps the best run of this play
    session; the launcher picks it up afterwards for initials + leaderboard.
    """
    game_id = game_id or os.environ.get("ARCADE_GAME", "unknown")
    daily = os.environ.get("ARCADE_DAILY") == "1"
    try:
        score = int(score)
    except Exception:
        return
    cur = _read_json(PENDING_FILE, None)
    if cur and cur.get("game") == game_id and cur.get("score", 0) >= score:
        return
    _write_json(PENDING_FILE, {"game": game_id, "score": score, "daily": daily, "ts": time.time()})


def take_pending():
    p = _read_json(PENDING_FILE, None)
    try:
        os.remove(PENDING_FILE)
    except OSError:
        pass
    return p


def seed_if_daily():
    """Games call this at startup: in a daily run, randomness is the same for everyone today."""
    s = os.environ.get("ARCADE_SEED")
    if os.environ.get("ARCADE_DAILY") == "1" and s:
        random.seed(int(s))
        return True
    return False
