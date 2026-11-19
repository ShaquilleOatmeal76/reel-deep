"""
REEL DEEP - a pixel-art fishing dive for the FLAPPI arcade.

  1. pick a lure, tap CAST
  2. THE DESCENT: drag left/right. Every fish you touch goes on the hook, and
     the hook only holds 3 - so dodge the small fry and save your spots.
     PULSE scatters everything near the hook (the lure decides how many you get).
     Trophies (big, sparkling) and legendaries fight back: tap on green to land them.
     The third fish, a jellyfish or the sea floor ends the dive.
  3. THE ASCENT: the line reels straight in. Nothing more is caught or lost.
  4. THE HAUL: pounds, times any set bonus (three of a kind, grand tour ...),
     today's bounty fish counts triple, and touching bottom adds a bonus.

Controls: drag (or arrow keys), tap the PULSE button (or DOWN). One button: each press flips the drift.
"""
import os, sys, math, random, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import arcade_core as ac
from arcade_core import lerp, lerp_col, clamp
import hopper                                   # shares the critters and the outline helper
from hopper import outlined, from_rows, dk, lt

LW, LH, PX = 120, 200, 4
M = 6                                           # pixels per metre of depth
INK = (26, 22, 40)
WHITE = (250, 250, 255)
GOLD = (255, 210, 70)
RED = (240, 80, 80)
CYAN = (90, 230, 255)
LIME = (130, 240, 130)
ORANGE = (255, 160, 70)
SAVE = os.path.join(ac.DATA, "fishing.json")
CAPACITY = 3

ZONES = [("SHALLOWS", 0, 110), ("KELP FOREST", 110, 170), ("TWILIGHT", 250, 320), ("THE WRECK", 320, 440), ("THE ABYSS", 440, 570),
         ("CRYSTAL CAVES", 570, 700), ("VENT FIELDS", 700, 830), ("BONE YARD", 830, 960), ("THE TRENCH", 960, 1110), ("THE FLOOR", 1110, 1160),
         ("CORAL REEF", 170, 250)]   # Nov 19, 2026: appended (zone indexes are saved), but it sits between Kelp and Twilight by depth
MAX_M = 1160
BOTTOM_M = 1158
BLEND = 18
ZONE_COL = [(86, 180, 240), (40, 150, 130), (40, 70, 160), (60, 50, 110), (30, 24, 70), (70, 40, 130), (130, 40, 30), (90, 96, 84), (14, 14, 30), (90, 44, 60), (200, 96, 118)]
WATER = [(-2, (120, 206, 250)), (0, (86, 180, 240)), (55, (58, 140, 224)), (110, (36, 128, 160)), (164, (28, 102, 140)), (178, (40, 140, 180)),
         (236, (36, 124, 172)), (252, (24, 64, 126)), (260, (22, 54, 120)), (320, (18, 40, 96)), (440, (14, 24, 64)), (570, (14, 14, 44)), (630, (36, 20, 70)), (700, (28, 14, 48)),
         (765, (58, 18, 20)), (830, (34, 16, 18)), (895, (24, 32, 32)), (960, (12, 14, 22)), (1110, (8, 8, 18)), (1200, (6, 6, 14))]
DEPTH_PX = MAX_M * M
BOTTOM_BONUS = 40
BOUNTY_X = 3

# (id, name, zone, (min lb, max lb), speed, weight in the spawn pool, tod or None, legendary)
SPECIES = [
    ("minnow", "MINNOW", 0, (1, 1), 30, 5, None, False), ("sardine", "SARDINE", 0, (1, 2), 34, 4, None, False),
    ("bluegill", "BLUEGILL", 0, (1, 3), 18, 4, None, False), ("clown", "CLOWNFISH", 0, (1, 2), 22, 4, None, False),
    ("perch", "PERCH", 0, (2, 4), 20, 3, None, False), ("angel", "ANGELFISH", 0, (3, 6), 16, 3, None, False),
    ("mackerel", "MACKEREL", 0, (4, 7), 32, 3, None, False), ("seahorse", "SEAHORSE", 0, (1, 2), 6, 2, None, False),
    ("turtle", "SEA TURTLE", 0, (14, 20), 10, 1, None, False),
    ("sunfish", "SUNFISH", 0, (6, 10), 12, 2, "MORNING", False), ("butterfly", "BUTTERFLYFISH", 0, (2, 5), 24, 3, "DAY", False),
    ("moonfish", "MOONFISH", 0, (7, 11), 14, 2, "NIGHT", False),
    ("koi", "GOLDEN KOI", 0, (60, 75), 26, 0, None, True), ("sunray", "SUN RAY", 0, (70, 85), 20, 0, None, True),

    ("bass", "BASS", 1, (4, 7), 22, 4, None, False), ("puffer", "PUFFERFISH", 1, (3, 5), 12, 3, None, False),
    ("parrot", "PARROTFISH", 1, (5, 8), 20, 3, None, False), ("trout", "TROUT", 1, (4, 6), 28, 4, None, False),
    ("pike", "PIKE", 1, (7, 11), 30, 3, None, False), ("catfish", "CATFISH", 1, (9, 14), 12, 2, None, False),
    ("carp", "CARP", 1, (6, 10), 16, 3, None, False), ("garibaldi", "GARIBALDI", 1, (3, 5), 20, 3, None, False),
    ("seadragon", "SEA DRAGON", 1, (3, 5), 10, 2, None, False), ("crab", "KELP CRAB", 1, (2, 4), 8, 2, None, False),
    ("ember", "EMBERFISH", 1, (8, 12), 22, 2, "DUSK", False),
    ("gus", "OLD GUS", 1, (90, 110), 14, 0, None, True), ("emerald", "EMERALD PIKE", 1, (95, 120), 34, 0, None, True),

    ("tuna", "TUNA", 2, (10, 15), 34, 4, None, False), ("squid", "SQUID", 2, (7, 11), 24, 3, None, False),
    ("lantern", "LANTERNFISH", 2, (3, 5), 26, 4, None, False), ("sword", "SWORDFISH", 2, (15, 22), 40, 2, None, False),
    ("barracuda", "BARRACUDA", 2, (12, 18), 38, 3, None, False), ("mahi", "MAHI-MAHI", 2, (10, 16), 30, 3, None, False),
    ("ray", "MANTA RAY", 2, (14, 22), 16, 2, None, False), ("shark", "REEF SHARK", 2, (24, 34), 26, 1, None, False),
    ("nautilus", "NAUTILUS", 2, (5, 8), 8, 2, None, False), ("oarfish", "OARFISH", 2, (14, 20), 18, 1, None, False),
    ("ghost", "GHOST SHARK", 2, (130, 160), 22, 0, None, True), ("marlin", "KING MARLIN", 2, (140, 170), 44, 0, None, True),

    ("eel", "MORAY EEL", 3, (8, 12), 24, 4, None, False), ("octo", "OCTOPUS", 3, (12, 17), 14, 3, None, False),
    ("grouper", "GROUPER", 3, (18, 26), 14, 3, None, False), ("snapper", "RED SNAPPER", 3, (9, 14), 22, 4, None, False),
    ("lionfish", "LIONFISH", 3, (6, 9), 12, 3, None, False), ("lobster", "LOBSTER", 3, (4, 7), 8, 3, None, False),
    ("bonefish", "BONEFISH", 3, (5, 8), 26, 3, None, False), ("conger", "CONGER EEL", 3, (12, 18), 20, 2, None, False),
    ("boot", "OLD BOOT", 3, (1, 1), 0, 2, None, False), ("anchor", "RUSTY ANCHOR", 3, (2, 2), 0, 1, None, False),
    ("chest", "TREASURE", 3, (120, 150), 0, 0, None, True), ("kraken", "BABY KRAKEN", 3, (160, 200), 12, 0, None, True),

    ("angler", "ANGLERFISH", 4, (16, 24), 16, 4, None, False), ("viper", "VIPERFISH", 4, (12, 18), 36, 4, None, False),
    ("gulper", "GULPER", 4, (22, 30), 18, 3, None, False), ("fangtooth", "FANGTOOTH", 4, (10, 15), 28, 4, None, False),
    ("dragon", "DRAGONFISH", 4, (14, 20), 32, 3, None, False), ("vampire", "VAMPIRE SQUID", 4, (16, 22), 16, 2, None, False),
    ("blob", "BLOBFISH", 4, (8, 12), 6, 2, None, False), ("isopod", "GIANT ISOPOD", 4, (6, 10), 8, 2, None, False),
    ("hatchet", "HATCHETFISH", 4, (3, 5), 24, 3, None, False),
    ("levi", "LEVIATHAN", 4, (220, 270), 26, 0, None, True), ("colossal", "COLOSSAL SQUID", 4, (240, 290), 18, 0, None, True),

    ("gcrab", "GHOST CRAB", 9, (20, 28), 10, 4, None, False), ("seapig", "SEA PIG", 9, (18, 26), 5, 4, None, False),
    ("dumbo", "DUMBO OCTOPUS", 9, (36, 48), 12, 3, None, False), ("tripod", "TRIPOD FISH", 9, (30, 40), 0, 2, None, False),
    ("coel", "COELACANTH", 9, (90, 120), 14, 1, None, False),
    ("pearl", "GIANT PEARL", 9, (460, 520), 0, 0, None, True), ("ancient", "THE ANCIENT ONE", 9, (560, 660), 14, 0, None, True),
]
SPECIES += [('tarpon', 'SILVER KING', 0, (64, 80), 36, 0, None, True), ('kelpie', 'THE KELPIE', 1, (100, 125), 10, 0, None, True), ('moby', 'PALE WHALE', 2, (150, 185), 14, 0, None, True), ('phantom', 'PHANTOM EEL', 3, (150, 185), 30, 0, None, True), ('dread', 'DREAD ANGLER', 4, (230, 280), 14, 0, None, True), ('needle', 'NEEDLEFISH', 0, (2, 4), 38, 3, None, False), ('wrasse', 'WRASSE', 1, (4, 7), 18, 3, None, False), ('bonito', 'BONITO', 2, (9, 13), 36, 3, None, False), ('wolf', 'WOLFFISH', 3, (14, 20), 16, 2, None, False), ('lizard', 'LIZARDFISH', 4, (9, 13), 30, 3, None, False), ('cavefish', 'BLIND CAVEFISH', 5, (12, 18), 20, 4, None, False), ('prism', 'PRISM TETRA', 5, (8, 12), 30, 4, None, False), ('geode', 'GEODE CRAB', 5, (14, 20), 8, 3, None, False), ('shard', 'SHARDFIN', 5, (22, 30), 26, 3, None, False), ('glasseel', 'GLASS EEL', 5, (18, 26), 28, 3, None, False), ('quartz', 'QUARTZ PUFFER', 5, (16, 22), 10, 3, None, False), ('opal', 'OPAL RAY', 5, (28, 38), 16, 2, None, False), ('glimmer', 'GLIMMER SQUID', 5, (20, 28), 22, 2, None, False), ('amethyst', 'AMETHYST BASS', 5, (26, 36), 18, 3, None, False), ('diamond', 'DIAMONDBACK', 5, (300, 360), 26, 0, None, True), ('serpent', 'PRISM SERPENT', 5, (320, 380), 34, 0, None, True), ('yeti', 'YETI CRAB', 6, (18, 26), 8, 4, None, False), ('shrimp', 'VENT SHRIMP', 6, (10, 16), 14, 4, None, False), ('magma', 'MAGMA EEL', 6, (30, 42), 30, 3, None, False), ('cinder', 'CINDERFISH', 6, (22, 30), 26, 4, None, False), ('sulfur', 'SULFUR SNAPPER', 6, (26, 36), 20, 3, None, False), ('scald', 'SCALD RAY', 6, (34, 46), 16, 2, None, False), ('ash', 'ASH GULPER', 6, (38, 52), 16, 2, None, False), ('embers', 'EMBER SQUID', 6, (28, 38), 24, 3, None, False), ('ironsnail', 'IRON SNAIL', 6, (16, 24), 6, 2, None, False), ('phoenix', 'PHOENIX FISH', 6, (380, 450), 30, 0, None, True), ('magmaw', 'MAGMAW', 6, (400, 480), 18, 0, None, True), ('hagfish', 'HAGFISH', 7, (24, 34), 22, 4, None, False), ('boneeater', 'BONE EATER', 7, (18, 26), 12, 4, None, False), ('ratfish', 'RATFISH', 7, (28, 38), 24, 3, None, False), ('skull', 'SKULLFISH', 7, (34, 46), 20, 3, None, False), ('grenadier', 'GRENADIER', 7, (36, 50), 22, 3, None, False), ('spider', 'SPIDER CRAB', 7, (30, 42), 8, 2, None, False), ('cusk', 'CUSK EEL', 7, (30, 40), 26, 3, None, False), ('lamprey', 'LAMPREY', 7, (24, 32), 32, 3, None, False), ('sleeper', 'SLEEPER SHARK', 7, (80, 110), 12, 1, None, False), ('megalodon', 'MEGALODON', 7, (480, 560), 24, 0, None, True), ('reaper', 'THE REAPER', 7, (460, 540), 30, 0, None, True), ('snailfish', 'HADAL SNAILFISH', 8, (30, 42), 14, 4, None, False), ('amphipod', 'GIANT AMPHIPOD', 8, (24, 34), 10, 4, None, False), ('faceless', 'FACELESS CUSK', 8, (40, 54), 18, 3, None, False), ('bigfin', 'BIGFIN SQUID', 8, (54, 72), 14, 2, None, False), ('telescope', 'TELESCOPEFISH', 8, (34, 46), 26, 3, None, False), ('barreleye', 'BARRELEYE', 8, (30, 40), 20, 3, None, False), ('swallower', 'BLACK SWALLOWER', 8, (44, 58), 22, 3, None, False), ('loosejaw', 'STOPLIGHT JAW', 8, (38, 50), 30, 3, None, False), ('frill', 'FRILLED SHARK', 8, (90, 120), 16, 1, None, False), ('trueking', 'THE KRAKEN', 8, (580, 680), 10, 0, None, True), ('abyssal', 'ABYSSAL KING', 8, (600, 700), 22, 0, None, True), ('poop', 'BROWN TROUT', 0, (1, 1), 16, 0, None, False)]
# Secret catches, never in the log, only placed by events (pool weight 0): the golden boot, the full-moon werewolf, the St. Patrick's lucky fish
SPECIES += [('gboot', 'GOLDEN BOOT', 3, (1, 1), 0, 0, None, False), ('werewolf', 'WEREWOLF FISH', 2, (44, 60), 20, 0, None, False), ('lucky', 'LUCKY GOLDFISH', 0, (7, 11), 24, 0, None, False)]
# Sharks (Nov 18, 2026): touch one anywhere but its back half and it bites. Appended so nothing above moves.
SPECIES += [('blacktip', 'BLACKTIP SHARK', 0, (12, 18), 30, 1, None, False), ('leopard', 'LEOPARD SHARK', 1, (16, 24), 16, 1, None, False),
            ('mako', 'MAKO SHARK', 2, (30, 42), 46, 1, None, False), ('hammer', 'HAMMERHEAD', 3, (34, 46), 22, 1, None, False),
            ('goblin', 'GOBLIN SHARK', 4, (40, 54), 14, 1, None, False), ('lshark', 'LANTERN SHARK', 5, (8, 12), 26, 1, None, False)]
