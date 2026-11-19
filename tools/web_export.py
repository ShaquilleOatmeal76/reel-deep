import os, sys, json
os.environ.update(SDL_VIDEODRIVER="dummy", SDL_AUDIODRIVER="dummy", ARCADE_WINDOWED="1")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pygame
import copy
import arcade_core as ac, fishing_web as fishing, hopper
from hopper import outlined, from_rows
scr = ac.Screen("x"); pg = scr.pg
art = fishing.Art(pg)
OUT = os.path.dirname(HERE)                # the game folder this tools folder sits in
LATE = ("gboot", "werewolf", "lucky")
LATE2 = ("blacktip", "leopard", "mako", "hammer", "goblin", "lshark")   # sharks, Nov 18, 2026: packed after everything else         # added later: packed at the end so older sprites keep their places
items = [(s[0], art.spr[s[0]][0]) for s in fishing.SPECIES if s[0] not in LATE + LATE2]
items += [("jelly0", art.jelly[0]), ("jelly1", art.jelly[1]), ("whale", art.whale[0])]
# ---- cosmetics -----------------------------------------------------------------------------------
INK = fishing.INK
def variant(base, name, swaps):
    c = copy.deepcopy(hopper.CRITTERS[base]); c["name"] = name; c["pal"].update(swaps); return c
hopper.CRITTERS += [
    variant(0, "ARCTIC FOX", {"o": (236, 240, 248), "d": (190, 200, 216)}), variant(0, "SHADOW FOX", {"o": (84, 76, 110), "d": (54, 48, 76), "w": (200, 196, 220)}),
    variant(0, "RED PANDA", {"o": (190, 70, 40), "d": (110, 40, 30), "w": (255, 236, 214)}),
    variant(1, "DART FROG", {"g": (60, 140, 240), "d": (40, 100, 200), "m": (30, 70, 160), "l": (250, 220, 90)}), variant(1, "TOAD", {"g": (170, 130, 80), "d": (130, 96, 60), "m": (100, 70, 44), "l": (236, 216, 170)}),
    variant(1, "LAVA FROG", {"g": (230, 80, 50), "d": (180, 50, 36), "m": (120, 30, 30), "l": (255, 210, 90)}),
]
pk = ["b"]                                                # the penguin's dark coat
hopper.CRITTERS += [variant(2, "ROYAL PENGUIN", {k: (60, 60, 150) for k in pk}), variant(2, "GHOST PENGUIN", {k: (150, 190, 210) for k in pk}), variant(2, "ROSE PENGUIN", {k: (200, 90, 130) for k in pk})]
hopper.CRITTERS += [
    variant(0, "GOLDEN FOX", {"o": (240, 190, 60), "d": (190, 140, 30), "w": (255, 250, 220)}), variant(0, "NEON FOX", {"o": (60, 230, 200), "d": (230, 60, 200), "w": (240, 255, 250)}),
    variant(0, "EMBER FOX", {"o": (60, 40, 44), "d": (255, 110, 40), "w": (255, 200, 120)}),
    variant(1, "ZOMBIE FROG", {"g": (130, 160, 110), "d": (90, 120, 80), "m": (140, 40, 50), "l": (190, 200, 170)}), variant(1, "GLASS FROG", {"g": (170, 240, 200), "d": (120, 210, 170), "m": (230, 90, 120), "l": (230, 255, 240)}),
    variant(1, "MIDNIGHT FROG", {"g": (40, 40, 80), "d": (30, 30, 60), "m": (240, 200, 70), "l": (110, 110, 170)}),
    variant(2, "EMPEROR PENGUIN", {"b": (30, 34, 50), "y": (255, 200, 40)}), variant(2, "CANDY PENGUIN", {"b": (90, 200, 220), "y": (255, 120, 180)}),
    variant(2, "VOID PENGUIN", {"b": (20, 10, 30), "w": (190, 150, 255), "y": (140, 80, 255)}), variant(2, "CHROME PENGUIN", {"b": (150, 160, 180), "w": (235, 240, 250), "y": (200, 210, 230)}),
]
crit = hopper.Art(pg).critters
CHARS = [c["name"] for c in hopper.CRITTERS]
items += [("char%d" % i, c[("side", "stand")]) for i, c in enumerate(crit)]
BOATS = [("ROWBOAT", {"b": (110, 70, 44), "w": (250, 246, 236), "r": (226, 78, 70), "d": (170, 54, 54)}), ("BLUE SKIFF", {"b": (60, 70, 110), "w": (236, 244, 250), "r": (60, 130, 230), "d": (40, 90, 170)}),
         ("MOSS DINGHY", {"b": (90, 70, 44), "w": (240, 246, 220), "r": (90, 170, 80), "d": (60, 120, 60)}), ("BUBBLEGUM", {"b": (150, 80, 110), "w": (255, 240, 246), "r": (255, 130, 190), "d": (210, 90, 150)}),
         ("NIGHT RAIDER", {"b": (30, 30, 40), "w": (120, 120, 140), "r": (50, 50, 66), "d": (30, 30, 44)}), ("SUNSET", {"b": (120, 60, 40), "w": (255, 236, 200), "r": (255, 150, 50), "d": (220, 90, 50)}),
         ("GHOST SHIP", {"b": (120, 170, 170), "w": (220, 255, 250), "r": (150, 230, 220), "d": (100, 180, 180)}), ("GOLDEN BARGE", {"b": (150, 100, 30), "w": (255, 250, 210), "r": (255, 210, 70), "d": (220, 160, 40)})]
