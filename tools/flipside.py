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


# ---- drop 5: the other seven zones. Appended, so the ids above keep their places.
CROSSING_N = len(CREATURES)     # the Crossing's creatures (and the junk and the mythic) come first in the atlas
PAL.update({"f": (250, 196, 150), "i": (240, 120, 56), "h": (96, 70, 104), "H": (58, 40, 64), "u": (124, 84, 50), "U": (80, 52, 30),
            "x": (188, 104, 56), "n": (88, 132, 70), "e": (120, 170, 220)})


def _pad(rows):
    w = max(len(r) for r in rows)
    return [r.ljust(w, ".") for r in rows]


_MORE = [
    # ---- 4. The Boil: blisters, steam, things that pop
    ("blisterfish", "BLISTER FISH", 3, (6, 12), 14, 5, False, ["...ff.f...", "m.fpffpff.", "mmfffffyk.", "m.ffpfffff", "...fpff..."]),
    ("boilleech", "BOILING LEECH", 3, (3, 7), 18, 5, False, [".irrrrrrrrr..", "irrirrirrrrrw", ".rrrrrrrrrrwk", "..i...i...rw."]),
    ("poxray", "POX RAY", 3, (14, 22), 12, 4, False, ["r.........r", "rrr.....rrr", "rprrrrrrrpr", "rrrprrrprrr", ".rrryrkrrr.", "...rrrrr...", ".....r.....", ".....r....."]),
    ("scaldsnail", "SCALD SNAIL", 3, (3, 6), 6, 6, False, ["...iiii..k", "..iyyiii.f", "..iyiyii.f", "...iiii.ff", "fffffffffk"]),
    ("bubblegut", "BUBBLE GUT", 3, (8, 14), 10, 5, False, ["....w.w.....", "...ppppp....", "..ppwpppp.w.", "mppppwppyk..", "mppwpppppp..", "..pppppw....", "...ppppp...."]),
    ("festerling", "FESTERLING", 3, (2, 5), 20, 6, False, ["..gg.g..", "m.mgmmm.", "mmmmmgyk", "m.mmgmm.", "...g...."]),
    ("sorethumb", "SORE THUMB", 3, (5, 9), 8, 4, False, [".rrrr.", "rmmmmr", "pppppp", "pkppkp", "pppppp", "pprrpp", "pppppp", ".pppp."]),
    ("steamslug", "STEAM SLUG", 3, (4, 8), 10, 5, False, ["..w..w....", ".w..w..w..", "...ssssss.", "..sSSSSsyk", "sssssssssk"]),
    ("bigpop", "THE BIG POP", 3, (100, 160), 6, 0, True, [".....fffff.....", "...ffffpffff...", "..fpffffffwff..", ".fffffffffwwff.", "fffpffffffffyk.", "fffffffpffffyyk",
                                                         ".ffffffffffpff.", "..ffpffffffff..", "...fffffpfff...", ".....fffff.....", "......m.m......"]),
    ("motherblister", "MOTHER BLISTER", 3, (140, 200), 8, 0, True, ["...p...p...p....", "..rrr.rrr.rrr...", ".rrrrrrrrrrrrrr.", "rrprrprrprrrryrk", "rrrrrrrrrrrrrrrk",
                                                                   "rprrprrprrprrrr.", ".rrrrrrrrrrrrr..", "..f..f..f..f...."]),
    ("simmer", "THE SIMMER", 3, (120, 180), 12, 0, True, ["..w...w...w..", ".w...w...w...", "iiiiiiiiiiiii", "iyyiiiiiiiyyi", ".iiiiiiiiiii.", ".ikkkkkkkkki.", ".iwiwiwiwiwi.",
                                                         "..iiiiiiiii..", "...i.....i..."]),
    # ---- 5. The Hollows: eyes and glass
    ("eyecluster", "EYEBALL CLUSTER", 4, (3, 7), 10, 5, False, [".www..ww.", "wwkww.wkw", ".www.www.", "..rr.wkw.", ".wkw..ww.", "..w......"]),
    ("glassspider", "GLASS SPIDER", 4, (4, 9), 22, 4, False, ["l.l.....l.l", ".l.l...l.l.", "..lcccccl..", "..ccykycc..", "..lcccccl..", ".l.l...l.l.", "l.l.....l.l"]),
    ("blinker", "BLINKER", 4, (2, 5), 16, 6, False, ["....llll..", "l..lwwwwl.", "lllwwkkwl.", "l..lwwwwl.", "....llll.."]),
    ("staringshell", "STARING SHELL", 4, (6, 11), 4, 5, False, ["..ooooo..", ".occccco.", "ocwwkwwco", "occccccco", ".ooooooo."]),
    ("lenslouse", "LENS LOUSE", 4, (1, 3), 14, 6, False, [".cccc.", "ccwwcc", "cwkwcc", ".cccc.", "o.o.o."]),
    ("hollowshrimp", "HOLLOW SHRIMP", 4, (2, 5), 18, 6, False, ["......cc.", "..cccc..c", ".c....cyk", "c.....cc.", ".cc.c.c..", "..c.c.c.."]),
    ("weeper", "WEEPER", 4, (5, 10), 8, 4, False, ["..llllll..", ".lllllllll", "llllwklll.", ".llllelll.", "..llllll..", ".....e....", ".....e...."]),
    ("socketcrab", "SOCKET CRAB", 4, (6, 12), 12, 5, False, ["o.o....o.o", ".oo....oo.", "..oooooo..", ".oowkkwoo.", "oooooooooo", ".o.o..o.o."]),
    ("iriseel", "IRIS EEL", 4, (8, 15), 24, 4, False, [".llllllllllllllll.", "lllwkllllwklllllyk", ".llllllllllllllll."]),
    ("watcher", "THE WATCHER", 4, (90, 140), 4, 0, True, ["....ccccccc....", "..ccwwwwwwwcc..", ".cwwwwrwwwwwwc.", "cwwwwlllllwwwwc", "cwwwlkkkkklwrwc", "cwwrlkkykklwwwc",
                                                         "cwwwlkkkkklwwwc", "cwwwwlllllwwwwc", ".cwwwwwwrwwwwc.", "..ccwwwwwwwcc..", "....ccccccc...."]),
    ("hundredeyes", "HUNDRED EYES", 4, (130, 190), 10, 0, True, ["..lllllllllllll...", ".lwklwklwklwklwkl.", "lllllllllllllllly.", "lwklwklwklwklwklk.", "llllllllllllllll..",
                                                               ".lwklwklwklwklwl..", "..llllllllllll....", "...l..l..l..l....."]),
    # ---- 6. The Sink: drowned lights in the dark
    ("facelantern", "FACE LANTERN", 5, (5, 10), 8, 5, False, ["....k...", "....k...", "...yyy..", "..ykyky.", "..yykyy.", "...yyy..", ".hhhhhh.", "hhhhhhhk", ".hhhhhh."]),
    ("drownedangler", "DROWNED ANGLER", 5, (12, 22), 16, 4, False, [".....k......", "......k.....", "......t.....", "..hhhhhhh...", ".hhhhhhhhyk.", "hhhhhhhwkwkw",
                                                                   "hhhhhhhhhhh.", ".hhhhhhhhh..", "..h....h...."]),
    ("sinker", "SINKER", 5, (10, 18), 6, 5, False, ["...oo...", "..o..o..", "..oooo..", ".oooooo.", "ooykooyk", "oooooooo", ".oooooo."]),
    ("undertow", "UNDERTOW", 5, (6, 12), 26, 4, False, ["..hhhhhh..", ".h......h.", "h..hhhh..h", "h.h.yk.h.h", "h..hhh..h.", ".h......h.", "..hhhhh..."]),
    ("gloomgulper", "GLOOM GULPER", 5, (14, 24), 12, 4, False, ["hhhhhhhhh.", "hhhhhhhhyk", "hh.w.w.w.w", "h.........", "hh.w.w.w.w", "hhhhhhhhhh", ".hhhhhhh.."]),
    ("palelure", "PALE LURE", 5, (2, 5), 14, 5, False, ["......cc", ".....c..", "..sss...", ".sssyk..", "sssss...", ".s.s...."]),
    ("leadbelly", "LEAD BELLY", 5, (16, 26), 6, 4, False, ["..hhhhhhh..", ".hhhhhhhhyk", "hooooooooh.", "hoooooooooh", ".hhhhhhhhh."]),
    ("choker", "CHOKER", 5, (8, 14), 20, 4, False, ["...hhh.........", "..h...h........", "..h...hhhhhhhyk", "...hhh.hhhhhhh."]),
    ("wailingwisp", "WAILING WISP", 5, (1, 4), 22, 6, False, [".ccc.", "ckcck", "ccccc", "ckkkc", ".ccc.", "c.c.c", ".c.c."]),
    ("hushfish", "HUSH FISH", 5, (3, 7), 10, 6, False, ["..hhhh..", "h.hhhhhy", "hhhhhhk.", "h.hhhhh.", "..h..h.."]),
    ("deepbreath", "THE DEEP BREATH", 5, (160, 220), 6, 0, True, ["...ppppp...ppppp...", "..ppmpmpp.ppmpmpp..", ".ppmpmpmpppmpmpmpp.", ".pmpmpmpmpmpmpmpmp.", ".ppmpmpmpkpmpmpmpp.",
                                                                 "..ppmpmpk.kpmpmpp..", "...pppp.....pppp...", ".........r.........", ".........r........."]),
    ("lastlight", "THE LAST LIGHT", 5, (90, 140), 14, 0, True, [".......t.......", "......tyt......", ".......t.......", ".......k.......", "......k........", "..hhhhhhhhh....",
                                                               ".hhhhhhhhhhhh..", "hhhhhhhhhhhywk.", "hhhhhhhhhkwkwkw", ".hhhhhhhhhhhhh.", "..hhhhhhhhhh..."]),
    ("drownedking", "THE DROWNED KING", 5, (150, 210), 8, 0, True, ["..t.t.t.t...", "..ttttttt...", ".ooooooooo..", "oocwkcwkcoo.", "oooooooooooo", "ookkkkkkkoo.", ".ooooooooo..",
                                                                   "..o.o.o.o...", ".o.o.o.o.o.."]),
    # ---- 7. The Hulk: a ship that sank upwards
    ("barnaclehand", "BARNACLE HAND", 6, (6, 11), 14, 4, False, [".s.s.s.s..", ".s.s.s.s..", ".s.s.s.s.s", "sssssssss.", "sSssSssss.", ".sssssss..", "..sssss..."]),
    ("rotplank", "ROT PLANK", 6, (8, 14), 4, 5, False, ["uuuuuuuuuuuu", "uUuuuUuuxuuU", "uuuuyukuuuuu", "UUUUUUUUUUUU"]),
    ("bilgeblob", "BILGE BLOB", 6, (5, 10), 6, 5, False, ["...nnnn...", ".nngnnnnn.", "nnnnykngnn", "nngnnnnnnn", ".nnnnngnn.", "n..n..n..n"]),
    ("rustlouse", "RUST LOUSE", 6, (1, 3), 16, 6, False, [".xxxx.", "xxxxxk", "xuxuxy", ".xxxx.", "x.x.x."]),
    ("mastworm", "MAST WORM", 6, (4, 8), 12, 5, False, ["....uu......", ".pppuupppp..", "ppmpuumpmpyk", ".pppuupppp..", "....uu......"]),
    ("portholeeye", "PORTHOLE EYE", 6, (6, 10), 4, 5, False, ["..xxxxx..", ".xooooox.", "xowwkwwox", "xowkykwox", "xowwkwwox", ".xooooox.", "..xxxxx.."]),
    ("ropetail", "ROPE TAIL", 6, (5, 10), 18, 5, False, ["s.s.s.s......", ".s.s.s.uuuu..", "s.s.s.uuuuuyk", ".s.s.s.uuuu.."]),
    ("nailbiter", "NAIL BITER", 6, (6, 12), 22, 4, False, ["..ooooooo.", ".ooooooooy", "ooowowowok", "oo.......w", "ooowowowo.", ".oooooooo.", "..o...o..."]),
    ("hullcreeper", "HULL CREEPER", 6, (8, 14), 8, 4, False, ["u.u.u.u.u.u", "uuuuuuuuuuu", "uUnUnUnUuyk", "uuuuuuuuuuu", "u.u.u.u.u.u"]),
    ("captainsbeard", "CAPTAIN'S BEARD", 6, (3, 6), 10, 5, False, ["..sssss..", ".skssksss", "..sssss..", ".s.s.s.s.", "s.s.s.s.s", ".s.s.s.s.", "..s...s.."]),
    ("cannonslug", "CANNON SLUG", 6, (12, 20), 8, 4, False, ["........kk", "..oooooook", ".ooooooook", "oooooooo..", "nnnnnnnnyk", "nnnnnnnnnn"]),
    ("galleyrat", "GALLEY RAT", 6, (2, 5), 20, 6, False, [".......bb.", "p.bbbbbbbb", ".pbbbbbbyk", "..bbbbbbbp", "..b.b..b.b"]),
    ("figurehead", "THE FIGUREHEAD", 6, (120, 170), 8, 0, True, [".....uuuu.....", "....uuuuuu....", "...uusksksu...", "...ussssssu...", "...usrrrrsu...", "....ussssu....",
                                                                "..uuuuuuuuuu..", ".uuuUuuuuUuuu.", "uuuuuuuuuuuuuu", "...u......u..."]),
    ("firstmate", "THE FIRST MATE", 6, (100, 150), 12, 0, True, ["....kkkkkk....", "...kkkkkkkk...", "....ssssss....", "...sksssksx...", "...ssssssss...", "...ssrrrrss...",
                                                                "....ssssss....", "..bbbbbbbbbb..", ".bbbbbbbbbbbb.", "..b..b..b..b..", "..s..s..s..s.."]),
    # ---- 8. The Murk: shadows with nothing casting them
    ("shadowshark", "SHADOW SHARK", 7, (16, 26), 26, 4, False, ["........H.........", ".......HH.........", "H....HHHHHHHHHH...", "HH.HHHHHHHHHHHHyH.", "HHHHHHHHHHHHHHwkwk",
                                                               "HH.HHHHHHHHHHHHHH.", "H.....HH....HH...."]),
    ("murkmouth", "MURK MOUTH", 7, (10, 18), 12, 4, False, ["..HHHHHHH..", ".HyHHHHHyH.", "HwkwkwkwkwH", "H.........H", "HwkwkwkwkwH", ".HHHHHHHHH."]),
    ("halffish", "HALF FISH", 7, (3, 6), 16, 5, False, ["s.s.hhhh.", ".sssshhyk", "s.s.hhhh."]),
    ("dimbulb", "DIM BULB", 7, (2, 5), 10, 6, False, ["...y...", "..yty..", "...k...", "..hhh..", ".hhhhhy", "hhhhhk.", ".h.h..."]),
    ("smudge", "SMUDGE", 7, (1, 4), 8, 6, False, [".hhh.h.", "hhHhhhh", "hHHhyhh", ".hhhh.h"]),
    ("whisperray", "WHISPER RAY", 7, (8, 16), 14, 4, False, ["h.........h", "hh.......hh", "hhhhhhhhhhh", ".hhhykyhhh.", "...hhhhh...", ".....h.....", "......h...."]),
    ("notafish", "NOT-A-FISH", 7, (4, 9), 12, 4, False, ["..hhhhh...", ".hhhhhhhyk", "hhhhhhhhhw", ".hhhhhhhh.", ".p.p..p.p.", "p..p..p..p"]),
    ("gloomer", "GLOOMER", 7, (6, 12), 8, 5, False, ["...hhhhh..", ".hhhhhhhh.", "hhhhhhhhyh", "hhhhhhhhhh", ".hhkkkkhh.", "...hhhh..."]),
    ("silhouette", "SILHOUETTE", 7, (5, 10), 14, 5, False, ["..HHH..", "..HyH..", "..HHH..", "HHHHHHH", "..HHH..", "..HHH..", ".H...H.", "H.....H"]),
    ("skinsquid", "SKIN SQUID", 7, (6, 12), 16, 4, False, ["..pppp......", ".pppppppp...", "ppkpppppppp.", "pppppppppppp", ".ppppppp.p.p", "..pppp.p.p.p"]),
    ("fadefish", "FADE FISH", 7, (2, 5), 18, 6, False, ["..h.hh..", "h.hhhhh.", "hhhHhhyk", "h.hhhhh.", "..h.hh.."]),
    ("othershadow", "THE OTHER SHADOW", 7, (110, 160), 18, 0, True, ["...........HHH...", "H........HHHHHH..", "HH...HHHHHHHHHHH.", "HHHHHHHHHHHHHHyyH", "HHHHHHHHHHHHHHHHH",
                                                                    "HH...HHHHHHHHHHH.", "H........HHHHHH..", "...........HHH..."]),
    ("grin", "THE GRIN", 7, (80, 130), 10, 0, True, ["....yy.....yy....", ".................", "w...............w", "ww.............ww", ".wwkwkwkwkwkwkww.", "..wkwkwkwkwkwkw..",
                                                    "....wwwwwwwww...."]),
    ("misternobody", "MISTER NOBODY", 7, (100, 150), 6, 0, True, [".....kkkkk.....", ".....kkkkk.....", "...kkkkkkkkk...", ".....HHHHH.....", ".....HHHHH.....", "....HHHHHHH....",
                                                                 "...HHHHHHHHH...", "...H.HHHHH.H...", ".....HH.HH.....", ".....HH.HH.....", "....HHH.HHH...."]),
    # ---- 9. The Tangle: veins and hair instead of kelp
    ("tangleworm", "TANGLE WORM", 8, (3, 7), 16, 5, False, [".r.r..r.r..", "r.r.rr.r.r.", ".rrrrrrrryk", "r.r.rr.r.r.", ".r.r..r.r.."]),
    ("hairweed", "HAIR WEED", 8, (2, 5), 4, 5, False, ["b.b.b.b", "b.b.b.b", ".b.b.b.", ".b.b.b.", "b.bkb.b", ".bbbbb.", "..bbb.."]),
    ("veineel", "VEIN EEL", 8, (8, 15), 24, 4, False, [".vvvvvvvvvvvvvvvvv..", "vrvvrvvrvvrvvrvvvvyk", ".vvvvvvvvvvvvvvvvvv."]),
    ("knotfish", "KNOT FISH", 8, (4, 9), 10, 5, False, ["...rrr....", "m.r.r.r...", "mmrrrrrryk", "m.r.r.r...", "...rrr...."]),
    ("clotcrab", "CLOT CRAB", 8, (5, 10), 12, 5, False, ["d.d....d.d", ".dd....dd.", "..dddddd..", ".ddykdykd.", "dddddddddd", ".d.r..r.d.", "...r..r..."]),
    ("snarlsnapper", "SNARL SNAPPER", 8, (8, 15), 22, 4, False, ["..vvvvvvvv..", ".vvvvvvvvvy.", "vvvvvvvvwkwk", "vvvvvvvv....", "vvvvvvvvwkwk", ".vvvvvvvvvv.", "..b.b.b.b..."]),
    ("pulsepod", "PULSE POD", 8, (2, 6), 6, 6, False, ["..rrr..", ".rmmmr.", "rmmymmr", "rmmmmmr", ".rmmmr.", "..rrr..", "...r...", "...r..."]),
    ("nervenetter", "NERVE NETTER", 8, (4, 8), 14, 5, False, ["w.w.w.w.w", ".w.w.w.w.", "w.wwwww.w", ".wwykwww.", "w.wwwww.w", ".w.w.w.w."]),
    ("capillarycarp", "CAPILLARY CARP", 8, (6, 12), 14, 5, False, ["...rrrrr...", "m.rvrrrvrr.", "mmrrvrvrryk", "m.rvrrrvrr.", "...rrrrr..."]),
    ("mattedmullet", "MATTED MULLET", 8, (5, 10), 12, 5, False, ["..bbbbb....", ".bbbbbbsss.", "bbbbbsssssy", ".bbbssssssk", "...sssssss.", "....s..s..."]),
    ("stringsquid", "STRING SQUID", 8, (3, 7), 18, 5, False, ["..rrr.........", ".rrrrr........", "rrykrrr.r.r.r.", ".rrrrrrrrrrrrr", "..rrr..r.r.r.r"]),
    ("loosethread", "LOOSE THREAD", 8, (1, 2), 20, 6, False, ["r........", ".r.....r.", "..rrrrr.r", ".......ry"]),
    ("heartpod", "HEART POD", 8, (6, 11), 6, 4, False, [".rr...rr.", "rrrr.rrrr", "rrrrrrrrr", "rrykrrykr", ".rrrrrrr.", "..rrrrr..", "...rrr...", "....r...."]),
    ("heartbeat", "THE HEARTBEAT", 8, (110, 170), 10, 0, True, ["..vv.....vv....", ".vrrrv.vrrrv...", "vrrrrrvrrrrrv..", "vrrrrrrrrrrrv..", "vrrrykrrrykrv..", ".vrrrrrrrrrv...",
                                                               "..vrrrrrrrv.r.r", "...vrrrrrv.r.r.", "....vrrrv..r.r.", ".....vrv.......", "......v........"]),
    ("bigknot", "THE BIG KNOT", 8, (140, 200), 6, 0, True, ["....rrrrrr........", "..rr......rr......", ".r..rrrrr...r.....", "r..r.....r...rrrry", "r..r..yk.r..rrrrrk", "r...rrrrr...r.....",
                                                           ".r.........r......", "..rr.....rr.......", "....rrrrr........."]),
    # ---- 10. Mirror Shallows: almost normal fish, which is worse
    ("insideoutminnow", "INSIDE-OUT MINNOW", 9, (1, 3), 22, 6, False, ["..rrrr..", "p.rmrmr.", "pprrrryk", "p.mrmrr.", "..rrrr.."]),
    ("grinningsunfish", "GRINNING SUNFISH", 9, (3, 7), 12, 5, False, ["...tttt...", "..tttttt..", "t.ttttyt..", "tttwkwkwt.", "t.ttttttt.", "..tttttt..", "...tttt..."]),
    ("backwardbass", "BACKWARD BASS", 9, (4, 9), 14, 5, False, ["...gggg...g", ".gggggggggg", "kyggggggg.g", ".gggggggggg", "...gggg...g"]),
    ("wrongtrout", "WRONG TROUT", 9, (3, 8), 16, 5, False, ["...pppp...", "p.ptptpp..", "pppppppyk.", "p.ptptppw.", "...pppp..."]),
    ("upsideguppy", "UPSIDE GUPPY", 9, (1, 2), 20, 6, False, ["..ccc....", ".cccccc.l", "kycccccll", "..ccc...l", "...l.l..."]),
    ("smilesmelt", "SMILE SMELT", 9, (1, 3), 18, 6, False, [".cccccc..", "ccccccyk.", "cccckwkw.", ".cccccc.."]),
    ("toothytang", "TOOTHY TANG", 9, (3, 7), 22, 4, False, ["..lllll...", ".llllllly.", "lllllwkwkw", "lllll.....", "lllllwkwkw", ".llllllll.", "..lllll..."]),
    ("twinperch", "TWIN PERCH", 9, (2, 5), 14, 5, False, ["...ggggyk", "m.ggggggg", "mmgggg...", "m.ggggggg", "...ggggyk"]),
    ("flippedflounder", "FLIPPED FLOUNDER", 9, (5, 10), 10, 5, False, [".pppppppp..", "ppppppppppp", "ppmpmpmpppp", ".ppppppyk.."]),
    ("mimicminnow", "MIMIC MINNOW", 9, (1, 3), 20, 4, False, ["..cccc..", "c.ccccc.", "ccccccyk", "c.cccwkw", "..cccc.."]),
    ("echoeel", "ECHO EEL", 9, (4, 8), 24, 4, False, ["c.c.cccccccccc.", ".c.ccccccccccyk", "c.c.cccccccccc."]),
    ("copycarp", "COPY CARP", 9, (6, 11), 12, 4, False, ["....tttt...", "t..tktktk..", "tttttttttyk", "t..tttttt..", "....tttt..."]),
    ("gapinggoby", "GAPING GOBY", 9, (2, 4), 14, 5, False, ["..ssss..", ".ssssssy", "sssss..k", "ssss....", "sssss..k", ".sssssss"]),
    ("reflection", "THE REFLECTION", 9, (90, 140), 14, 0, True, ["..cc.......cc..", ".ccccc...ccccc.", "cyccccccccccccy", "ckccccccccccckc", "ccccccccccccccc", ".ccccc...ccccc.",
                                                                "..cc.......cc.."]),
    ("counterfeitkoi", "THE COUNTERFEIT KOI", 9, (100, 150), 12, 0, True, ["....wwwww......", "..wwrrwwwrww...", "w.wwwwrrwwwwyk.", "wwwwrrwwwrrwwww", "w.wwwwwwrrwwww.",
                                                                          "..wwkrwkwwkw...", "....wwwww......"]),
    ("doppelganger", "THE DOPPELGANGER", 9, (120, 170), 10, 0, True, ["......o........", "......o........", "....ooo........", "..pppppppp.....", ".pppppppppp....", "ppppppppppppyk.",
                                                                     "pppkpkpkpkppwkw", ".pppppppppp....", "..pppppppp.....", "...m.....m....."]),
]
CREATURES += [c[:7] + (_pad(c[7]),) for c in _MORE]
# Hunters swim at the hook instead of past it once they see it. Getting grabbed ends an endgame run.
HUNTERS = ["gnasher", "spinesnake", "boilleech", "glassspider", "drownedangler", "choker", "barnaclehand", "nailbiter", "shadowshark", "murkmouth",
           "tangleworm", "snarlsnapper", "toothytang", "mimicminnow"]


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