# The Coral Reef (Nov 19, 2026): zone 10, between the Kelp Forest and Twilight. Appended so nothing above moves.
SPECIES += [('tang', 'BLUE TANG', 10, (3, 5), 26, 4, None, False), ('trigger', 'TRIGGERFISH', 10, (4, 7), 20, 3, None, False),
            ('idol', 'MOORISH IDOL', 10, (3, 5), 18, 3, None, False), ('cuttle', 'CUTTLEFISH', 10, (6, 10), 14, 3, None, False),
            ('boxfish', 'BOXFISH', 10, (2, 4), 10, 3, None, False), ('mantis', 'MANTIS SHRIMP', 10, (3, 5), 12, 2, None, False),
            ('napoleon', 'NAPOLEON WRASSE', 10, (18, 28), 12, 1, None, False), ('flash', 'FLASHLIGHT FISH', 10, (4, 6), 24, 3, 'NIGHT', False),
            ('whitetip', 'WHITETIP SHARK', 10, (18, 26), 24, 1, None, False), ('nurse', 'NURSE SHARK', 10, (24, 34), 10, 1, None, False),
            ('rainbow', 'RAINBOW PARROT', 10, (110, 140), 24, 0, None, True), ('goliath', 'GOLIATH GROUPER', 10, (120, 150), 12, 0, None, True),
            ('pmanta', 'PEARL MANTA', 10, (115, 145), 18, 0, None, True)]
REEF = ("tang", "trigger", "idol", "cuttle", "boxfish", "mantis", "napoleon", "flash", "whitetip", "nurse", "rainbow", "goliath", "pmanta")
SHARKS = ("blacktip", "leopard", "mako", "hammer", "goblin", "lshark", "sleeper", "frill", "megalodon", "whitetip", "nurse")
SPEC = {s[0]: s for s in SPECIES}
JUNK = ("boot", "anchor")                       # a pulse clears these out of the way
FIXED = ("chest", "pearl", "tripod", "gboot")   # these never move (and a pulse leaves them be)
GLOWS = ("angler", "jelly", "lantern", "levi", "viper", "chest", "dragon", "hatchet", "pearl", "ancient", "colossal", "vampire", "emerald", "lshark", "flash")
JELLY_CHANCE = [0.0, 0.07, 0.09, 0.11, 0.13, 0.11, 0.13, 0.12, 0.14, 0.0, 0.05]
PER_CHUNK = [(1, 2), (1, 2), (1, 2), (1, 2), (2, 2), (1, 2), (2, 2), (2, 2), (2, 2), (1, 2), (1, 2)]
CHUNK = [(1, 2), (1, 2), (1, 2), (1, 2), (2, 2), (1, 2)]
CHUNK = 72
TROPHY_CHANCE = 0.045
LEGEND_CHANCE = {"chest": 0.2, "pearl": 0.2, "ancient": 0.1}

# (id, name, what it does, sink speed, steering, pulses, trophy odds, legendary odds, pull on fish)
LURES = [
    ("standard", "STANDARD", "BALANCED. 1 PULSE", 1.0, 1.0, 1, 1.0, 1.0, 0),
    ("sinker", "HEAVY SINKER", "FAST DROP. 1 PULSE", 1.35, 0.78, 1, 1.0, 1.0, 0),
    ("glow", "GLOW LURE", "DRAWS TROPHIES+FISH", 1.0, 1.0, 1, 2.5, 1.5, 12),
    ("sonar", "SONAR", "3 PULSES. SLOW DROP", 0.85, 1.0, 3, 1.0, 1.0, 0),
]

JELLY = [["..ppppp..", ".pwwpppp.", "pwppppppp", "ppppppppp", "p.p.p.p.p", "p.p.p.p.p", "..p...p..", "..p...p.."],
         ["..ppppp..", ".pwwpppp.", "pwppppppp", "ppppppppp", ".p.p.p.p.", ".p.p.p.p.", ".p...p...", "....p...."]]
SQUID = ["....rrrrrr....", "t.trrrrrrrr...", ".ttrrrrrrrwkr.", "ttrrrrrrrrrrr.", ".ttrrrrrrrr...", "t.t.rrrrrr...."]
OCTO = ["...oooooo...", "..oooooooo..", ".oowkoowkoo.", ".oooooooooo.", ".oooooooooo.", "..oooooooo..", ".o.oo.oo.o..", "o..o..o..o..", "o.o..o..o.o."]
BOOT = ["..bbbb..", "..bddb..", "..bbbb..", "..bbbb..", "..bbbbb.", ".bbbbbbb", "bbbbbbbb", "kkkkkkkk"]
CHEST = ["..yyyyyyyy..", ".ybbbbbbbby.", "ybbbbyybbbby", "yyyyyyyyyyyy", "ybbbbykbbbby", "ybbbbyybbbby", "ybbbbbbbbbby", "yyyyyyyyyyyy"]
CRAB = ["r.........r", "rr.rrrrr.rr", ".rrrwrwrrr.", "..rrrrrrr..", ".r.r.r.r.r.", "r..r...r..r"]
SEAHORSE = ["..yyy.", ".ykyyy", ".yyy..", "..yy..", ".yyyy.", ".yyyy.", "..yy..", "..yy..", ".yy...", ".yyy.."]
TURTLE = ["....gggggg......", "..gggddgggg.....", ".ggdggggdggg.ll.", "gggggddggggglwkl", ".ggdggggdggg.ll.", "..gggggggggg....", ".ll..llll..ll...", "ll....ll....ll.."]
RAY = ["........mm..........", "......mmmmmm........", "....mmmmmmmmmm.mm...", "..mmmmwmmmmmmmmm....", "tttmmmmmmmmmmmmk....", "..mmmmwmmmmmmmmm....", "....mmmmmmmmmm.mm...", "......mmmmmm........", "........mm.........."]
LOBSTER = ["r.r.........rr", ".rrrrrrrrr.rr.", "rrrrrrrrrwkr..", ".rrrrrrrrr.rr.", "r.r.r.r.r...rr"]
NAUTILUS = ["..ssssss..", ".sswwwwss.", "sswssswwss", "sswswsswss", "sswwwssoss", ".sssssoko.", "..ssss.ooo", "........o."]
ISOPOD = ["..pppppppp..", ".pdpdpdpdpp.", "ppdpdpdpdpkp", "pppppppppppp", ".l.l.l.l.l.."]
PEARL = ["..cccccccc..", ".cddddddddc.", "cdd.wwww.ddc", "cd.wweeww.dc", "cdd.wwww.ddc", "cccccccccccc", ".cccccccccc.", "..cccccccc.."]
ANCHOR = ["...aaa...", "...a.a...", "...aaa...", "....a....", ".aaaaaaa.", "....a....", "a...a...a", "aa..a..aa", ".aaaaaaa.", "..aaaaa.."]
SEAPIG = [".a.a..a...", "..pppppp..", ".ppppppkp.", ".pppppppp.", "..pppppp..", ".l.l.l.l.."]
BOAT = ["..............................", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "bwwwwwwwwwwwwwwwwwwwwwwwwwwwwb", ".brrrrrrrrrrrrrrrrrrrrrrrrrrb.",
        "..brrrrrrrrrrrrrrrrrrrrrrrrb..", "...bddddddddddddddddddddddb...", "....bbbbbbbbbbbbbbbbbbbbbb...."]
HOOK = [".k..", ".k..", ".k..", ".k.k", ".k.k", "..k."]


def time_of_day(now=None):
    h = (now or datetime.datetime.now()).hour
    return "MORNING" if 5 <= h < 11 else "DAY" if 11 <= h < 17 else "DUSK" if 17 <= h < 21 else "NIGHT"


def water_color(m):
    for (a0, c0), (a1, c1) in zip(WATER, WATER[1:]):
        if m <= a1:
            return lerp_col(c0, c1, (m - a0) / (a1 - a0))
    return WATER[-1][1]


ZORDER = sorted(range(len(ZONES)), key=lambda i: ZONES[i][1])   # zones by depth (the Coral Reef was appended)


def zone_of(m):
    for i in ZORDER:
        if m < ZONES[i][2]:
            return i
    return ZORDER[-1]


def load_save():
    try:
        with open(SAVE) as f:
            d = json.load(f)
    except Exception:
        d = {}
    d.setdefault("total", 0); d.setdefault("log", {}); d.setdefault("pending", [])
    return d


def write_save(d):
    try:
        tmp = SAVE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(d, f)
        os.replace(tmp, SAVE)
    except OSError:
        pass


def todays_bounty(day=None):
    """One ordinary species is worth triple today - the same one for everybody."""
    pool = [s[0] for s in SPECIES if not s[7] and s[6] is None and s[4] > 0 and s[2] <= 4 and s[5] >= 2]
    return random.Random(ac.daily_seed(day) * 7 + 1).choice(pool)


def on_saved(initials):
    """Called by the arcade after initials are entered: put a name on this run's records."""
    d = load_save()
    for fid in d.get("pending", []):
        if fid in d["log"]:
            d["log"][fid]["by"] = initials
    d["pending"] = []
    write_save(d)