BOATS += [("COPPER CUTTER", {"b": (110, 60, 30), "w": (255, 220, 180), "r": (210, 120, 60), "d": (160, 80, 40)}), ("MINT SKIFF", {"b": (60, 110, 90), "w": (240, 255, 248), "r": (130, 230, 190), "d": (80, 180, 140)}),
          ("LAVA BOAT", {"b": (40, 20, 20), "w": (255, 200, 90), "r": (240, 80, 30), "d": (180, 40, 20)}), ("ICEBREAKER", {"b": (100, 140, 180), "w": (250, 255, 255), "r": (190, 230, 255), "d": (130, 190, 230)}),
          ("ROYAL YACHT", {"b": (70, 40, 110), "w": (255, 240, 180), "r": (150, 80, 210), "d": (255, 200, 60)}), ("PIRATE SLOOP", {"b": (30, 24, 24), "w": (220, 210, 190), "r": (170, 30, 40), "d": (60, 50, 50)}),
          ("CHROME RACER", {"b": (90, 100, 120), "w": (250, 252, 255), "r": (190, 200, 220), "d": (140, 150, 170)}), ("MOONLIT", {"b": (20, 30, 70), "w": (220, 230, 255), "r": (60, 80, 170), "d": (240, 230, 160)})]
BOAT_ROWS = [fishing.BOAT] * len(BOATS)
BOATS.append(("LOG RAFT", None)); BOAT_ROWS.append(["..............................", "bdbdbdbdbdbdbdbdbdbdbdbdbdbdbd", "dbdbdbdbdbdbdbdbdbdbdbdbdbdbdb", "bdbdbdbdbdbdbdbdbdbdbdbdbdbdbd",
                                                   "wbwwwwwwwwwwwwwwwwwwwwwwwwwwbw", "bdbdbdbdbdbdbdbdbdbdbdbdbdbdbd", ".............................."])
BOATS.append(("RUBBER DUCK", None)); BOAT_ROWS.append(["........................yyyy..", ".......................yyyyyy.", "......................yyyykyoo", "yy....................yyyyyy..",
                                                      "yyyyyyyyyyyyyyyyyyyyyyyyyyy...", ".yyyyyyyyyyyyyyyyyyyyyyyyyy...", "..yyyyyyyyyyyyyyyyyyyyyyyy....", "....yyyyyyyyyyyyyyyyyyyy......"])
BOAT_PAL_SPECIAL = {"LOG RAFT": {"b": (120, 80, 44), "d": (90, 56, 30), "w": (210, 190, 140)}, "RUBBER DUCK": {"y": (255, 214, 60), "k": INK, "o": (255, 140, 40)}}
items += [("boat%d" % i, outlined(pg, from_rows(pg, BOAT_ROWS[i], pal or BOAT_PAL_SPECIAL[name]))) for i, (name, pal) in enumerate(BOATS)]
HOOKS = [("STEEL HOOK", fishing.HOOK, {"k": (226, 232, 244)}), ("GOLD HOOK", fishing.HOOK, {"k": (255, 210, 70)}), ("RUBY HOOK", fishing.HOOK, {"k": (255, 90, 90)}),
         ("NEON HOOK", fishing.HOOK, {"k": (90, 255, 170)}), ("BONE HOOK", [".kk.", ".k..", ".k..", ".k.k", ".k.k", "..k."], {"k": (236, 230, 206)}),
         ("ANCHOR", ["kkk.", ".k..", ".k..", "kk.k", ".k.k", ".kk."], {"k": (150, 170, 200)}), ("TRIDENT", ["k.k.", "kkk.", ".k..", ".k.k", ".k.k", "..k."], {"k": (120, 230, 255)}),
         ("HEART HOOK", ["k.k.", "kkk.", ".k..", ".k.k", ".k.k", "..k."], {"k": (255, 130, 190)})]
HOOKS += [("DIAMOND HOOK", fishing.HOOK, {"k": (190, 250, 255)}), ("OBSIDIAN HOOK", fishing.HOOK, {"k": (120, 90, 170)}), ("STAR HOOK", [".k..", "kkk.", ".k..", ".k.k", ".k.k", "..k."], {"k": (255, 230, 90)}),
          ("SKULL HOOK", ["kkk.", "k.k.", "kkk.", ".k.k", ".k.k", "..k."], {"k": (236, 230, 206)}), ("CORAL HOOK", ["k.k.", ".k..", ".k..", ".k.k", "kk.k", "..k."], {"k": (255, 120, 110)}),
          ("LIGHTNING", ["..k.", ".k..", "kkk.", "..kk", ".k.k", "..k."], {"k": (255, 250, 120)})]
items += [("hook%d" % i, from_rows(pg, rows, pal)) for i, (_, rows, pal) in enumerate(HOOKS)]
P = {"k": INK, "r": (226, 78, 70), "w": (250, 250, 255), "y": (255, 210, 70), "b": (110, 70, 44), "g": (90, 190, 100), "c": (90, 230, 255), "p": (200, 110, 240), "o": (255, 160, 70), "s": (150, 160, 180), "n": (40, 60, 130)}
HATS = [("NO HAT", None), ("BALL CAP", ["..rrrr....", ".rrrrrr...", "rrrrrrrrrr"]), ("TOP HAT", ["..kkkk..", "..kkkk..", "..rrrr..", ".kkkkkk."]), ("CROWN", ["y.y.y.y", "yyyyyyy", "yryryry"]),
        ("PIRATE HAT", ["...kk...", "..kwwk..", ".kkkkkk.", "kkkkkkkk"]), ("BEANIE", ["...w...", "..ccc..", ".ccccc.", ".wwwww."]), ("COWBOY HAT", ["...bbbb...", "...bbbb...", "bbbbbbbbbb"]),
        ("PARTY HAT", ["..y..", "..p..", ".pcp.", ".ppp.", "pcpcp"]), ("HALO", [".yyyyy.", "y.....y", ".yyyyy."]), ("WIZARD HAT", ["....n...", "...nn...", "..nyn...", ".nnnnn..", "nnnnnnnn"]),
        ("BUCKET HAT", ["..gggg..", ".gggggg.", "gggggggg"]), ("VIKING HELM", ["w......w", "wssssssw", ".ssssss.", ".syyyys."]), ("CHEF HAT", [".wwwww.", "wwwwwww", ".wwwww.", ".wwwww."]),
        ("PROPELLER", ["rrr.ccc", "...y...", "..ryr..", ".rcrcr."])]
P.update({"e": (230, 150, 60), "f": (255, 110, 150), "m": (120, 80, 50), "a": (60, 60, 70), "z": (30, 120, 60)})
HATS += [("FISHING HAT", ["...rk...", ".gggggg.", "gggggggg"]), ("SOMBRERO", ["...ee...", "..eeee..", "eeeeeeee", ".eoeoeo."]), ("FEZ", [".rrr.", ".rrr.", "rrrrr", "..y.."]),
         ("GRAD CAP", ["kkkkkkk", "..kkky.", "..kkk.y"]), ("ANTLERS", ["m.m..m.m", ".mm..mm.", "..m..m.."]), ("SANTA HAT", ["...rrw", "..rrr.", ".rrrr.", "wwwwww"]),
         ("PUMPKIN", ["...z...", ".eeeee.", "eekeke.", ".eeeee."]), ("FLOWER CROWN", ["f.y.f.y", "zzzzzzz"]), ("ASTRONAUT", [".wwwww.", "wcccccw", "wcccccw", ".wwwww."]),
         ("HEADPHONES", [".aaaaa.", "a.....a", "r.....r"]), ("DINO HOOD", ["g.g.g..", "ggggggg", "gwgkggg"]), ("GOLDEN HALO", [".yyyyyyy.", "y.......y", ".yyyyyyy."])]
items += [("hat%d" % i, outlined(pg, from_rows(pg, rows, P))) for i, (_, rows) in enumerate(HATS) if rows]
FLAIR = [("NOTHING", None), ("SUNGLASSES", ["kkkkkk", "kk.kk."]), ("PARTY HATS", [".y.", ".p.", "pcp"]), ("TINY CROWNS", ["y.y.y", "yyyyy"]), ("BOW TIES", ["r.r", "rrr", "r.r"]),
         ("TOP HATS", [".kkk.", ".kkk.", "kkkkk"]), ("MONOCLES", ["yyy", "y.y", "yyy", "..y"]), ("HALOS", ["yyyyy"]), ("PROPELLERS", ["rr.cc", "..y..", ".ggg."]), ("EYE PATCHES", ["kkkk", ".kk."])]
FLAIR += [("MUSTACHES", ["kk.kk", ".kkk."]), ("PINK BOWS", ["f.f", "fff", "f.f"]), ("SANTA HATS", ["..w", ".rr", "rrr", "www"]), ("FLOWERS", [".f.", "fyf", ".f."]),
          ("CHEF HATS", [".www.", "wwwww", ".www."]), ("NINJA BANDS", ["rrrrr", "....r"]), ("GOLD CHAINS", ["y.y.y", ".y.y."]), ("WIZARD HATS", ["..n", ".nn", "nyn", "nnn"]),
          ("SNORKELS", ["cccc", "c..c", "cccc", "...k"]), ("DIAMONDS", [".c.", "ccc", ".c."])]
FLAIR += [("TINY DUCKS", ["..y.", ".yyo", "yyy."])]          # secret: the Konami code. Secret rewards are appended past the shop's items
FLAIR_POS = ["", "face", "top", "top", "chin", "top", "face", "top", "top", "face", "face", "chin", "top", "top", "top", "face", "chin", "top", "face", "top", "top"]
items += [("flair%d" % i, from_rows(pg, rows, P)) for i, (_, rows) in enumerate(FLAIR) if rows and i < 20]
# ---- pets that ride in the boat, and flags for the stern
PETS = [("NO PET", None), ("CRAB", ["r...r", ".rrr.", "rwkrr", ".r.r."]), ("RUBBER DUCKY", [".yy..", "ykyo.", "yyy..", "yyyy."]), ("CAT", ["e..e.", "eeee.", "ekek.", "eeeee", ".e.e."]),
        ("PUPPY", [".mm..", "mkmm.", "mmmmk", ".mmm.", ".m.m."]), ("PARROT", [".gg..", "gwkr.", "ggg..", ".gg..", ".rr.."]), ("OCTOPUS", [".ppp.", "pkpkp", "ppppp", "p.p.p"]),
        ("FROGLET", ["g.g..", "ggggg", "gkgkg", ".ggg."]), ("JELLY", [".fff.", "fffff", "f.f.f", ".f.f."]), ("TINY WHALE", ["......n", "nnnnnn.", "nwknnnn", ".nnnnn."]),
        ("SNAIL", ["..ee.", ".eyee", "ggeee", "ggggg"]), ("BABY KRAKEN", [".rrr.", "rkrkr", "rrrrr", "r.r.r"]), ("GOLDEN FISH", ["..yy.", "yyyky", ".yyy.", "y...."]), ("GHOST", [".www.", "wkwkw", "wwwww", "w.w.w"])]
items += [("pet%d" % i, outlined(pg, from_rows(pg, rows, P))) for i, (_, rows) in enumerate(PETS) if rows]
FLAGS = [("NO FLAG", None), ("RED PENNANT", ["rrrrrr", "rrrr..", "rr...."]), ("PIRATE FLAG", ["kkkkkk", "kwwkkk", "kkwkkk", "kwkwkk"]), ("CHECKERED", ["kwkwkw", "wkwkwk", "kwkwkw", "wkwkwk"]),
         ("GOLD STAR", ["nnnnnn", "nnynnn", "nyyynn", "nnynnn"]), ("RAINBOW", ["rrrrrr", "eeeeee", "yyyyyy", "gggggg", "cccccc"]), ("FISH FLAG", ["cccccc", "ckyyyc", "cyyyyc", "cccccc"]),
         ("SKULL BONES", ["kkkkkk", "kwwwkk", "kwkwkk", "kkwkkk"]), ("FLAME", ["e.r...", "eeee..", "rrreee", "eeee.."]), ("MOON", ["nnnnnn", "nnywnn", "nnwnnn", "nnywnn"]),
         ("WAVE", ["cccccc", "cwccwc", "wcwwcw", "cccccc"]), ("CROWN FLAG", ["pppppp", "pyypyp", "pyyyyp", "pppppp"])]