# ====================================================================== art
class Art:
    def __init__(self, pg):
        self.pg = pg
        self.spr = {}
        F = self.fish
        mk = {
            "minnow": lambda: F(7, 3, (196, 214, 232), (240, 246, 252), (150, 170, 196)),
            "bluegill": lambda: F(9, 7, (70, 130, 220), (250, 190, 90), (40, 90, 170), "stripes", (40, 90, 170)),
            "clown": lambda: F(9, 5, (250, 130, 40), (250, 130, 40), (40, 34, 44), "bands", WHITE),
            "perch": lambda: F(11, 5, (236, 200, 70), (250, 240, 190), (230, 110, 50), "stripes", (90, 110, 60)),
            "sunfish": lambda: F(11, 12, (250, 170, 60), (255, 226, 130), (240, 110, 50), "spots", (255, 240, 170)),
            "butterfly": lambda: F(8, 8, (255, 226, 70), (255, 250, 200), (40, 34, 44), "bands", (40, 34, 44)),
            "moonfish": lambda: F(11, 10, (210, 224, 250), (255, 255, 255), (150, 170, 230), "spots", (255, 255, 255)),
            "koi": lambda: F(16, 7, (255, 200, 40), (255, 240, 170), (255, 130, 40), "spots", WHITE),
            "bass": lambda: F(13, 6, (90, 150, 80), (220, 236, 190), (60, 110, 60), "stripes", (60, 110, 60)),
            "parrot": lambda: F(12, 6, (50, 200, 190), (250, 150, 190), (250, 210, 70), "spots", (120, 240, 220)),
            "trout": lambda: F(13, 5, (180, 150, 130), (250, 200, 190), (150, 110, 100), "spots", (110, 70, 70)),
            "ember": lambda: F(12, 6, (240, 80, 50), (255, 190, 70), (150, 40, 40), "stripes", (255, 190, 70)),
            "gus": lambda: self.whiskers(F(26, 9, (92, 84, 96), (190, 180, 170), (60, 54, 66), "spots", (60, 54, 66))),
            "tuna": lambda: F(18, 8, (60, 100, 180), (226, 234, 246), (240, 210, 70)),
            "lantern": lambda: F(8, 4, (60, 70, 130), (90, 100, 170), (40, 46, 96), "glow", (140, 255, 230)),
            "sword": lambda: self.bill(F(20, 6, (70, 100, 170), (220, 230, 245), (50, 70, 130))),
            "ghost": lambda: F(28, 9, (200, 226, 240), (240, 250, 255), (160, 196, 220), "spots", (255, 255, 255), fin_h=5),
            "eel": lambda: F(24, 3, (110, 150, 60), (190, 210, 110), (80, 110, 50), "spots", (60, 90, 40), tail=2),
            "grouper": lambda: F(20, 11, (150, 104, 70), (220, 190, 150), (110, 76, 56), "spots", (100, 66, 46)),
            "angler": lambda: self.lure(F(13, 10, (70, 50, 76), (110, 80, 110), (50, 36, 56), "teeth", WHITE)),
            "viper": lambda: F(16, 4, (40, 44, 70), (70, 80, 120), (30, 32, 54), "glow", (255, 90, 200)),
            "gulper": lambda: F(18, 10, (50, 40, 70), (130, 60, 110), (40, 30, 56), "teeth", WHITE),
            "levi": lambda: F(46, 8, (40, 110, 110), (150, 220, 190), (30, 80, 90), "glow", (140, 255, 230), tail=6, fin_h=4),
            "puffer": lambda: self.spikes(F(8, 8, (240, 214, 110), (255, 250, 220), (200, 160, 70), "spots", (170, 130, 60))),
            "squid": lambda: outlined(pg, from_rows(pg, SQUID, {"r": (236, 110, 130), "t": (250, 160, 170), "w": WHITE, "k": INK})),
            "octo": lambda: outlined(pg, from_rows(pg, OCTO, {"o": (190, 90, 190), "w": WHITE, "k": INK})),
            "boot": lambda: outlined(pg, from_rows(pg, BOOT, {"b": (120, 84, 60), "d": (70, 50, 40), "k": (50, 40, 40)})),
            "chest": lambda: outlined(pg, from_rows(pg, CHEST, {"y": (255, 206, 60), "b": (140, 90, 50), "k": INK})),
            "sardine": lambda: F(8, 3, (170, 190, 220), (235, 240, 250), (120, 140, 180)),
            "angel": lambda: F(9, 10, (250, 240, 200), (255, 250, 230), (240, 180, 60), "bands", (60, 50, 70), fin_h=4),
            "mackerel": lambda: F(13, 4, (60, 140, 150), (220, 236, 240), (40, 100, 120), "stripes", (30, 80, 100)),
            "seahorse": lambda: outlined(pg, from_rows(pg, SEAHORSE, {"y": (250, 200, 80), "k": INK})),
            "turtle": lambda: outlined(pg, from_rows(pg, TURTLE, {"g": (70, 150, 90), "d": (40, 100, 70), "l": (150, 200, 120), "w": WHITE, "k": INK})),
            "sunray": lambda: outlined(pg, from_rows(pg, RAY, {"m": (255, 200, 50), "t": (255, 150, 40), "w": WHITE, "k": INK})),
            "pike": lambda: F(18, 4, (110, 140, 70), (210, 220, 160), (80, 110, 50), "spots", (220, 230, 150)),
            "catfish": lambda: self.whiskers(F(15, 6, (90, 80, 70), (200, 190, 170), (60, 54, 50))),
            "carp": lambda: F(14, 7, (200, 140, 60), (240, 210, 150), (160, 100, 50), "spots", (160, 100, 50)),
            "garibaldi": lambda: F(10, 7, (255, 120, 30), (255, 170, 60), (230, 90, 20)),
            "seadragon": lambda: F(12, 4, (120, 170, 60), (220, 200, 90), (200, 150, 50), "spots", (240, 220, 110), fin_h=4),
            "crab": lambda: outlined(pg, from_rows(pg, CRAB, {"r": (220, 90, 60), "w": WHITE})),
            "emerald": lambda: F(26, 6, (30, 190, 120), (170, 250, 200), (20, 130, 90), "glow", (220, 255, 230)),
            "barracuda": lambda: F(20, 4, (150, 170, 190), (230, 236, 244), (100, 120, 150), "stripes", (90, 110, 140)),
            "mahi": lambda: F(16, 7, (60, 190, 120), (250, 220, 70), (40, 120, 200), "spots", (40, 120, 200)),
            "ray": lambda: outlined(pg, from_rows(pg, RAY, {"m": (90, 110, 150), "t": (60, 76, 110), "w": WHITE, "k": INK})),
            "shark": lambda: F(24, 8, (110, 124, 144), (220, 226, 236), (80, 92, 112), fin_h=5),
            "nautilus": lambda: outlined(pg, from_rows(pg, NAUTILUS, {"s": (210, 120, 70), "w": (250, 236, 210), "o": (240, 190, 190), "k": INK})),
            "oarfish": lambda: F(30, 3, (200, 210, 224), (240, 244, 250), (230, 70, 70), tail=2),
            "marlin": lambda: self.bill(F(26, 8, (40, 70, 170), (200, 220, 250), (30, 50, 130), "stripes", (90, 140, 230), fin_h=6)),
            "snapper": lambda: F(13, 7, (230, 90, 80), (250, 190, 180), (190, 60, 60)),
            "lionfish": lambda: self.spikes(F(11, 8, (230, 120, 90), (250, 230, 210), (160, 60, 50), "stripes", (250, 240, 230), fin_h=4)),
            "lobster": lambda: outlined(pg, from_rows(pg, LOBSTER, {"r": (200, 60, 50), "w": WHITE, "k": INK})),
            "bonefish": lambda: F(13, 5, (214, 214, 200), (240, 240, 230), (170, 170, 160), "bands", (50, 50, 60)),
            "conger": lambda: F(28, 4, (80, 84, 110), (150, 150, 170), (60, 60, 84), tail=2),
            "anchor": lambda: outlined(pg, from_rows(pg, ANCHOR, {"a": (130, 110, 100)})),
            "kraken": lambda: outlined(pg, pg.transform.scale(from_rows(pg, OCTO, {"o": (220, 70, 70), "w": (255, 240, 150), "k": INK}), (24, 18))),
            "fangtooth": lambda: F(10, 8, (70, 46, 46), (110, 66, 66), (46, 30, 34), "teeth", WHITE),
            "dragon": lambda: F(20, 3, (36, 36, 60), (60, 60, 96), (24, 24, 44), "glow", (90, 255, 160), tail=2),
            "vampire": lambda: outlined(pg, from_rows(pg, SQUID, {"r": (130, 24, 50), "t": (190, 50, 80), "w": (120, 200, 255), "k": INK})),
            "blob": lambda: F(11, 9, (230, 170, 170), (250, 210, 210), (200, 130, 140)),
            "isopod": lambda: outlined(pg, from_rows(pg, ISOPOD, {"p": (190, 170, 190), "d": (140, 120, 150), "l": (150, 130, 160), "k": INK})),
            "hatchet": lambda: F(7, 8, (170, 180, 200), (220, 230, 245), (120, 130, 160), "glow", (140, 220, 255)),
            "colossal": lambda: outlined(pg, pg.transform.scale(from_rows(pg, SQUID, {"r": (170, 40, 60), "t": (220, 90, 100), "w": (255, 240, 150), "k": INK}), (42, 18))),
            "gcrab": lambda: outlined(pg, from_rows(pg, CRAB, {"r": (214, 224, 236), "w": (255, 120, 120)})),
            "seapig": lambda: outlined(pg, from_rows(pg, SEAPIG, {"p": (250, 180, 190), "a": (230, 140, 160), "l": (230, 140, 160), "k": INK})),
            "dumbo": lambda: outlined(pg, from_rows(pg, OCTO, {"o": (255, 170, 120), "w": WHITE, "k": INK})),
            "tripod": lambda: self.legs(F(12, 4, (200, 200, 214), (232, 232, 244), (150, 150, 174))),
            "coel": lambda: F(24, 10, (50, 70, 120), (90, 110, 160), (40, 54, 96), "spots", (200, 210, 240), fin_h=3),
            "pearl": lambda: outlined(pg, from_rows(pg, PEARL, {"c": (150, 110, 150), "d": (90, 60, 100), "w": (240, 240, 255), "e": WHITE})),
            "ancient": lambda: F(56, 13, (40, 50, 76), (80, 66, 120), (24, 30, 50), "glow", (255, 120, 90), tail=8, fin_h=5),
        }
        C = lambda rows, pal, k=1: outlined(pg, pg.transform.scale(from_rows(pg, rows, pal), (int(len(rows[0]) * k), int(len(rows) * k))) if k != 1 else from_rows(pg, rows, pal))
        K = {"k": INK, "w": WHITE}
        mk.update({
            "tarpon": lambda: F(30, 8, (190, 200, 216), (240, 244, 250), (130, 144, 170), "glow", (255, 255, 255), fin_h=4),
            "kelpie": lambda: C(SEAHORSE, {"y": (40, 190, 110), "k": INK}, 2.4),
            "moby": lambda: F(44, 15, (226, 230, 236), (250, 250, 255), (180, 188, 204), tail=9, fin_h=2),
            "phantom": lambda: F(40, 5, (150, 220, 230), (220, 250, 255), (90, 170, 190), "glow", WHITE, tail=2),
            "dread": lambda: self.lure(F(24, 16, (60, 30, 80), (110, 60, 120), (40, 20, 56), "teeth", WHITE, tail=5)),
            "needle": lambda: self.bill(F(14, 2, (150, 200, 190), (230, 244, 240), (100, 160, 150))),
            "wrasse": lambda: F(12, 6, (60, 170, 200), (250, 200, 90), (230, 90, 140), "stripes", (230, 90, 140)),
            "bonito": lambda: F(15, 6, (50, 90, 150), (220, 230, 240), (30, 60, 110), "stripes", (30, 50, 90)),
            "wolf": lambda: F(18, 7, (100, 110, 130), (160, 170, 190), (70, 78, 96), "teeth", WHITE, tail=3),
            "lizard": lambda: F(14, 4, (170, 130, 90), (230, 210, 170), (120, 90, 60), "spots", (110, 80, 50)),
            "cavefish": lambda: F(11, 5, (250, 214, 220), (255, 240, 244), (230, 170, 190)),
            "prism": lambda: F(8, 5, (120, 230, 255), (255, 170, 240), (255, 240, 120), "glow", WHITE),
            "geode": lambda: C(CRAB, {"r": (150, 90, 210), "w": (140, 255, 250)}),
            "shard": lambda: self.spikes(F(15, 7, (90, 200, 220), (220, 250, 255), (60, 140, 180), "bands", (240, 255, 255), fin_h=3)),
            "glasseel": lambda: F(24, 3, (170, 220, 240), (230, 250, 255), (120, 180, 220), "glow", (255, 255, 255), tail=2),
            "quartz": lambda: self.spikes(F(10, 10, (240, 220, 250), (255, 250, 255), (200, 170, 230), "spots", (190, 150, 230))),
            "opal": lambda: C(RAY, {"m": (150, 230, 220), "t": (240, 170, 230), "w": WHITE, "k": INK}),
            "glimmer": lambda: C(SQUID, {"r": (70, 200, 230), "t": (160, 240, 250), "w": WHITE, "k": INK}),
            "amethyst": lambda: F(16, 8, (150, 90, 210), (210, 170, 250), (100, 60, 160), "stripes", (90, 50, 150)),
            "diamond": lambda: self.spikes(F(34, 10, (200, 240, 255), (255, 255, 255), (120, 200, 240), "bands", (90, 180, 240), fin_h=4)),
            "serpent": lambda: F(58, 5, (255, 130, 230), (140, 240, 255), (255, 240, 120), "glow", WHITE, tail=3, fin_h=3),
            "yeti": lambda: C(CRAB, {"r": (244, 240, 226), "w": (255, 170, 90)}),
            "shrimp": lambda: C(LOBSTER, {"r": (255, 160, 130), "w": WHITE, "k": INK}),
            "magma": lambda: F(26, 4, (60, 30, 30), (120, 50, 40), (255, 130, 40), "glow", (255, 200, 60), tail=2),
            "cinder": lambda: F(12, 7, (70, 60, 64), (120, 100, 100), (255, 120, 50), "spots", (255, 150, 60)),
            "sulfur": lambda: F(14, 8, (230, 200, 60), (250, 240, 150), (190, 150, 30)),
            "scald": lambda: C(RAY, {"m": (150, 60, 50), "t": (255, 140, 60), "w": (255, 230, 150), "k": INK}),
            "ash": lambda: F(18, 12, (90, 86, 92), (140, 134, 140), (60, 56, 64), "teeth", WHITE, tail=6),
            "embers": lambda: C(SQUID, {"r": (230, 90, 40), "t": (255, 170, 70), "w": (255, 250, 200), "k": INK}),
            "ironsnail": lambda: C(NAUTILUS, {"s": (90, 96, 110), "w": (160, 170, 190), "o": (210, 150, 120), "k": INK}),
            "phoenix": lambda: self.spikes(F(30, 10, (255, 150, 40), (255, 230, 120), (230, 60, 30), "glow", (255, 250, 200), fin_h=5)),
            "magmaw": lambda: F(40, 18, (50, 30, 34), (255, 110, 40), (30, 18, 22), "teeth", (255, 230, 150), tail=7, fin_h=3),
            "hagfish": lambda: F(24, 3, (200, 150, 160), (230, 190, 196), (160, 110, 124), tail=2),
            "boneeater": lambda: F(10, 4, (230, 80, 90), (250, 170, 170), (190, 50, 60), tail=5),
            "ratfish": lambda: F(16, 7, (150, 140, 160), (220, 214, 230), (110, 100, 124), "spots", (240, 240, 250), tail=7),
            "skull": lambda: F(14, 9, (40, 40, 50), (70, 70, 84), (224, 224, 210), "bands", (224, 224, 210)),
            "grenadier": lambda: F(16, 7, (110, 100, 96), (170, 160, 154), (80, 72, 70), tail=9),
            "spider": lambda: C(CRAB, {"r": (220, 120, 70), "w": WHITE}, 1.7),
            "cusk": lambda: F(24, 4, (170, 150, 120), (210, 196, 170), (130, 112, 90), tail=2),
            "lamprey": lambda: F(22, 3, (90, 100, 70), (150, 160, 120), (60, 70, 50), "teeth", WHITE, tail=2),
            "sleeper": lambda: F(36, 10, (90, 100, 104), (140, 150, 154), (64, 72, 78), "spots", (60, 66, 72), fin_h=4),
            "megalodon": lambda: F(62, 18, (80, 92, 110), (220, 226, 236), (56, 66, 84), "teeth", WHITE, fin_h=8),
            "reaper": lambda: F(46, 9, (224, 224, 210), (250, 250, 240), (120, 120, 116), "bands", (30, 30, 40), tail=10, fin_h=4),
            "snailfish": lambda: F(13, 6, (240, 210, 220), (255, 236, 240), (220, 170, 190), tail=6),
            "amphipod": lambda: C(ISOPOD, {"p": (240, 220, 200), "d": (210, 170, 150), "l": (220, 190, 170), "k": INK}, 1.3),
            "faceless": lambda: F(18, 7, (120, 100, 90), (160, 140, 130), (90, 74, 68)),
            "bigfin": lambda: C(SQUID, {"r": (200, 160, 190), "t": (240, 210, 230), "w": WHITE, "k": INK}, 1.6),
            "telescope": lambda: F(14, 5, (40, 40, 60), (70, 70, 100), (26, 26, 44), "glow", (255, 255, 160), tail=6),
            "barreleye": lambda: F(12, 7, (50, 60, 70), (60, 230, 130), (30, 40, 50), "glow", (120, 255, 170)),
            "swallower": lambda: F(12, 12, (20, 20, 28), (50, 50, 64), (12, 12, 18), "teeth", WHITE, tail=5),
            "loosejaw": lambda: F(16, 5, (30, 20, 24), (60, 30, 36), (20, 12, 16), "glow", (255, 60, 60)),
            "frill": lambda: F(40, 6, (110, 90, 80), (160, 140, 130), (80, 64, 58), "teeth", WHITE, tail=6, fin_h=3),
            "trueking": lambda: C(OCTO, {"o": (140, 30, 50), "w": (255, 220, 90), "k": INK}, 4.6),
            "abyssal": lambda: self.lure(F(60, 20, (20, 16, 40), (60, 40, 110), (12, 10, 26), "glow", (160, 120, 255), tail=10, fin_h=6)),
            "poop": lambda: C(["......bb....", ".....bbbb...", "t...bblbbb..", "tt.bbbbbbbb.", "tttbbbbwkbb.", "tt.bbbbbbbbb", "t..bblbbbbbb", "....bbbbbbb."], {"b": (130, 84, 40), "l": (170, 120, 64), "t": (100, 62, 30), "w": WHITE, "k": INK}),
            "gboot": lambda: outlined(pg, from_rows(pg, BOOT, {"b": (255, 206, 60), "d": (200, 140, 30), "k": (255, 250, 200)})),
            "werewolf": lambda: self.spikes(F(16, 8, (112, 98, 90), (176, 158, 140), (78, 68, 62), "teeth", WHITE)),
            "lucky": lambda: F(10, 6, (255, 204, 50), (255, 240, 160), (60, 180, 80), "spots", (70, 200, 90)),
            "blacktip": lambda: F(22, 6, (130, 142, 156), (236, 240, 246), (34, 36, 46), "teeth", WHITE, fin_h=5),
            "leopard": lambda: F(24, 6, (176, 154, 112), (238, 228, 204), (130, 108, 76), "spots", (64, 50, 38), fin_h=4),
            "mako": lambda: F(26, 7, (54, 86, 170), (230, 236, 248), (36, 60, 130), "teeth", WHITE, tail=8, fin_h=5),
            "hammer": lambda: self.hammer(F(28, 7, (118, 128, 140), (226, 230, 236), (84, 92, 104), fin_h=6)),
            "goblin": lambda: self.snout(F(30, 7, (222, 160, 170), (244, 204, 210), (186, 118, 136), "teeth", WHITE, fin_h=4)),
            "lshark": lambda: F(14, 5, (36, 40, 66), (64, 72, 112), (26, 28, 50), "glow", (130, 210, 255), fin_h=3),
            # the Coral Reef
            "tang": lambda: F(10, 7, (40, 92, 220), (70, 140, 240), (255, 214, 50), "stripes", (20, 30, 80), fin_h=3),
            "trigger": lambda: F(11, 8, (226, 204, 150), (250, 242, 222), (60, 120, 220), "stripes", (60, 120, 220), fin_h=3),
            "idol": lambda: F(9, 9, (250, 242, 212), (255, 250, 236), (250, 210, 60), "bands", (34, 30, 40), fin_h=5),
            "cuttle": lambda: C(SQUID, {"r": (206, 150, 110), "t": (236, 192, 150), "w": (255, 240, 200), "k": INK}),
            "boxfish": lambda: F(8, 7, (250, 220, 50), (255, 242, 160), (240, 186, 40), "spots", (34, 30, 40), tail=3),
            "mantis": lambda: C(LOBSTER, {"r": (60, 200, 140), "w": (255, 120, 90), "k": INK}),
            "napoleon": lambda: F(20, 11, (60, 150, 150), (126, 204, 190), (40, 110, 120), "stripes", (100, 210, 230), fin_h=3),
            "flash": lambda: F(9, 5, (34, 34, 56), (54, 54, 86), (22, 22, 40), "glow", (180, 255, 240)),
            "whitetip": lambda: F(24, 6, (120, 128, 142), (232, 236, 242), (250, 250, 255), "teeth", WHITE, fin_h=5),
            "nurse": lambda: self.whiskers(F(26, 7, (172, 142, 100), (222, 204, 172), (140, 112, 80), fin_h=4)),
            "rainbow": lambda: F(24, 10, (70, 220, 200), (255, 150, 200), (255, 210, 60), "spots", (255, 110, 220), fin_h=4),
            "goliath": lambda: F(32, 15, (124, 112, 72), (204, 192, 142), (92, 82, 52), "spots", (70, 60, 40), tail=7, fin_h=4),
            "pmanta": lambda: C(RAY, {"m": (240, 236, 250), "t": (255, 170, 200), "w": (120, 200, 255), "k": INK}, 2),
        })
        assert set(mk) == set(SPEC), set(SPEC) ^ set(mk)
        self.big = {}
        for fid, f in mk.items():
            right = f()
            self.spr[fid] = (right, pg.transform.flip(right, True, False))
        self.jelly = [outlined(pg, from_rows(pg, fr, {"p": (255, 130, 210), "w": (255, 220, 245)})) for fr in JELLY]
        self.boat = outlined(pg, from_rows(pg, BOAT, {"b": (110, 70, 44), "w": (250, 246, 236), "r": (226, 78, 70), "d": (170, 54, 54)}))
        self.hook = from_rows(pg, HOOK, {"k": (226, 232, 244)})
        self.build_water()
        wh = pg.Surface((64, 22), pg.SRCALPHA)
        pg.draw.ellipse(wh, (20, 44, 100), (8, 2, 54, 18)); pg.draw.polygon(wh, (20, 44, 100), [(0, 0), (14, 10), (0, 20)])
        pg.draw.ellipse(wh, (34, 62, 124), (14, 11, 44, 8)); wh.fill((200, 220, 255), (52, 8, 2, 2))
        wh = pg.transform.scale(wh, (128, 44))
        self.whale = (wh, pg.transform.flip(wh, True, False))

    def get(self, fid, trophy=False):
        """(facing right, facing left); trophies are the same fish, a lot bigger."""
        if not trophy:
            return self.spr[fid]
        if fid not in self.big:
            a = self.spr[fid][0]
            w, h = a.get_size()
            b = self.pg.transform.scale(a, (int(w * 1.7), int(h * 1.7)))
            self.big[fid] = (b, self.pg.transform.flip(b, True, False))
        return self.big[fid]

    def legs(self, s):
        w, h = s.get_size()
        out = self._extend(s, top=0)
        out2 = self.pg.Surface((w, h + 6), self.pg.SRCALPHA)
        out2.blit(out, (0, 0))
        for x in (3, w // 2, w - 5):
            out2.fill((150, 150, 174), (x, h - 2, 1, 8))
        return out2

    # --------------------------------------------------------- fish builder
    def fish(self, L, H, body, belly, fin, pattern=None, pat=None, tail=None, fin_h=2):
        pg = self.pg
        tw = tail if tail is not None else max(3, L // 4)
        W, top = L + tw, fin_h
        s = pg.Surface((W, H + top + 1), pg.SRCALPHA)
        mid = top + H // 2
        pg.draw.polygon(s, fin, [(0, top), (tw + 1, mid), (0, top + H - 1)])
        rect = pg.Rect(tw - 1, top, L + 1, H)
        pg.draw.ellipse(s, body, rect)
        s.set_clip(pg.Rect(0, top + int(H * 0.6), W, H))
        pg.draw.ellipse(s, belly, rect)
        s.set_clip(None)
        if H >= 5:
            pg.draw.polygon(s, fin, [(tw + L // 3, top + 1), (tw + L // 2, 0), (tw + L * 2 // 3 + 1, top + 1)])
        colours = (tuple(body) + (255,), tuple(belly) + (255,))
        for x in range(rect.x, rect.right - 4):
            for y in range(rect.y, rect.bottom):
                if tuple(s.get_at((x, y))) not in colours:
                    continue
                rx = x - tw
                if pattern == "stripes" and rx % 4 == 2 and y < top + H * 0.7:
                    s.set_at((x, y), pat)
                elif pattern == "bands" and rx in (L // 3, L // 3 + 1, L * 2 // 3):
                    s.set_at((x, y), pat)
                elif pattern == "spots" and (rx * 7 + y * 13) % 11 == 0:
                    s.set_at((x, y), pat)
                elif pattern == "glow" and y == mid + 1 and rx % 3 == 1:
                    s.set_at((x, y), pat)
        ex = W - 4 if H >= 5 else W - 3
        if H >= 5:
            s.fill(WHITE, (ex, mid - 2, 2, 2)); s.set_at((ex + 1, mid - 1), INK)
        else:
            s.set_at((ex, mid - 1 if H > 3 else mid), INK)
        if pattern == "teeth":
            for x in range(W - 6, W - 1, 2):
                s.set_at((x, mid + 1), pat)
            s.fill(INK, (W - 6, mid + 2, 5, 1))
        return outlined(pg, s)

    def _extend(self, s, left=0, right=0, top=0):
        out = self.pg.Surface((s.get_width() + left + right, s.get_height() + top), self.pg.SRCALPHA)
        out.blit(s, (left, top))
        return out

    def whiskers(self, s):
        s = self._extend(s, right=3)
        w, h = s.get_size()
        for dy in (0, 2):
            s.fill(INK, (w - 4, h // 2 + dy, 4, 1))
        return s

    def hammer(self, s):                       # the hammerhead's wide head: a bar across the nose with an eye at each end
        s = self._extend(s, right=2)
        w, h = s.get_size()
        mid = h // 2 + 2
        s.fill(INK, (w - 4, mid - 6, 4, 11)); s.fill((118, 128, 140), (w - 3, mid - 5, 2, 9))
        s.set_at((w - 2, mid - 5), WHITE); s.set_at((w - 2, mid + 3), WHITE)
        return s

    def snout(self, s):                        # the goblin shark's long flat nose
        s = self._extend(s, right=5)
        w, h = s.get_size()
        mid = h // 2
        s.fill(INK, (w - 7, mid - 2, 7, 3)); s.fill((240, 184, 192), (w - 7, mid - 1, 6, 1))
        return s

    def bill(self, s):
        s = self._extend(s, right=7)
        w, h = s.get_size()
        s.fill(INK, (w - 9, h // 2, 9, 1)); s.fill((200, 210, 230), (w - 8, h // 2 - 1, 7, 1))
        return s

    def lure(self, s):
        s = self._extend(s, right=3, top=4)
        w, h = s.get_size()
        s.fill(INK, (w - 8, 3, 1, 3)); s.fill(INK, (w - 8, 2, 5, 1)); s.fill(INK, (w - 4, 2, 1, 2))
        s.fill((255, 250, 170), (w - 5, 4, 3, 3)); s.set_at((w - 4, 5), WHITE)
        return s

    def spikes(self, s):
        w, h = s.get_size()
        out = self._extend(s, top=1)
        for x in range(4, w - 2, 3):
            out.set_at((x, 1), INK); out.set_at((x, h), INK)
        return out

    def build_water(self):
        pg = self.pg
        self.water_h = DEPTH_PX + 260
        w = pg.Surface((LW, self.water_h)).convert()
        band = 6
        for y0 in range(0, self.water_h, band):
            c, c2 = water_color(y0 / M), water_color((y0 + band) / M)
            w.fill(c, (0, y0, LW, band))
            for x in range(LW):
                if (x + y0 // band) % 2 == 0:
                    w.set_at((x, y0 + band - 1), c2)
                if (x + (y0 // band) * 2) % 4 == 0:
                    w.set_at((x, y0 + band - 2), c2)
        rnd = random.Random(3)
        # the wreck: a sunken ship lying across the right side, with its broken stern further down on the left
        wy = 350 * M
        hull, deck, dark = (50, 58, 84), (74, 80, 104), (30, 34, 56)
        pg.draw.polygon(w, hull, [(44, wy + 60), (120, wy + 20), (120, wy + 210), (60, wy + 210), (40, wy + 150)])
        pg.draw.polygon(w, dark, [(60, wy + 210), (120, wy + 210), (120, wy + 170), (52, wy + 190)])
        pg.draw.line(w, deck, (44, wy + 60), (120, wy + 20), 3)
        pg.draw.line(w, deck, (84, wy + 40), (70, wy - 30), 3); pg.draw.line(w, deck, (60, wy - 4), (86, wy - 14), 2)
        for i in range(5):
            cx, cy = 66 + i * 11, wy + 96 + i * 3
            pg.draw.circle(w, dark, (cx, cy), 4); pg.draw.circle(w, (255, 220, 110) if i % 2 == 0 else (20, 24, 44), (cx, cy), 2)
        for _ in range(60):
            x, y = rnd.randrange(46, 120), wy + rnd.randrange(30, 208)
            if tuple(w.get_at((x, y)))[:3] == hull:
                w.set_at((x, y), rnd.choice([deck, dark, (60, 110, 100)]))
        sy = 404 * M
        pg.draw.polygon(w, hull, [(0, sy + 10), (46, sy + 40), (58, sy + 120), (0, sy + 150)])
        pg.draw.polygon(w, dark, [(0, sy + 110), (58, sy + 120), (0, sy + 150)])
        pg.draw.line(w, deck, (0, sy + 10), (46, sy + 40), 3); pg.draw.line(w, deck, (20, sy + 24), (30, sy - 40), 2)
        for i in range(3):
            pg.draw.circle(w, dark, (12 + i * 14, sy + 70 + i * 6), 4); pg.draw.circle(w, (20, 24, 44), (12 + i * 14, sy + 70 + i * 6), 2)
        for i in range(26):                                  # anchor chain trailing off between the two halves
            w.fill(deck if i % 2 else dark, (46 + i, wy + 212 + int(i * i * 0.16), 2, 2))
        # the sea floor: rock, bones, glowing vents
        fy = DEPTH_PX + 14
        for x in range(LW):
            h = int(8 + 6 * math.sin(x * 0.21) + 4 * math.sin(x * 0.07 + 2))
            w.fill((16, 14, 34), (x, fy - h, 1, self.water_h - fy + h)); w.set_at((x, fy - h), (44, 40, 80))
        for bx in (14, 30, 46):
            pg.draw.arc(w, (210, 210, 196), (bx, fy - 26, 22, 40), 0.3, 2.9, 2)
        pg.draw.line(w, (210, 210, 196), (10, fy - 8), (72, fy - 10), 2)
        for vx, vh in ((94, 22), (6, 14), (112, 12)):
            pg.draw.polygon(w, (40, 30, 60), [(vx - 6, fy - 2), (vx, fy - vh), (vx + 6, fy - 2)]); w.fill((255, 120, 60), (vx - 1, fy - vh - 2, 3, 3))
        for _ in range(40):
            x = rnd.randrange(LW)
            w.fill(rnd.choice([(44, 40, 80), (60, 50, 96), (30, 26, 60)]), (x, fy + rnd.randrange(-2, 60), rnd.randrange(2, 6), 1))
        self.vents = ((94, fy - 24), (6, fy - 16), (112, fy - 14))
        for _ in range(520):                                 # drifting specks of light, thicker with depth
            y = rnd.randrange(200 * M, DEPTH_PX)
            if rnd.random() < (y / M - 200) / 400:
                w.set_at((rnd.randrange(LW), y), rnd.choice([(90, 230, 255), (140, 255, 200), (255, 130, 220), (200, 210, 255)]))
        self.water = w


# ===================================================================== game
class Game:
    def __init__(self, ctx):
        self.scr = ctx.scr
        self.pg = pg = self.scr.pg
        self.snd = getattr(ctx, "snd", None) or ac.Synth(pg)
        self.cv = pg.Surface((LW, LH)).convert()
        self.dark = pg.Surface((LW, LH), pg.SRCALPHA)
        self.art = Art(pg)
        self.critters = hopper.Art(pg).critters if hopper._GAME is None else hopper._GAME.art.critters
        self.t = 0.0
        self.lure = 0                                        # remembered between dives
        s = self.snd
        if s.ok:
            T_, mk = s._tone, s._make
            s.sounds["plop"] = mk(s._seq([T_(0, 0.05, "noise", 0.25), T_(520, 0.16, "sine", 0.4, slide=160)]))
            s.sounds["zap"] = mk(s._seq([T_(1800, 0.05, "saw", 0.2, slide=300), T_(0, 0.18, "noise", 0.22)]))
            s.sounds["reel"] = mk(T_(900, 0.02, "square", 0.08))
            s.sounds["weigh"] = mk(T_(700, 0.05, "tri", 0.3, slide=1000))
            s.sounds["pulse"] = mk(s._seq([T_(240, 0.1, "sine", 0.5, slide=900), T_(900, 0.25, "sine", 0.3, slide=300, decay=0.3)]))
            s.sounds["f_hit"] = mk(s._seq([T_(660, 0.04, "square", 0.3), T_(990, 0.08, "square", 0.3)]))
            s.sounds["f_miss"] = mk(T_(200, 0.16, "saw", 0.3, slide=110))
            s.sounds["thunder"] = mk(T_(0, 0.7, "noise", 0.3, decay=0.5))
            for i, f in enumerate((392, 440, 494, 523, 587, 659, 740, 784, 880, 988, 1047, 1175)):
                s.sounds["catch%d" % i] = mk(s._seq([T_(f, 0.05, "tri", 0.4), T_(f * 1.5, 0.12, "tri", 0.32, decay=0.25)]))

    # ----------------------------------------------------------------- run
    def play(self, ctx):
        self.daily, self.best = ctx.daily, ctx.best
        self.seed = ctx.seed if ctx.daily else random.randrange(1 << 30)
        self.rng = random.Random(self.seed)
        self.save = load_save()
        self.tod = time_of_day()
        self.bounty = todays_bounty()
        self.critter = hopper._GAME.critter if hopper._GAME else 0
        # one thing out of the ordinary on some dives
        r = self.rng.random()
        self.storm = r < 0.14
        self.frenzy = self.whale_at = self.whale = None
        if 0.14 <= r < 0.32:
            z = self.rng.randint(1, 4)
            a = self.rng.uniform(ZONES[z][1] + 20, ZONES[z][2] - 50)
            pool = [s[0] for s in SPECIES if s[2] == z and s[4] > 0 and s[5] >= 3 and s[6] is None]
            self.frenzy = (a, a + 30, self.rng.choice(pool), self.rng.choice([-1, 1]))
        elif 0.32 <= r < 0.45:
            self.whale_at = self.rng.uniform(150, 420)
        self.hx, self.hy = 60.0, 4.0                         # hook, in world pixels (y = depth)
        self.cam = -74.0                                     # world y at the top of the screen
        self.path = []                                       # where the line has been
        self.catch = []                                      # (fish id, lb, trophy) on the hook
        self.touch_x = None
        self.drift = 0
        self.keys = set()
        self.state = "cast" if getattr(ctx, "again", False) else "title"
        self.st_t = 0.0
        self.msg = None
        self.immune = 0.0
        self.flash = 0.0
        self.ring = None
        self.fight = None
        self.bottom = False
        self.reached = 0.0                                   # deepest point of this dive, metres
        self.said = set()
        self.bubbles, self.popups = [], []
        self.log_open, self.log_page, self.log_sel = False, 0, 0
        self.haul = None
        self.zone_seen = 0
        self.prepared = False
        self.done, self.out = False, None
        while not self.done:
            dt = self.scr.tick(60)
            self.frame(dt, self.pg.event.get())
        return self.out

    def set(self, state, msg=None):
        self.state, self.st_t, self.msg = state, 0.0, msg

    def cast(self):
        """The lure is chosen: stock the ocean for it and drop the hook."""
        L = LURES[self.lure]
        self.sink, self.steer_k, self.pulses, self.trophy_k, self.legend_k, self.pull = L[3:]
        self.chunks = {}
        self.special = {}                                    # chunk -> [(legendary id, depth px, x)]
        for s in SPECIES:
            if not s[7]:
                continue
            _, a, b = ZONES[s[2]]
            if self.rng.random() < min(0.6, LEGEND_CHANCE.get(s[0], 0.1) * self.legend_k):
                if s[0] == "chest":                           # anywhere in or around the wreck
                    d, x = self.rng.uniform(326, 434) * M, self.rng.uniform(6, 100)
                elif s[0] == "pearl":
                    d, x = DEPTH_PX - 16, self.rng.uniform(20, 76)
                else:
                    d, x = self.rng.uniform(a + 12, b - 8) * M, self.rng.uniform(10, 60)
                self.special.setdefault(int(d // CHUNK), []).append((s[0], d, x))
        self.prepared = True
        self.set("down")
        self.snd.play("plop")
        self.splash(self.hx, 0)
        if self.storm:
            self.popups.append(["STORM! BIG FISH ARE UP", 3.0, ORANGE])

    # --------------------------------------------------------------- fish
    def chunk(self, i):
        if i in self.chunks:
            return self.chunks[i]
        out = []
        top = i * CHUNK
        m = top / M
        if 10 <= m < MAX_M - 4:
            rng = random.Random(self.seed * 1000003 + i)
            z = zone_of(m)
            _, za, zb = ZONES[z]
            lo, hi = PER_CHUNK[z]
            n = rng.randint(lo, hi)
            fr = self.frenzy if self.frenzy and self.frenzy[0] <= m < self.frenzy[1] else None
            if fr:
                n = hi + 2
            for k in range(n):
                y = top + (k + 0.5) * CHUNK / n + rng.uniform(-4, 4)
                zz, r1, r2, r3 = z, rng.random(), rng.random(), rng.random()
                if z + 1 < len(ZONES) and zb - m < BLEND and r1 < 0.5 * (1 - (zb - m) / BLEND):
                    zz = z + 1                                # the next zone's fish drift up to meet you
                elif z > 0 and m - za < BLEND and r1 < 0.5 * (1 - (m - za) / BLEND):
                    zz = z - 1
                if not fr and r2 < JELLY_CHANCE[z]:
                    out.append({"id": "jelly", "x": rng.uniform(8, 100), "y": y, "v": rng.choice([-1, 1]) * rng.uniform(4, 9), "ph": rng.uniform(0, 6), "lb": 0, "tr": False})
                    continue
                if fr:
                    s = SPEC[fr[2]]
                else:
                    pool = [(q, q[5]) for q in SPECIES if q[2] == zz and q[5] and (q[6] is None or q[6] == self.tod)]
                    s = rng.choices([q[0] for q in pool], [q[1] for q in pool])[0]
                still = s[4] == 0
                v = 0 if still else (fr[3] if fr else rng.choice([-1, 1])) * s[4] * rng.uniform(0.8, 1.25) * (1 + m / 1200)
                chance = TROPHY_CHANCE * self.trophy_k * (2 if self.storm and zz <= 1 else 1)
                tr = (not still) and r3 < chance
                lb = rng.randint(*s[3])
                if s[0] == "tripod":
                    if z != 5:
                        continue                              # it only ever stands on the bottom
                    y = DEPTH_PX - 12
                out.append({"id": s[0], "x": rng.uniform(0, 100), "y": y, "v": v, "ph": rng.uniform(0, 6), "lb": lb * 4 + 6 if tr else lb, "tr": tr})
            for fid, d, x in self.special.get(i, []):
                s = SPEC[fid]
                out.append({"id": fid, "x": x, "y": d, "v": 0 if s[4] == 0 else rng.choice([-1, 1]) * s[4], "ph": 0.0, "lb": rng.randint(*s[3]), "tr": False})
        self.chunks[i] = out
        return out

    def visible(self):
        if not self.prepared:
            return
        a, b = int(self.cam // CHUNK) - 1, int((self.cam + LH) // CHUNK) + 1
        for i in range(max(0, a), b + 1):
            for f in self.chunk(i):
                yield i, f

    def sprite(self, f, right=True):
        if f["id"] == "jelly":
            return self.art.jelly[0]
        return self.art.get(f["id"], f["tr"])[0 if right else 1]

    def fish_rect(self, f):
        w, h = self.sprite(f).get_size()
        return self.pg.Rect(int(f["x"]) + 2, int(f["y"] - h / 2) + 2, w - 4, h - 4)

    def scare(self, f, direction, secs=0.9, gone=False):
        f["fl"] = [direction, secs, gone]

    # --------------------------------------------------------------- input
    def read_input(self, events):
        pg = self.pg
        tap = False
        menu = self.state in ("title", "cast")
        for e in events:
            if e.type == pg.QUIT or (e.type == pg.KEYDOWN and e.key == pg.K_ESCAPE):
                self.done, self.out = True, (self.haul["total"] if self.haul else None)
            elif e.type == pg.KEYDOWN:
                if e.key in (pg.K_LEFT, pg.K_a):
                    if menu:
                        self.lure = (self.lure - 1) % len(LURES); self.snd.play("tick")
                    else:
                        self.keys.add(-1)
                elif e.key in (pg.K_RIGHT, pg.K_d):
                    if menu:
                        self.lure = (self.lure + 1) % len(LURES); self.snd.play("tick")
                    else:
                        self.keys.add(1)
                elif e.key in (pg.K_DOWN, pg.K_x, pg.K_p):
                    self.pulse()
                elif e.key in (pg.K_SPACE, pg.K_RETURN, pg.K_UP):
                    tap = True
                    if self.state == "down":
                        self.drift = -self.drift or 1                # one button: flip the drift
            elif e.type == pg.KEYUP:
                self.keys.discard(-1 if e.key in (pg.K_LEFT, pg.K_a) else 1 if e.key in (pg.K_RIGHT, pg.K_d) else 0)
            elif e.type == pg.MOUSEBUTTONDOWN and e.button == 1:
                x, y = self.scr.to_logical(e.pos)
                lx, ly = x / PX, y / PX
                if self.log_open:
                    self.log_tap(lx, ly)
                    return
                if lx < 16 and ly < 14 and self.state in ("title", "cast", "down"):
                    self.done, self.out = True, None
                    return
                if menu:
                    if 104 <= ly < 136 and 6 <= lx < 114:
                        self.lure = clamp(int((lx - 6) // 27), 0, len(LURES) - 1)
                        self.snd.play("tick")
                        continue
                    if ly > 178 and lx > 76:
                        self.log_open = True
                        self.snd.play("select")
                        return
                if self.state == "down" and lx < 40 and ly > 172:
                    self.pulse()
                    continue
                if self.state != "fight":
                    self.touch_x = lx
                    self.drift = 0
                tap = True
            elif e.type == pg.MOUSEMOTION and self.touch_x is not None:
                self.touch_x = self.scr.to_logical(e.pos)[0] / PX
            elif e.type == pg.MOUSEBUTTONUP and e.button == 1:
                self.touch_x = None
        if tap and not self.log_open:
            if menu and self.st_t > 0.25:
                self.cast()
            elif self.state == "fight" and self.st_t > 0.35:
                self.fight_tap()
            elif self.state == "haul" and self.haul["shown"] >= self.haul["n"] and self.st_t > self.haul["end"] + 0.6:
                self.done, self.out = True, self.haul["total"]

    def log_tap(self, lx, ly):
        if ly > 184:
            self.log_open = False
            self.snd.play("back")
        elif ly < 17 and (lx < 24 or lx > 96):
            self.log_page = (self.log_page + (1 if lx > 96 else -1)) % len(ZONES)
            self.log_sel = 0
            self.snd.play("tick")
        elif 20 <= ly < 100:
            n = len([s for s in SPECIES if s[2] == self.log_page])
            self.log_sel = clamp(int((ly - 20) // 20) * 4 + int((lx - 4) // 28), 0, n - 1)
            self.snd.play("tick")

    def steer(self, dt):
        speed = 118 * self.steer_k
        if self.touch_x is not None:
            d = self.touch_x - self.hx
            self.hx += clamp(d, -speed * dt, speed * dt)
        elif self.keys:
            self.hx += sum(self.keys) * speed * dt
        elif self.drift:
            self.hx += self.drift * speed * 0.6 * dt
            if self.hx <= 4 or self.hx >= LW - 4:
                self.drift = -self.drift
        self.hx = clamp(self.hx, 4, LW - 4)

    def pulse(self):
        """Scatter everything near the hook. The lure decides how many of these you get."""
        if self.state != "down" or self.pulses <= 0:
            return
        self.pulses -= 1
        self.ring = 0.0
        self.immune = max(self.immune, 0.5)
        self.snd.play("pulse")
        for i, f in list(self.visible()):
            if abs(f["y"] - self.hy) > 64 or f["id"] in FIXED:
                continue
            cx = f["x"] + self.sprite(f).get_width() / 2
            if f["id"] in JUNK:
                self.chunks[i].remove(f)
                self.splash(cx, f["y"], 6, (150, 130, 110))
            else:
                self.scare(f, 1 if cx >= self.hx else -1)

    # -------------------------------------------------------------- update
    def frame(self, dt, events):
        self.t += dt
        self.st_t += dt
        self.read_input(events)
        if self.done:
            return
        self.update(dt)
        self.draw()
        self.scr.surf.blit(self.pg.transform.scale(self.cv, (ac.W, ac.H)), (0, 0))
        self.scr.present(crt=False)

    def splash(self, x, y, n=8, col=WHITE):
        for _ in range(n):
            self.bubbles.append([x + random.uniform(-3, 3), y, random.uniform(-26, 26), random.uniform(-60, -20), 0.5, col, 90])

    def say(self, key, text, col=CYAN, secs=2.2):
        if key not in self.said:
            self.said.add(key)
            self.popups.append([text, secs, col])

    def swim(self, dt):
        gone = []
        for i, f in self.visible():
            fl = f.get("fl")
            if fl:                                                    # bolting away from a pulse (or for good)
                f["x"] += fl[0] * 150 * dt
                fl[1] -= dt
                if fl[1] <= 0:
                    f["fl"] = None
                    if fl[2]:
                        gone.append((i, f))
                    elif f["v"]:
                        f["v"] = -fl[0] * abs(f["v"])                 # ...then wandering back
                continue
            if self.fight and self.fight["f"] is f:
                continue
            if f["id"] == "jelly":
                f["x"] += f["v"] * dt
                if f["x"] < 4:
                    f["v"] = abs(f["v"])
                elif f["x"] > 106:
                    f["v"] = -abs(f["v"])
            elif f["v"]:
                w = self.sprite(f).get_width()
                f["x"] += f["v"] * dt
                if self.pull and abs(f["y"] - self.hy) < 60 and self.state == "down":
                    f["x"] += clamp(self.hx - (f["x"] + w / 2), -1, 1) * self.pull * dt     # the glow draws them in
                if f["x"] < -6:
                    f["v"] = abs(f["v"])
                elif f["x"] > LW - w + 6:
                    f["v"] = -abs(f["v"])
        for i, f in gone:
            if f in self.chunks[i]:
                self.chunks[i].remove(f)

    def update(self, dt):
        self.immune = max(0, self.immune - dt)
        self.flash = max(0, self.flash - dt)
        if self.ring is not None:
            self.ring += dt
            if self.ring > 0.5:
                self.ring = None
        for b in self.bubbles:
            b[0] += b[2] * dt; b[1] += b[3] * dt; b[3] += b[6] * dt; b[4] -= dt
        self.bubbles = [b for b in self.bubbles if b[4] > 0]
        for p in self.popups:
            p[1] -= dt
        self.popups = [p for p in self.popups if p[1] > 0]
        self.swim(dt)
        if self.state in ("down", "up", "fight") and random.random() < 0.25:
            self.bubbles.append([self.hx + random.uniform(-2, 2), self.hy, random.uniform(-3, 3), -random.uniform(14, 30), 1.2, (200, 236, 255), 0])
        if self.cam + LH > DEPTH_PX - 30 and random.random() < 0.3:   # the vents on the sea floor
            vx, vy = random.choice(self.art.vents)
            self.bubbles.append([vx + random.uniform(-1, 1), vy, random.uniform(-4, 4), -random.uniform(20, 44), 1.4, (255, 150, 90), 0])
        if self.whale:
            wh = self.whale
            wh["x"] += wh["d"] * 70 * dt
            for _, f in self.visible():                               # everything gets out of its way
                if abs(f["y"] - wh["y"]) < 34 and not f.get("fl") and f["id"] not in FIXED + JUNK:
                    nose = wh["x"] + (128 if wh["d"] > 0 else 0)
                    if -30 < (f["x"] + 6 - nose) * wh["d"] < 46:
                        self.scare(f, wh["d"], 1.2)
            if wh["x"] < -150 or wh["x"] > LW + 20:
                self.whale = None
        if self.state == "down":
            self.steer(dt)
            m = self.hy / M
            self.hy += (56 + min(44, m * 0.11)) * self.sink * dt
            while len(self.path) < int(self.hy // 8) + 1:
                self.path.append(self.hx)
            m = self.hy / M
            self.reached = max(self.reached, m)
            z = zone_of(m)
            if z > self.zone_seen:
                self.zone_seen = z
                self.popups.append([ZONES[z][0], 2.0, CYAN])
                self.snd.play("zone") if "zone" in self.snd.sounds else self.snd.play("chime", 0.5)
            if self.frenzy and m > self.frenzy[0] - 10:
                self.say("frenzy", "FEEDING FRENZY!", ORANGE, 2.6)
            if self.whale_at and m > self.whale_at - 22:
                d = self.rng.choice([-1, 1])
                self.whale = {"x": -140.0 if d > 0 else LW + 12.0, "y": self.whale_at * M, "d": d}
                self.whale_at = None
                self.say("whale", "A WHALE PASSES", CYAN, 2.6)
            hook = self.pg.Rect(int(self.hx) - 2, int(self.hy) - 2, 5, 6)
            if self.hy > 10 * M and self.immune <= 0:
                for i, f in self.visible():
                    if f.get("fl") or not hook.colliderect(self.fish_rect(f)):
                        continue
                    legend = f["id"] != "jelly" and SPEC[f["id"]][7]
                    if f["id"] == "jelly":
                        self.snd.play("zap"); self.flash = 0.2
                        self.set("turn", "ZAPPED!")                  # dive over; you keep what's hooked
                    elif legend and any(SPEC[c[0]][7] for c in self.catch):
                        if f["id"] in FIXED:
                            continue
                        self.scare(f, 1 if f["x"] + 10 >= self.hx else -1, 2.0, gone=True)
                        self.popups.append(["ONE LEGEND PER HOOK", 1.8, GOLD])
                        continue
                    elif legend or f["tr"]:
                        self.start_fight(i, f)
                    else:
                        self.land(i, f)
                    break
            if self.state == "down" and self.hy >= BOTTOM_M * M:
                self.hy = BOTTOM_M * M
                self.bottom = True
                self.snd.play("chime")
                self.set("turn", "TOUCHED BOTTOM!")
            self.cam += ((self.hy - 78) - self.cam) * min(1, dt * 6)
        elif self.state == "fight":
            fg = self.fight
            fg["pos"] += fg["dir"] * fg["speed"] * dt
            if fg["pos"] >= 1 or fg["pos"] <= 0:
                fg["pos"] = clamp(fg["pos"], 0, 1)
                fg["dir"] = -fg["dir"]
            fg["shake"] = max(0, fg["shake"] - dt)
        elif self.state == "turn":
            if self.st_t > 0.75:
                self.set("up")
        elif self.state == "up":
            self.steer(dt)
            v = 190 + min(200, self.hy / M * 0.5)
            self.hy -= v * dt
            if int(self.hy / 20) != int((self.hy + v * dt) / 20):
                self.snd.play("reel", 0.5)
            self.path = self.path[:int(self.hy // 8) + 1]
            self.cam += ((self.hy - 128) - self.cam) * min(1, dt * 7)
            if self.hy <= 2:
                self.begin_haul()
        elif self.state == "haul":
            self.cam += (-74 - self.cam) * min(1, dt * 5)
            h = self.haul
            while h["shown"] < h["n"] and self.st_t > 0.5 + h["shown"] * 0.42:
                h["shown"] += 1
                self.snd.play("weigh", 0.8)
                self.splash(60, 0, 5)
            if h["shown"] >= h["n"] and not h["fanfare"] and self.st_t > h["end"]:
                h["fanfare"] = True
                self.snd.play("fanfare" if h["bonus"] or h["total"] > self.best > 0 else "chime")
        self.cam = max(self.cam, -74.0)

    # ---------------------------------------------------------- catching
    def land(self, i, f):
        if f in self.chunks[i]:
            self.chunks[i].remove(f)
        self.catch.append((f["id"], f["lb"], f["tr"]))
        self.snd.play("catch%d" % min(11, len(self.catch) - 1))
        self.splash(self.hx, self.hy, 6, (200, 236, 255))
        if SPEC[f["id"]][7]:
            self.flash = 0.35
            self.popups.append(["LEGENDARY!", 2.4, GOLD]); self.popups.append([SPEC[f["id"]][1], 2.4, GOLD])
            self.snd.play("fanfare")
        elif f["tr"]:
            self.flash = 0.25
            self.popups.append(["TROPHY %s!" % SPEC[f["id"]][1], 2.2, ORANGE])
            self.snd.play("chime")
        if len(self.catch) >= CAPACITY:
            self.set("turn", "FULL HOOK")
        else:
            if not SPEC[f["id"]][7] and not f["tr"]:
                self.popups.append(["HOOKED %d/%d" % (len(self.catch), CAPACITY), 1.0, GOLD])
            if self.state != "down":
                self.set("down")

    def start_fight(self, i, f):
        legend = SPEC[f["id"]][7]
        need = 4 if f["id"] == "ancient" else 3 if legend else 2
        if f["id"] in FIXED:
            need = 2
        self.fight = {"i": i, "f": f, "need": need, "hits": 0, "miss": 0, "pos": 0.0, "dir": 1, "shake": 0.0,
                      "speed": 1.0 + min(0.9, f["lb"] / 170), "win": (random.uniform(0.3, 0.7), 0.14)}
        self.touch_x = None
        self.set("fight")
        self.snd.play("select")

    def fight_tap(self):
        fg = self.fight
        c, half = fg["win"]
        if abs(fg["pos"] - c) <= half:
            fg["hits"] += 1
            fg["shake"] = 0.25
            self.snd.play("f_hit")
            if fg["hits"] >= fg["need"]:
                self.fight = None
                self.immune = 0.5
                self.land(fg["i"], fg["f"])
                return
            fg["win"] = (random.uniform(0.2, 0.8), max(0.08, 0.14 - 0.02 * fg["hits"]))
            fg["speed"] *= 1.12
        else:
            fg["miss"] += 1
            self.snd.play("f_miss")
            if fg["miss"] >= 2:                                       # it throws the hook and bolts
                f = fg["f"]
                self.fight = None
                if f["id"] in FIXED:
                    if f in self.chunks[fg["i"]]:
                        self.chunks[fg["i"]].remove(f)
                else:
                    self.scare(f, 1 if f["x"] + 10 >= self.hx else -1, 2.0, gone=True)
                self.popups.append(["IT GOT AWAY!", 1.8, RED])
                self.immune = 1.0
                self.set("down")

    def begin_haul(self):
        d, rows, pending = self.save, [], []
        for fid, lb, tr in self.catch:
            e = d["log"].get(fid)
            new = e is None
            if new:
                e = d["log"][fid] = {"n": 0, "rec": 0, "by": "---"}
            rec = lb > e["rec"]
            e["n"] += 1
            if tr:
                e["star"] = True
            if rec:
                e["rec"], e["by"] = lb, "---"
                pending.append(fid)
            hot = fid == self.bounty
            rows.append((fid, lb * BOUNTY_X if hot else lb, "X%d" % BOUNTY_X if hot else ("NEW" if new else ("REC" if rec else "")), tr))
        ids = [c[0] for c in self.catch]
        zones = [SPEC[i][2] for i in ids]
        sets = []
        if len(ids) == 3:
            if all(c[2] for c in self.catch):
                sets.append((3, "TROPHY CASE"))
            if len(set(ids)) == 1:
                sets.append((3, "3 OF A KIND"))
            if min(zones) >= 4:
                sets.append((2, "DEEP TRIO"))
            if len(set(zones)) == 3:
                sets.append((2, "GRAND TOUR"))
        if len(ids) - len(set(ids)) == 1:
            sets.append((1.5, "A PAIR"))
        bonus = max(sets) if sets else None
        base = sum(r[1] for r in rows)
        total = int(round(base * (bonus[0] if bonus else 1))) + (BOTTOM_BONUS if self.bottom else 0)
        extra = []
        if bonus:
            extra.append(("%s X%s" % (bonus[1], ("%g" % bonus[0])), LIME))
        if self.bottom:
            extra.append(("SEA FLOOR +%d" % BOTTOM_BONUS, CYAN))
        d["total"] += total
        d["pending"] = pending
        write_save(d)
        n = len(rows) + len(extra)
        self.haul = {"rows": rows, "extra": extra, "n": n, "total": total, "shown": 0, "bonus": bonus, "fanfare": False, "end": 0.5 + n * 0.42 + 0.3}
        self.set("haul")
        self.splash(60, 0, 14)
        self.snd.play("plop")

    # ---------------------------------------------------------------- draw
    def sky(self):
        pg, cv, t = self.pg, self.cv, self.t
        top, bot = {"MORNING": ((255, 190, 150), (170, 214, 250)), "DAY": ((90, 170, 250), (170, 222, 255)),
                    "DUSK": ((60, 50, 110), (250, 150, 90)), "NIGHT": ((8, 12, 40), (30, 44, 96))}[self.tod]
        if self.storm:
            top, bot = lerp_col(top, (30, 34, 52), 0.75), lerp_col(bot, (70, 78, 100), 0.7)
        y0 = int(-self.cam) - 80                                      # screen y of the top of the sky
        for i in range(14):
            cv.fill(lerp_col(top, bot, i / 13), (0, y0 + i * 6, LW, 6))
        if y0 > 0:
            cv.fill(top, (0, 0, LW, y0))
        if self.storm:
            pass
        elif self.tod == "NIGHT":
            rnd = random.Random(9)
            for _ in range(26):
                x, y = rnd.randrange(LW), rnd.randrange(60)
                if (int(t * 2) + x) % 7:
                    cv.set_at((x, y0 + y), WHITE)
            pg.draw.circle(cv, (236, 236, 214), (92, y0 + 22), 8); pg.draw.circle(cv, top, (95, y0 + 20), 7)
        else:
            sy = {"MORNING": 56, "DAY": 20, "DUSK": 62}[self.tod]
            pg.draw.circle(cv, (255, 236, 150), (92, y0 + sy), 9); pg.draw.circle(cv, (255, 250, 214), (92, y0 + sy), 6)
        for i, (cx, cy, w) in enumerate(((10, 14, 18), (50, 30, 14), (84, 44, 12)) + (((30, 8, 30), (70, 20, 26), (100, 12, 24)) if self.storm else ())):
            x = int((cx + t * (2 + i) * (4 if self.storm else 1)) % (LW + 30)) - 20
            c = (60, 66, 86) if self.storm else WHITE if self.tod != "NIGHT" else (90, 100, 150)
            cv.fill(c, (x, y0 + cy, w, 3)); cv.fill(c, (x + 3, y0 + cy - 2, w - 7, 2))
        pg.draw.polygon(cv, lerp_col(bot, (30, 60, 90), 0.6), [(0, y0 + 80), (0, y0 + 70), (16, y0 + 62), (30, y0 + 72), (44, y0 + 80)])
        if self.storm:
            for i in range(26):                                       # rain, and now and then lightning
                x = (i * 37 + int(t * 90)) % LW
                y = y0 + (i * 53 + int(t * 220)) % 80
                cv.fill((170, 190, 220), (x, y, 1, 3))
            ph = t % 3.7
            if ph < 0.1 or 0.18 < ph < 0.24:
                bx = 20 + int(t // 3.7 * 47) % 80
                pg.draw.lines(cv, (255, 255, 220), False, [(bx, y0 + 4), (bx - 4, y0 + 24), (bx + 3, y0 + 30), (bx - 3, y0 + 56)], 1)
                self.flash = max(self.flash, 0.06)
                if ph < 0.03:
                    self.snd.play("thunder", 0.6)

    def draw(self):
        pg, cv, t, art = self.pg, self.cv, self.t, self.art
        cam = self.cam
        wl = int(round(-cam))                                         # screen y of the waterline
        src_y = max(0, int(round(cam)))
        cv.blit(art.water, (0, max(0, wl)), (0, src_y, LW, LH))
        if wl > 0:
            self.sky()
        m_mid = (cam + 100) / M
        if m_mid < 90 and not self.storm:                             # sun rays
            ray = pg.Surface((LW, LH), pg.SRCALPHA)
            a = int(26 * clamp(1 - m_mid / 90, 0, 1))
            for i in range(4):
                x = 10 + i * 32 + int(math.sin(t * 0.6 + i) * 4)
                pg.draw.polygon(ray, (255, 255, 255, a), [(x, max(0, wl)), (x + 12, max(0, wl)), (x - 26, LH), (x - 52, LH)])
            cv.blit(ray, (0, 0))
        for i in range(10):                                           # kelp: starts sparse, thickens, thins out again
            base = (3, 9, 15, 21, 99, 105, 111, 117, 27, 93)[i]
            top_m, end_m = 92 + (i * 7) % 5 * 7, 216 - (i * 3) % 5 * 13
            y0 = max(top_m * M, int(cam) // 4 * 4)
            for wy in range(y0, min(end_m * M, int(cam) + LH + 4), 4):
                x = base + math.sin(wy * 0.045 + t * 1.4 + i) * 3
                sy = wy - cam
                cv.fill((30, 120, 70) if i % 2 else (44, 150, 84), (int(x), int(sy), 2, 4))
                if (wy // 4 + i) % 3 == 0:
                    cv.fill((80, 190, 100), (int(x) + (2 if i % 2 else -2), int(sy), 2, 2))
        if self.whale:
            wh = self.whale
            cv.blit(art.whale[0 if wh["d"] > 0 else 1], (int(wh["x"]), int(wh["y"] - 22 - cam + math.sin(t * 1.5) * 3)))
        self.draw_giant()
        for _, f in self.visible():
            sy = f["y"] - cam
            if f["id"] == "jelly":
                spr = art.jelly[int(t * 2 + f["ph"]) % 2]
                cv.blit(spr, (int(f["x"]), int(sy - spr.get_height() / 2 + math.sin(t * 2 + f["ph"]) * 3)))
                continue
            fl = f.get("fl")
            right = (fl[0] > 0) if fl else f["v"] >= 0
            spr = self.sprite(f, right)
            x, y = int(f["x"]), int(sy - spr.get_height() / 2 + math.sin(t * 3 + f["ph"]) * 1.5)
            if self.fight and self.fight["f"] is f:
                x += int(math.sin(t * 40) * (3 if self.fight["shake"] > 0 else 1))
            cv.blit(spr, (x, y))
            w, h = spr.get_size()
            if f["tr"] or SPEC[f["id"]][7]:                           # trophies and legends sparkle
                col = ORANGE if f["tr"] else GOLD
                for k in range(3):
                    if int(t * 6 + k * 2 + f["ph"]) % 3 == 0:
                        px, py = x + (k * 37 + int(t * 3)) % max(1, w), y + (k * 23 + int(t * 5)) % max(1, h)
                        cv.fill(WHITE, (px, py, 1, 1)); cv.fill(col, (px - 1, py, 3, 1)); cv.fill(col, (px, py - 1, 1, 3)); cv.fill(WHITE, (px, py, 1, 1))
            if f["id"] == self.bounty and int(t * 3) % 2:             # today's bounty fish wears a tag
                cv.fill(INK, (x + w // 2 - 2, y - 7, 5, 6)); cv.fill(GOLD, (x + w // 2 - 1, y - 6, 3, 4)); cv.fill(INK, (x + w // 2, y - 5, 1, 2))
        # the line, the hook and whatever is on it
        if self.state in ("down", "turn", "up", "fight"):
            pts = [(63, wl - 13)] if wl > -20 else []
            for i, x in enumerate(self.path):
                sy = i * 8 - cam
                if -8 <= sy <= self.hy - cam:
                    pts.append((x, sy))
            pts.append((self.hx, self.hy - cam - 4))
            if len(pts) > 1:
                pg.draw.lines(cv, (236, 240, 250), False, pts, 1)
            hx, hy = int(self.hx), int(self.hy - cam)
            cv.blit(art.hook, (hx - 1, hy - 4))
            lid = LURES[self.lure][0]
            if lid == "sinker":
                pg.draw.circle(cv, (150, 156, 170), (hx, hy - 7), 2)
            elif lid == "glow":
                pg.draw.circle(cv, (255, 250, 150) if int(t * 6) % 2 else (255, 220, 90), (hx, hy - 6), 2)
            elif lid == "sonar":
                cv.fill(CYAN, (hx - 1, hy - 8, 3, 2))
            for i, (fid, _, tr) in enumerate(self.catch):             # the bunch dangles nose-up
                spr = pg.transform.rotate(art.get(fid, tr)[0], 90)
                wig = math.sin(t * 9 + i * 1.7) * 1.5
                ox = (-1 if i % 2 else 1) * (2 + (i % 3)) + wig
                cv.blit(spr, (int(hx + ox - spr.get_width() / 2), hy + 2 + i * 4))
            if self.ring is not None:
                r = int(8 + self.ring * 130)
                pg.draw.circle(cv, CYAN, (hx, hy), r, 1)
                if r > 12:
                    pg.draw.circle(cv, WHITE, (hx, hy), r - 8, 1)
        for b in self.bubbles:
            sy = int(b[1] - cam)
            if 0 <= sy < LH and 0 <= b[0] < LW:
                cv.fill(b[5], (int(b[0]), sy, 2, 2) if b[6] else (int(b[0]), sy, 1, 1))
        # darkness: the deeper you go the less you see, except around lights
        dm = (self.hy if self.state in ("down", "turn", "up", "fight") else 0) / M
        a = int(215 * clamp((dm - 300) / 180, 0, 1))
        if a > 4:
            d = self.dark
            d.fill((0, 0, 8, a))
            hx, hy = int(self.hx), int(self.hy - cam)
            lights = [(hx, hy, 56 if LURES[self.lure][0] == "glow" else 42)]
            for _, f in self.visible():
                if f["id"] in GLOWS or f["tr"]:
                    w = self.sprite(f).get_width()
                    lx = f["x"] + (w - 3 if f["v"] >= 0 else 3) if f["id"] == "angler" else f["x"] + w / 2
                    lights.append((int(lx), int(f["y"] - cam), 26 if f["id"] in ("levi", "ancient", "colossal") else 13))
            for vx, vy in art.vents:
                lights.append((vx, int(vy - cam), 16))
            if self.eye > 0.05:
                lights.append((46, int(DEPTH_PX + 52 - cam), 20))
            for x, y, r in lights:
                pg.draw.circle(d, (0, 0, 8, int(a * 0.55)), (x, y), r)
            for x, y, r in lights:
                pg.draw.circle(d, (0, 0, 8, 0), (x, y), int(r * 0.68))
            cv.blit(d, (0, 0))
        if wl > -30:                                                  # the surface, boat and angler
            for x in range(0, LW, 4):
                cv.fill(WHITE, (x + int(t * 3) % 4, wl + int(math.sin(t * 2 + x * 0.3) * (2.4 if self.storm else 1.2)), 2, 1))
            bob = int(math.sin(t * (3.4 if self.storm else 2)) * (3 if self.storm else 1.5))
            spr = self.critters[self.critter][("side", "stand")]
            cv.blit(spr, (40, wl - 21 + bob))
            cv.blit(art.boat, (30, wl - 9 + bob))
            pg.draw.line(cv, (120, 84, 50), (50, wl - 12 + bob), (63, wl - 22 + bob), 1)
            if self.state in ("title", "cast", "haul"):
                pg.draw.line(cv, (236, 240, 250), (63, wl - 22 + bob), (63, wl + 2), 1)
        if self.flash > 0:
            ov = pg.Surface((LW, LH)); ov.fill((255, 255, 200)); ov.set_alpha(int(150 * min(1, self.flash / 0.2))); cv.blit(ov, (0, 0))
        if self.log_open:
            self.draw_log()
        else:
            self.draw_hud()

    eye = 0.0

    def draw_giant(self):
        """Something very large is asleep in the sea floor. It notices the hook."""
        pg, cv = self.pg, self.cv
        ey = int(DEPTH_PX + 52 - self.cam)
        if ey > LH + 20:
            self.eye = 0.0
            return
        want = 1.0 if self.state in ("down", "turn", "fight") and self.hy > 596 * M else 0.0
        self.eye += (want - self.eye) * 0.08
        ex, k = 46, self.eye
        pg.draw.ellipse(cv, (30, 26, 60), (ex - 17, ey - 9, 34, 18))
        if k < 0.08:
            pg.draw.arc(cv, (70, 62, 110), (ex - 14, ey - 8, 28, 12), 3.4, 6.0, 1)
            return
        h = max(2, int(14 * k))
        pg.draw.ellipse(cv, (250, 210, 70), (ex - 14, ey - h // 2, 28, h))
        px = ex + int(clamp((self.hx - ex) / 8, -6, 6))
        pg.draw.ellipse(cv, (20, 10, 20), (px - 2, ey - h // 2 + 1, 5, max(1, h - 2)))
        pg.draw.ellipse(cv, (70, 62, 110), (ex - 15, ey - h // 2 - 1, 30, h + 2), 1)

    def text(self, s, x, y, scale=1, col=WHITE, anchor="center", shadow=INK):
        ac.draw_text(self.cv, self.pg, s, (x, y), scale, col, anchor, shadow=shadow)

    def box(self, rect, border=WHITE):
        self.pg.draw.rect(self.cv, INK, rect); self.pg.draw.rect(self.cv, border, rect, 1)

    def lure_icon(self, i, x, y):
        pg, cv, t = self.pg, self.cv, self.t
        lid = LURES[i][0]
        cv.blit(self.art.hook, (x - 1, y - 1))
        if lid == "sinker":
            pg.draw.circle(cv, (150, 156, 170), (x, y - 5), 3); cv.fill(WHITE, (x - 1, y - 6, 1, 1))
        elif lid == "glow":
            pg.draw.circle(cv, (255, 236, 120), (x, y - 5), 3)
            for k in range(4):
                a = k * math.pi / 2 + t
                cv.fill((255, 250, 190), (int(x + math.cos(a) * 6), int(y - 5 + math.sin(a) * 6), 1, 1))
        elif lid == "sonar":
            for r in (3, 6):
                pg.draw.circle(cv, CYAN, (x, y - 3), r + int(t * 3) % 2, 1)
        else:
            cv.fill((230, 80, 70), (x - 1, y - 6, 3, 3))

    def draw_hud(self):
        pg, cv, t, st = self.pg, self.cv, self.t, self.state
        if st in ("title", "cast", "down"):
            self.box((2, 2, 12, 10)); self.text("<", 8, 7, 1, WHITE, shadow=None)
        if st in ("title", "cast"):
            if st == "title":
                for i, (word, col) in enumerate((("REEL", CYAN), ("DEEP", GOLD))):
                    self.text(word, LW // 2, 20 + i * 17 + int(math.sin(t * 2.5 + i) * 2), 2, col)
            self.box((6, 58, 108, 40), CYAN)
            extra = [s[1] for s in SPECIES if s[6] == self.tod]
            self.text("%s: %s" % (self.tod, extra[0]) if extra else self.tod, LW // 2, 66, 1, WHITE, shadow=None)
            self.text("TODAY'S BOUNTY X%d" % BOUNTY_X, LW // 2, 78, 1, GOLD, shadow=None)
            self.text(SPEC[self.bounty][1], LW // 2, 89, 1, GOLD, shadow=None)
            for i, L in enumerate(LURES):                             # pick a lure
                x = 6 + i * 27
                sel = i == self.lure
                pg.draw.rect(cv, (30, 40, 90) if sel else INK, (x, 104, 26, 32)); pg.draw.rect(cv, GOLD if sel else (90, 100, 150), (x, 104, 26, 32), 1)
                self.lure_icon(i, x + 13, 116)
                for k in range(L[5]):
                    cv.fill(CYAN, (x + 13 - L[5] * 3 + k * 6 + 1, 129, 4, 3))
            L = LURES[self.lure]
            self.text(L[1], LW // 2, 143, 1, GOLD, shadow=None)
            self.text(L[2], LW // 2, 153, 1, (200, 210, 240), shadow=None)
            on = int(t * 2.5) % 2
            self.box((34, 160, 52, 15), WHITE if on else CYAN); self.text("CAST", LW // 2, 168, 1, WHITE if on else CYAN, shadow=None)
            self.box((78, 180, 40, 16), GOLD); self.text("LOG", 98, 188, 1, GOLD, shadow=None)
            if self.daily:
                self.text("DAILY RUN", 38, 188, 1, GOLD)
            elif self.best:
                self.text("BEST %d" % self.best, 38, 188, 1, WHITE)
            return
        if st in ("down", "turn", "up", "fight"):
            self.text("%d M" % int(self.hy / M), LW // 2, 9, 2)
            self.text("FISH %d/%d" % (len(self.catch), CAPACITY), LW // 2, 23, 1, GOLD if len(self.catch) < CAPACITY else LIME)
            gx, gy, gh = 114, 34, 150                                 # depth gauge
            pg.draw.rect(cv, INK, (gx - 1, gy - 1, 5, gh + 2))
            for zi, (_, a, b) in enumerate(ZONES):
                cv.fill(ZONE_COL[zi], (gx, gy + int(a / MAX_M * gh), 3, int((b - a) / MAX_M * gh) + 1))
            my = gy + int(self.hy / M / MAX_M * gh)
            pg.draw.polygon(cv, WHITE, [(gx - 6, my - 3), (gx - 2, my), (gx - 6, my + 3)])
            if st == "down":                                          # the pulse button
                have = self.pulses > 0
                self.box((2, 176, 36, 22), CYAN if have else (80, 86, 120))
                self.text("PULSE", 20, 183, 1, CYAN if have else (110, 116, 150), shadow=None)
                for k in range(LURES[self.lure][5]):
                    cv.fill(CYAN if k < self.pulses else (60, 66, 100), (20 - LURES[self.lure][5] * 4 + k * 8 + 1, 190, 6, 3))
            if self.msg and st == "turn":
                sc = 2 if ac.text_size(self.msg, 2)[0] < 106 else 1
                tw = ac.text_size(self.msg, sc)[0]
                col = RED if self.msg == "ZAPPED!" else GOLD
                self.box((LW // 2 - tw // 2 - 5, 86, tw + 10, 22), col)
                self.text(self.msg, LW // 2, 97, sc, col, shadow=None)
            if st == "up" and int(t * 3) % 2:
                self.text("REELING IN!", LW // 2, 184, 1, LIME)
            if st == "down" and self.hy < 22 * M and int(t * 3) % 2:
                self.text("PICK YOUR %d FISH" % CAPACITY, LW // 2 + 14, 184, 1, WHITE)
        if st == "fight":
            fg = self.fight
            f = fg["f"]
            col = GOLD if SPEC[f["id"]][7] else ORANGE
            self.box((8, 110, 104, 58), col)
            self.text("LEGENDARY!" if SPEC[f["id"]][7] else "TROPHY!", LW // 2, 118, 1, col, shadow=None)
            self.text(SPEC[f["id"]][1], LW // 2, 128, 1, WHITE, shadow=None)
            bx, bw = 16, 88
            cv.fill((50, 30, 50), (bx, 136, bw, 8))
            c, half = fg["win"]
            cv.fill((70, 220, 110), (bx + int((c - half) * bw), 136, int(half * 2 * bw), 8))
            mx = bx + int(fg["pos"] * (bw - 1))
            cv.fill(WHITE, (mx - 1, 134, 3, 12)); cv.fill(INK, (mx, 136, 1, 8))
            for k in range(fg["need"]):
                pg.draw.rect(cv, LIME if k < fg["hits"] else (70, 76, 110), (16 + k * 8, 148, 6, 5))
            for k in range(2):
                self.text("X", 100 - k * 8, 151, 1, RED if k < fg["miss"] else (70, 76, 110), shadow=None)
            if int(t * 4) % 2:
                self.text("TAP ON GREEN!", LW // 2, 161, 1, WHITE, shadow=None)
        for i, p in enumerate(self.popups[-2:]):
            if p[1] > 0.3 or int(t * 20) % 2:
                tw = ac.text_size(p[0], 1)[0]
                self.box((LW // 2 - tw // 2 - 4, 40 + i * 13, tw + 8, 11), p[2])
                self.text(p[0], LW // 2, 45 + i * 13, 1, p[2], shadow=None)
        if st == "haul":
            h = self.haul
            self.box((6, 84, 108, 112), CYAN)
            self.text("THE HAUL", LW // 2, 92, 1, CYAN, shadow=None)
            rows = h["rows"][:h["shown"]]
            for i, (fid, lb, tag, tr) in enumerate(rows):
                y = 104 + i * 10
                name = (("*" + SPEC[fid][1]) if tr else SPEC[fid][1])[:10 if tag else 13]
                self.text(name, 10, y, 1, GOLD if SPEC[fid][7] else ORANGE if tr else WHITE, "left", shadow=None)
                if tag:
                    self.text(tag, 92, y, 1, GOLD if tag[0] == "X" else LIME if tag == "NEW" else (255, 140, 50), "right", shadow=None)
                self.text(str(lb), 110, y, 1, WHITE, "right", shadow=None)
            if not h["rows"]:
                self.text("NOTHING BUT", LW // 2, 110, 1, WHITE, shadow=None); self.text("SEAWEED", LW // 2, 120, 1, WHITE, shadow=None)
            for j, (txt, col) in enumerate(h["extra"][:max(0, h["shown"] - len(h["rows"]))]):
                self.text(txt, LW // 2, 138 + j * 10, 1, col, shadow=None)
            done = h["shown"] >= h["n"]
            shown_total = h["total"] if done else sum(r[1] for r in rows)
            pg.draw.line(cv, CYAN, (10, 162), (109, 162))
            self.text("TOTAL", 10, 172, 1, CYAN, "left", shadow=None)
            self.text("LB", 110, 174, 1, GOLD, "right", shadow=None)
            self.text(str(shown_total), 96, 171, 2, GOLD, "right", shadow=None)
            if done and self.st_t > h["end"] and int(t * 2.5) % 2:
                self.text("TAP TO CONTINUE", LW // 2, 188, 1, WHITE, shadow=None)
            # each fish flies out of the water into the boat as it is weighed
            k = (self.st_t - 0.5) / 0.42
            i = int(k)
            if 0 <= i < len(h["rows"]):
                u = k - i
                spr = self.art.get(h["rows"][i][0], h["rows"][i][3])[0]
                wl = int(round(-self.cam))
                cv.blit(spr, (int(lerp(72, 44, u) - spr.get_width() / 2), int(wl - 4 - math.sin(u * math.pi) * 30 - spr.get_height() / 2)))

    def draw_log(self):
        pg, cv, d = self.pg, self.cv, self.save
        cv.fill((8, 14, 40))
        page = [s for s in SPECIES if s[2] == self.log_page]
        self.box((2, 2, 20, 13), CYAN); self.text("<", 12, 8, 1, CYAN, shadow=None)
        self.box((98, 2, 20, 13), CYAN); self.text(">", 108, 8, 1, CYAN, shadow=None)
        self.text(ZONES[self.log_page][0], LW // 2, 8, 1, GOLD, shadow=None)
        for i, s in enumerate(page):
            x, y = 4 + (i % 4) * 28, 20 + (i // 4) * 20
            sel = i == self.log_sel
            e = d["log"].get(s[0])
            pg.draw.rect(cv, ZONE_COL[s[2]] if e else (20, 26, 54), (x, y, 27, 19))
            pg.draw.rect(cv, WHITE if sel else (GOLD if s[7] and e else INK), (x, y, 27, 19), 1)
            spr = self.art.spr[s[0]][0]
            w, h = spr.get_size()
            k = min(1.0, 23 / w, 15 / h)
            if k < 1:
                spr = pg.transform.scale(spr, (max(1, int(w * k)), max(1, int(h * k))))
            if not e:                                                 # not caught yet: a shadow
                spr = pg.mask.from_surface(spr).to_surface(setcolor=(44, 54, 96, 255), unsetcolor=(0, 0, 0, 0))
            cv.blit(spr, (x + 14 - spr.get_width() // 2, y + 10 - spr.get_height() // 2))
            if e and e.get("star"):
                self.text("*", x + 22, y + 5, 1, GOLD, shadow=None)
        s = page[min(self.log_sel, len(page) - 1)]
        e = d["log"].get(s[0])
        self.box((2, 106, 116, 34), CYAN)
        if e:
            self.text(s[1], LW // 2, 113, 1, GOLD if s[7] else WHITE, shadow=None)
            self.text("X%d BEST %d LB %s" % (e["n"], e["rec"], e["by"]), LW // 2, 123, 1, CYAN, shadow=None)
            self.text("LEGENDARY" if s[7] else ("* TROPHY CAUGHT" if e.get("star") else "NO TROPHY YET"), LW // 2, 133, 1, GOLD if s[7] or e.get("star") else (150, 160, 200), shadow=None)
        else:
            self.text("???", LW // 2, 113, 1, (150, 160, 200), shadow=None)
            self.text(ZONES[s[2]][0] + ((" " + s[6]) if s[6] else ""), LW // 2, 123, 1, (150, 160, 200), shadow=None)
            self.text("LEGENDARY" if s[7] else "NOT CAUGHT YET", LW // 2, 133, 1, (150, 160, 200), shadow=None)
        got = len([1 for s in SPECIES if s[0] in d["log"]])
        stars = len([1 for v in d["log"].values() if v.get("star")])
        self.text("CAUGHT %d/%d" % (got, len(SPECIES)), LW // 2, 152, 1, WHITE, shadow=None)
        self.text("TROPHIES %d/%d" % (stars, len([1 for s in SPECIES if not s[7] and s[4] > 0])), LW // 2, 163, 1, GOLD, shadow=None)
        self.text("TAP HERE TO CLOSE", LW // 2, 192, 1, WHITE, shadow=None)


_GAME = None


def play(ctx):
    global _GAME
    if _GAME is None:
        _GAME = Game(ctx)
    return _GAME.play(ctx)


def card_scene(pg, t):
    """80x58 animated scene for the launcher card."""
    global _CARD
    try:
        art, crit = _CARD
    except NameError:
        art, crit = _CARD = (Art(pg), hopper.Art(pg).critters[0])
    cv = pg.Surface((80, 58))
    for i in range(3):
        cv.fill(lerp_col((90, 170, 250), (170, 222, 255), i / 2), (0, i * 6, 80, 6))
    cv.blit(art.water, (0, 18), (0, 0, 80, 40))
    pg.draw.circle(cv, (255, 236, 150), (66, 8), 5)
    bob = int(math.sin(t * 2) * 1.5)
    cv.blit(crit[("side", "stand")], (12, -3 + bob)); cv.blit(art.boat, (2, 9 + bob))
    pg.draw.line(cv, (120, 84, 50), (22, 6 + bob), (35, -4 + bob))
    hy = 34 + int(math.sin(t * 1.2) * 8)
    pg.draw.line(cv, (236, 240, 250), (35, -4 + bob), (35, hy)); cv.blit(art.hook, (34, hy))
    for x in range(0, 80, 4):
        cv.fill((250, 250, 255), (x + int(t * 3) % 4, 18, 2, 1))
    for i, (fid, y, v) in enumerate((("bluegill", 30, 14), ("turtle", 44, -10), ("bass", 52, 10), ("angel", 38, -12))):
        s = art.spr[fid][0 if v > 0 else 1]
        cv.blit(s, (int((i * 23 + t * v) % 100) - 14, y - s.get_height() // 2))
    return cv


if __name__ == "__main__":
    from types import SimpleNamespace
    _scr = ac.Screen("REEL DEEP")
    while play(SimpleNamespace(scr=_scr, snd=None, daily=False, seed=0, best=0, again=False)) is not None:
        pass