FLAGS += [("BOTTLE FLAG", ["cccccc", "ccbccc", "cwwwwc", "cccccc"]), ("GOLD BOOT", ["nnnnnn", "nnyynn", "nnyyyn", "nyyyyn"]), ("ECLIPSE", ["kkyykk", "kykkyk", "kykkyk", "kkyykk"])]   # secret rewards
items += [("flag%d" % i, from_rows(pg, rows, P)) for i, (_, rows) in enumerate(FLAGS) if rows and i < 12]
items += [(fid, art.spr[fid][0]) for fid in LATE]
items += [("flair%d" % i, from_rows(pg, rows, P)) for i, (_, rows) in enumerate(FLAIR) if i >= 20]
items += [("flag%d" % i, from_rows(pg, rows, P)) for i, (_, rows) in enumerate(FLAGS) if i >= 12]
# ---- the Rusty Hook: the grumpy old fisherman who runs it
OLDMAN = ["...yyyyy....", "..yyyyyyy...", ".yyyyyyyyyy.", "...ssssss...", "...kkssskk..", "...skssks...", "..bssssssb..", "..bbbbbbbbm.",
          "..bbbkkbbbmm", "...bbbbbb...", "..yyybbyyy..", ".yyyyyyyyyy.", ".yyyyyyyyyy.", ".yyyyyyyyyy.", "..aa....aa.."]
items += [("oldman", outlined(pg, from_rows(pg, OLDMAN, {"y": (240, 196, 60), "s": (236, 190, 160), "k": INK, "b": (226, 226, 234), "m": (120, 80, 50), "a": (60, 60, 70)})))]
# ---- secrets and events: a message in a bottle, and seasonal things fish wear
items += [("bottle", outlined(pg, from_rows(pg, ["..mm..", "..mm..", ".cwwc.", "cwwwwc", "cwwwwc", "ccwwcc", "cccccc", ".cccc."], {"m": (150, 100, 60), "c": (110, 200, 170), "w": (250, 240, 210)}))),
          ("evturkey", from_rows(pg, ["r.e.y", ".rey.", ".mmm."], P)), ("evpumpkin", from_rows(pg, [".z.", "eee", "eke"], P))]
# ---- the Flipside: the Crossing's creatures, the flesh jelly, and a monster version of every character, pet and hat
import flipside as FS
items += [("fc_" + c[0], outlined(pg, from_rows(pg, c[7], FS.PAL))) for c in FS.CREATURES[:FS.CROSSING_N]]
items += [("flurker", outlined(pg, from_rows(pg, FS.LURKER, FS.PAL)))]
_named = dict(items)
items += [("mchar%d" % i, FS.monsterify(_named["char%d" % i], 100 + i)) for i in range(len(CHARS))]
items += [("mpet%d" % i, FS.monsterify(_named["pet%d" % i], 500 + i, eyes=2, teeth=_named["pet%d" % i].get_width() >= 7)) for i in range(1, len(PETS))]
items += [("mhat%d" % i, FS.monsterify(_named["hat%d" % i], 300 + i, eyes=0, teeth=False)) for i in range(1, len(HATS)) if "hat%d" % i in _named]
# ---- the endgame (drop 5): the other seven zones' creatures, and the Bestiary's monster boat. Appended so nothing above moves.
items += [("fc_" + c[0], outlined(pg, from_rows(pg, c[7], FS.PAL))) for c in FS.CREATURES[FS.CROSSING_N:]]
MAW_BOAT = "MAW BOAT"            # a Bestiary reward, never in the shop: the rowboat, gone wrong
items += [("boat%d" % len(BOATS), FS.monsterify(outlined(pg, from_rows(pg, BOAT_ROWS[0], {"b": (96, 22, 42), "w": (236, 228, 210), "r": (200, 100, 122), "d": (146, 32, 62)})), 777, eyes=5))]
# ---- the Rusty Hook's own cosmetics, bought with chips in the chip shop and never in the coin shop. Appended so nothing above moves.
TAV_BOATS = ["RUSTY TUB"]
HATS.append(("OLD MAN'S CAP", ["..yyyy...", ".yyyyyy..", "yyyyyyyyy", "y........"]))
PETS.append(("BAR CAT", ["s..s..", "ssss..", "sksk.w", "sssssy", ".s.s.y"]))
FLAGS.append(("ACE OF SPADES", ["wwkwww", "wkkkww", "kkkkkw", "wwkwww"]))
FLAIR.append(("POKER CHIPS", ["rwrwr", "rrrrr", "wrwrw"])); FLAIR_POS.append("top")
items += [("hat%d" % (len(HATS) - 1), outlined(pg, from_rows(pg, HATS[-1][1], P))), ("pet%d" % (len(PETS) - 1), outlined(pg, from_rows(pg, PETS[-1][1], P))),
          ("flag%d" % (len(FLAGS) - 1), from_rows(pg, FLAGS[-1][1], P)), ("flair%d" % (len(FLAIR) - 1), from_rows(pg, FLAIR[-1][1], P)),
          ("boat%d" % (len(BOATS) + 1), outlined(pg, from_rows(pg, BOAT_ROWS[0], {"b": (96, 60, 40), "w": (196, 170, 130), "r": (186, 96, 48), "d": (130, 64, 32)})))]
_named = dict(items)
items += [("mhat%d" % (len(HATS) - 1), FS.monsterify(_named["hat%d" % (len(HATS) - 1)], 300 + len(HATS) - 1, eyes=0, teeth=False)),
          ("mpet%d" % (len(PETS) - 1), FS.monsterify(_named["pet%d" % (len(PETS) - 1)], 500 + len(PETS) - 1, eyes=2, teeth=False))]
# ---- Nov 18, 2026: six sharks. Appended so nothing above moves.
items += [(fid, art.spr[fid][0]) for fid in LATE2]
# ---- Nov 18, 2026: more Rusty Hook cosmetics (chips only): a Chip Hook, and the Jackpot and High Stakes sets. Appended so nothing above moves.
HOOKS += [("CHIP HOOK", ["kwk.", ".k..", ".k..", ".k.k", ".k.k", "..k."], {"k": (240, 80, 80), "w": (250, 250, 255)}),
          ("LUCKY 7 HOOK", ["kkk.", "..k.", ".k..", ".k.k", ".k.k", "..k."], {"k": (255, 210, 70)}),
          ("DICE HOOK", ["www.", "wkw.", "www.", ".w.w", ".w.w", "..w."], {"w": (250, 250, 255), "k": INK})]
FLAIR += [("777", ["yyy.yyy", "..y...y", ".y...y."]), ("CARD SUITS", ["r.r..k.", "rrr.kkk", ".r...k."])]; FLAIR_POS += ["top", "top"]
items += [("hook%d" % i, from_rows(pg, HOOKS[i][1], HOOKS[i][2])) for i in range(len(HOOKS) - 3, len(HOOKS))]
items += [("flair%d" % i, from_rows(pg, FLAIR[i][1], P)) for i in range(len(FLAIR) - 2, len(FLAIR))]
# ---- Nov 18, 2026: the Captain's Locker (prestige gear, chips only) and the Shady Dealer's weekly stock (casino.js).
# Never sold for coins (all past SHOP_N). Appended so nothing above moves. Names are looked up by casino.js, so keep them.
P.update({"u": (255, 245, 220), "t": (60, 230, 200), "j": (24, 22, 34)})
TAV_BOATS += ["GOLDEN TRAWLER", "BLACK PEARL"]
_boat_pal = [{"b": (30, 40, 90), "w": (255, 240, 170), "r": (255, 210, 70), "d": (220, 160, 40)},     # golden trawler: navy and gold
             {"b": (24, 22, 34), "w": (255, 245, 220), "r": (70, 66, 96), "d": (200, 40, 60)}]       # black pearl
NEW_HATS = [("CROWN JEWELS", ["y.y.y.y.y", "yyyyyyyyy", "ycyryfycy", "yyyyyyyyy"]), ("ADMIRAL'S HAT", ["...nnn...", ".nnnynnn.", "nnnnnnnnn", "yyyyyyyyy"]),
            ("BOWLER", ["..kkk..", ".kkkkk.", ".rrrrr.", "kkkkkkk"]), ("TRICORN", ["k.....k", "kkkykkk", ".kkkkk."]), ("STRAW HAT", ["..eeee..", "..rrrr..", "eeeeeeee"]),
            ("JESTER CAP", ["r.....y", "rr...yy", ".rryyy.", "yyyrrrr"]), ("NIGHTCAP", ["....w", "..ccc", ".cccc", "ccccc", "wwwww"]), ("GOLD LAUREL", ["y.y.y.y", ".yyyyy.", "yy...yy"])]
NEW_PETS = [("KRAKEN", [".ppppp.", "ppkpkpp", "ppppppp", "p.p.p.p", "p.p.p.p", ".p...p."]), ("GOLDEN SEAHORSE", ["..yy.", ".yyyk", "..yy.", ".yy..", "..yy.", "...y."]),
            ("LOBSTER", ["r...r", "rr.rr", ".rrr.", ".rkr.", ".r.r."]), ("SEAGULL", [".ww..", "wwkoo", "wwww.", "..ww."]), ("OTTER", [".bb..", "bkbbu", "bbbbb", "b.b.b"]),
            ("HERMIT CRAB", ["..ee.", ".eeee", "reeee", "r.r.."])]
NEW_FLAGS = [("ROYAL STANDARD", ["rrrrrr", "ryryry", "ryyyyr", "rrrrrr"]), ("DICE FLAG", ["wwwwww", "wkwwkw", "wwwwww", "wkwwkw"]), ("ANCHOR FLAG", ["nnwnnn", "nwwwnn", "nnwnnn", "nwwwnn"]),
             ("LIGHTHOUSE", ["cccccc", "ccrccc", "ccwccc", "ccrccc"]), ("RED ROGER", ["rrrrrr", "rwwrrr", "rrwrrr", "rwrwrr"])]
NEW_FLAIR = [("BIG RUBIES", [".r.", "rrr", "rwr", ".r."], "top"), ("BANDANAS", ["rwrwr", "rrrrr", "....r"], "top"), ("PEARLS", ["u.u.u", ".u.u."], "chin"), ("AVIATORS", ["yyyyyy", "ss.ss."], "face")]
NEW_HOOKS = [("LEVIATHAN HOOK", ["k..k", "kkkk", ".k..", ".kkk", ".k.k", "..k."], {"k": (60, 230, 200)}),
             ("FISHBONE HOOK", ["k.k.", ".k..", "kkk.", ".k.k", "kk.k", "..k."], {"k": (236, 230, 206)}),
             ("KEY HOOK", ["kk..", "kk..", ".k..", ".kkk", ".k.k", "..k."], {"k": (255, 210, 70)})]
_b0 = len(BOATS) + 1 + len(TAV_BOATS) - 2                     # boats in DATA: BOATS, the maw boat, then the tavern's
items += [("boat%d" % (_b0 + k), outlined(pg, from_rows(pg, BOAT_ROWS[0], _boat_pal[k]))) for k in range(2)]
for name, rows in NEW_HATS: HATS.append((name, rows)); items.append(("hat%d" % (len(HATS) - 1), outlined(pg, from_rows(pg, rows, P))))
for name, rows in NEW_PETS: PETS.append((name, rows)); items.append(("pet%d" % (len(PETS) - 1), outlined(pg, from_rows(pg, rows, P))))
for name, rows in NEW_FLAGS: FLAGS.append((name, rows)); items.append(("flag%d" % (len(FLAGS) - 1), from_rows(pg, rows, P)))
for name, rows, at in NEW_FLAIR: FLAIR.append((name, rows)); FLAIR_POS.append(at); items.append(("flair%d" % (len(FLAIR) - 1), from_rows(pg, rows, P)))
for name, rows, pal in NEW_HOOKS: HOOKS.append((name, rows, pal)); items.append(("hook%d" % (len(HOOKS) - 1), from_rows(pg, rows, pal)))
_named = dict(items)
items += [("mhat%d" % i, FS.monsterify(_named["hat%d" % i], 300 + i, eyes=0, teeth=False)) for i in range(len(HATS) - len(NEW_HATS), len(HATS))]
items += [("mpet%d" % i, FS.monsterify(_named["pet%d" % i], 500 + i, eyes=2, teeth=_named["pet%d" % i].get_width() >= 7)) for i in range(len(PETS) - len(NEW_PETS), len(PETS))]
# ---- Nov 18, 2026: Driftwood Isle rewards (island.js part 8d). Never sold; earned on the island. Appended so nothing above moves.
# Names are looked up by island.js, so keep them.
ISLE_HAT = ("KEEPER'S CAP", ["..nnnn...", ".nnnnnn..", "nnnnnnnnn", ".yyyyyyy."])
ISLE_PET = ("PICKLES", ["e..e.", "eeee.", "eyey.", "eeeee", ".e.e."])
ISLE_FLAG = ("DRIFTWOOD ISLE", ["cccccc", "cyccgc", "cggggc", "ssssss"])
ISLE_FLAIR = ("SEA GLASS", ["t.c", ".g.", "c.t"], "top")
HATS.append(ISLE_HAT); items.append(("hat%d" % (len(HATS) - 1), outlined(pg, from_rows(pg, ISLE_HAT[1], P))))
PETS.append(ISLE_PET); items.append(("pet%d" % (len(PETS) - 1), outlined(pg, from_rows(pg, ISLE_PET[1], P))))
FLAGS.append(ISLE_FLAG); items.append(("flag%d" % (len(FLAGS) - 1), from_rows(pg, ISLE_FLAG[1], P)))
FLAIR.append(ISLE_FLAIR[:2]); FLAIR_POS.append(ISLE_FLAIR[2]); items.append(("flair%d" % (len(FLAIR) - 1), from_rows(pg, ISLE_FLAIR[1], P)))
TAV_BOATS += ["ISLAND SKIFF"]
items.append(("boat%d" % (len(BOATS) + 1 + len(TAV_BOATS) - 1), outlined(pg, from_rows(pg, BOAT_ROWS[0], {"b": (140, 96, 58), "w": (240, 236, 220), "r": (90, 160, 120), "d": (60, 110, 84)}))))
_named = dict(items)
items += [("mhat%d" % (len(HATS) - 1), FS.monsterify(_named["hat%d" % (len(HATS) - 1)], 300 + len(HATS) - 1, eyes=0, teeth=False)),
          ("mpet%d" % (len(PETS) - 1), FS.monsterify(_named["pet%d" % (len(PETS) - 1)], 500 + len(PETS) - 1, eyes=2, teeth=False))]
W = 512; x = y = 1; rowh = 0; pos = {}
for name, s in items:
    w, h = s.get_size()
    if x + w + 1 > W: x, y, rowh = 1, y + rowh + 1, 0
    pos[name] = [x, y, w, h]; x += w + 1; rowh = max(rowh, h)
atlas = pg.Surface((W, y + rowh + 1), pg.SRCALPHA)
for name, s in items: atlas.blit(s, pos[name][:2])
pg.image.save(atlas, OUT + "/assets/atlas.png")
import math, random
WW, O = 480, 180                      # the web ocean is up to 480 wide; the arcade's 120-wide strip sits in the middle of it
def build_wide():
    F = fishing; M, DEPTH_PX = F.M, F.DEPTH_PX
    H = DEPTH_PX + 260
    w = pg.Surface((WW, H)).convert()
    band = 6
    for y0 in range(0, H, band):
        c, c2 = F.water_color(y0 / M), F.water_color((y0 + band) / M)
        w.fill(c, (0, y0, WW, band))
        for x in range(WW):
            if (x + y0 // band) % 2 == 0: w.set_at((x, y0 + band - 1), c2)
            if (x + (y0 // band) * 2) % 4 == 0: w.set_at((x, y0 + band - 1 - 1), c2)
    rnd = random.Random(3)
    glows = []
    P = lambda pts: [(x + O, y) for x, y in pts]
    hull, deck, dark = (50, 58, 84), (74, 80, 104), (30, 34, 56)
    wy = 350 * M
    pg.draw.polygon(w, hull, P([(44, wy + 60), (200, wy - 22), (216, wy + 50), (196, wy + 210), (60, wy + 210), (40, wy + 150)]))
    pg.draw.polygon(w, dark, P([(60, wy + 210), (196, wy + 210), (204, wy + 150), (52, wy + 190)]))
    pg.draw.line(w, deck, (44 + O, wy + 60), (200 + O, wy - 22), 3)
    pg.draw.line(w, deck, (84 + O, wy + 40), (70 + O, wy - 30), 3); pg.draw.line(w, deck, (60 + O, wy - 4), (86 + O, wy - 14), 2)
    pg.draw.line(w, deck, (150 + O, wy + 4), (158 + O, wy - 70), 3); pg.draw.line(w, deck, (140 + O, wy - 40), (176 + O, wy - 50), 2)
    for i in range(12):
        cx, cy = 66 + i * 11 + O, wy + 96 + i * 3
        pg.draw.circle(w, dark, (cx, cy), 4); pg.draw.circle(w, (255, 220, 110) if i % 3 == 0 else (20, 24, 44), (cx, cy), 2)
    for _ in range(160):
        x, y = rnd.randrange(46, 214) + O, wy + rnd.randrange(-10, 208)
        if tuple(w.get_at((x, y)))[:3] == hull: w.set_at((x, y), rnd.choice([deck, dark, (60, 110, 100)]))
    sy = 404 * M
    pg.draw.polygon(w, hull, P([(-84, sy - 44), (46, sy + 40), (58, sy + 120), (-96, sy + 176)]))
    pg.draw.polygon(w, dark, P([(-90, sy + 120), (58, sy + 120), (-96, sy + 176)]))
    pg.draw.line(w, deck, (-84 + O, sy - 44), (46 + O, sy + 40), 3); pg.draw.line(w, deck, (20 + O, sy + 24), (30 + O, sy - 40), 2)
    pg.draw.line(w, deck, (-40 + O, sy - 14), (-46 + O, sy - 80), 2)
    for i in range(7):
        pg.draw.circle(w, dark, (-72 + i * 14 + O, sy + 34 + i * 6), 4); pg.draw.circle(w, (20, 24, 44), (-72 + i * 14 + O, sy + 34 + i * 6), 2)
    for i in range(26):
        w.fill(deck if i % 2 else dark, (46 + i + O, wy + 212 + int(i * i * 0.16), 2, 2))
    for bx, by in ((-150, 372), (250, 428)):            # more wreckage further out, for wide screens
        y = by * M; x = bx + O
        pg.draw.polygon(w, hull, [(x, y + 30), (x + 70, y), (x + 84, y + 60), (x + 10, y + 80)])
        pg.draw.polygon(w, dark, [(x + 10, y + 80), (x + 84, y + 60), (x + 80, y + 44), (x + 6, y + 64)])
        pg.draw.line(w, deck, (x, y + 30), (x + 70, y), 3); pg.draw.line(w, deck, (x + 36, y + 14), (x + 30, y - 46), 2)
        for i in range(3): pg.draw.circle(w, dark, (x + 22 + i * 16, y + 44 - i * 4), 3)
    fy = DEPTH_PX + 14
    for x in range(WW):
        xs = x - O
        h = int(8 + 6 * math.sin(xs * 0.21) + 4 * math.sin(xs * 0.07 + 2))
        w.fill((16, 14, 34), (x, fy - h, 1, H - fy + h)); w.set_at((x, fy - h), (44, 40, 80))
    for base in (0, 190, -150):
        for bx in (14, 30, 46): pg.draw.arc(w, (210, 210, 196), (bx + base + O, fy - 26, 22, 40), 0.3, 2.9, 2)
        pg.draw.line(w, (210, 210, 196), (10 + base + O, fy - 8), (72 + base + O, fy - 10), 2)
    vents = []
    for vx, vh in ((94, 22), (6, 14), (112, 12), (-52, 18), (-128, 12), (166, 20), (282, 14), (-176, 16)):
        x = vx + O
        pg.draw.polygon(w, (40, 30, 60), [(x - 6, fy - 2), (x, fy - vh), (x + 6, fy - 2)]); w.fill((255, 120, 60), (x - 1, fy - vh - 2, 3, 3))
        vents.append([x, fy - vh - 2])
    for _ in range(160):
        x = rnd.randrange(WW)
        w.fill(rnd.choice([(44, 40, 80), (60, 50, 96), (30, 26, 60)]), (x, fy + rnd.randrange(-2, 60), rnd.randrange(2, 6), 1))
    # --- crystal caves: outcrops of rock studded with glowing crystals
    for _ in range(34):
        x, y = rnd.randrange(0, WW), rnd.randrange(578 * M, 696 * M)
        r = rnd.randrange(9, 20)
        pg.draw.polygon(w, (20, 14, 40), [(x - r, y + r // 2), (x - r // 2, y - r // 2), (x + r // 2, y - r // 3), (x + r, y + r // 2), (x, y + r)])
        for k in range(rnd.randrange(3, 6)):
            cx, h, col = x + rnd.randrange(-r, r), rnd.randrange(8, 22), rnd.choice([(90, 230, 255), (220, 120, 255), (140, 255, 210), (255, 150, 230)])
            lean = rnd.randrange(-5, 6)
            pg.draw.polygon(w, col, [(cx - 2, y), (cx + lean, y - h), (cx + 3, y)]); pg.draw.line(w, (255, 255, 255), (cx, y - 2), (cx + lean, y - h + 2), 1)
        glows.append([x, y - 8, 15])
    # --- vent fields: black smoker chimneys with glowing mouths
    for _ in range(26):
        x, top = rnd.randrange(0, WW), rnd.randrange(706 * M, 815 * M)
        hgt, bw = rnd.randrange(70, 260), rnd.randrange(8, 16)
        pg.draw.polygon(w, (30, 18, 22), [(x - 3, top), (x + 3, top), (x + bw, top + hgt), (x - bw, top + hgt)])
        pg.draw.line(w, (60, 34, 34), (x - 3, top), (x - bw, top + hgt), 1)
        w.fill((255, 130, 50), (x - 2, top - 2, 5, 3)); w.fill((255, 220, 120), (x - 1, top - 1, 3, 1))
        glows.append([x, top, 13])
    # --- bone yard: the ribs and skulls of things that sank here
    bone, shade = (196, 196, 180), (120, 122, 112)
    for _ in range(12):
        x, y = rnd.randrange(-20, WW - 60), rnd.randrange(838 * M, 950 * M)
        n = rnd.randrange(4, 8)
        pg.draw.line(w, bone, (x, y + 30), (x + n * 14, y + 26), 3)
        for k in range(n):
            pg.draw.arc(w, bone if k % 2 else shade, (x + k * 14, y - 30 + k * 2, 20, 62), 0.2, 3.0, 2)
    for _ in range(5):
        x, y = rnd.randrange(20, WW - 50), rnd.randrange(845 * M, 945 * M)
        pg.draw.ellipse(w, bone, (x, y, 40, 26)); pg.draw.rect(w, bone, (x + 26, y + 12, 26, 12))
        pg.draw.circle(w, (10, 12, 14), (x + 14, y + 12), 5); pg.draw.circle(w, (10, 12, 14), (x + 28, y + 12), 4)
        for k in range(5): w.fill((10, 12, 14), (x + 30 + k * 4, y + 21, 2, 3))
    # --- the trench: walls closing in at the far edges
    for side in (0, 1):
        pts = [(0 if side == 0 else WW, 960 * M)]
        for yy in range(960 * M, 1112 * M, 40):
            d = 14 + int(26 * (yy - 960 * M) / (150 * M)) + rnd.randrange(-8, 9)
            pts.append((d if side == 0 else WW - d, yy))
        pts.append((0 if side == 0 else WW, 1112 * M))
        pg.draw.polygon(w, (10, 10, 20), pts); pg.draw.lines(w, (30, 30, 52), False, pts[1:-1], 1)
    for _ in range(4600):
        y = rnd.randrange(200 * M, DEPTH_PX)
        if rnd.random() < (y / M - 200) / 400:
            w.set_at((rnd.randrange(WW), y), rnd.choice([(90, 230, 255), (140, 255, 200), (255, 130, 220), (200, 210, 255)]))
    return w, vents, H, glows
wide, wide_vents, wide_h, wide_glows = build_wide()
pg.image.save(wide, OUT + "/assets/water.png")
F = fishing
data = dict(atlas=pos, glyphs=ac._GLYPHS, species=[list(s[:3]) + [list(s[3])] + list(s[4:]) for s in F.SPECIES], zones=[list(z) for z in F.ZONES], zoneCol=F.ZONE_COL,
            lures=[["standard", "STANDARD", "BALANCED. 1 PULSE", 1.0, 1.0, 1, 1.0, 1.0, 0], ["angler", "ANGLER'S HOOK", "LET 2 FISH GO", 1.0, 1.0, 2, 1.0, 1.0, 0],
                   ["glow", "GLOW LURE", "PULLS FISH+JELLIES", 1.0, 1.0, 1, 1.5, 1.2, 26], ["sonar", "SONAR", "3 PULSES. SLOW DROP", 0.85, 1.0, 3, 1.0, 1.0, 0]], vents=wide_vents, glows=wide_glows, waterH=wide_h, waterW=WW, water=[[a, list(c)] for a, c in F.WATER],
            chars=CHARS, boats=[b[0] for b in BOATS] + [MAW_BOAT] + TAV_BOATS, pets=[p[0] for p in PETS], flags=[f[0] for f in FLAGS], flairPos=FLAIR_POS, hooks=[h[0] for h in HOOKS], hats=[h[0] for h in HATS], flair=[f[0] for f in FLAIR],
            flip=dict(zones=[list(z) for z in FS.ZONES], crossing=FS.CROSSING_M, junk=list(FS.JUNK), mythic=FS.MYTHIC, hunters=FS.HUNTERS, crossingN=FS.CROSSING_N,
                      species=[[c[0], c[1], c[2], list(c[3]), c[4], c[5], c[6]] for c in FS.CREATURES]),
            dark=[[300, 0], [480, 0.34], [570, 0.38], [600, 0.28], [690, 0.28], [720, 0.34], [830, 0.38], [960, 0.46], [1110, 0.46], [1160, 0.38]],
            consts=dict(MAX_M=F.MAX_M, BOTTOM_M=F.BOTTOM_M, BLEND=F.BLEND, BOTTOM_BONUS=F.BOTTOM_BONUS, BOUNTY_X=F.BOUNTY_X, JELLY_CHANCE=F.JELLY_CHANCE, PER_CHUNK=[list(p) for p in F.PER_CHUNK],
                        CHUNK=F.CHUNK, TROPHY_CHANCE=0.022, LEGEND_BASE=0.05, LEGEND_CHANCE={"chest": 0.1, "pearl": 0.1, "ancient": 0.06}, MYTHIC_CHANCE=0.006, JUNK=list(F.JUNK), FIXED=list(F.FIXED), GLOWS=list(F.GLOWS), CAPACITY=F.CAPACITY))
# ---- Driftwood Isle (island.js): every character's walking views as row art, so the island draws your own character
_hex = lambda c: "#%02x%02x%02x" % tuple(c[:3])
data["isle"] = dict(chars=[dict(pal={k: _hex(v) for k, v in c["pal"].items()}, blink=c["blink"], views={v: [list(c[v][0]), c[v][1], c[v][2]] for v in ("front", "back", "side")}) for c in hopper.CRITTERS])
open(OUT + "/data.js", "w").write("// Generated from the arcade version of Reel Deep. Sprites live in assets/atlas.png.\nconst DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(atlas.get_size(), art.water.get_size(), os.path.getsize(OUT + "/assets/water.png"), os.path.getsize(OUT + "/assets/atlas.png"), os.path.getsize(OUT + "/data.js"))
