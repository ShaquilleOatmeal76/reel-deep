"""Turns dive-bot runs (bet_bot_run.py) into the dive bets' starting odds (Nov 20, 2026).
  python3 tools/tests/bet_prices.py DATA_DIR       prints BETS priors, WANTED_P and PAIR_LIFT, and the payback checks
DATA_DIR holds gen*.json (ordinary dives), h_<family>.json (a bot hunting that family) and w_<fishId>.json (hunting one fish).
Bets a player can go after on purpose (families, WANTED) start halfway between an ordinary dive and a hunting one; each
player's own record on the bets they take then moves the price (`btake`, `wrec` in game.js)."""
import glob, itertools, json, os, random, re, subprocess, sys

D = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open(os.path.join(ROOT, "game.js")).read()
ROWS = re.findall(r'^  \["(\w+)", "[^"]*", "[^"]*", ([\d.]+), ', src[src.index("const BETS = ["):src.index("const BET_I")], re.M)
IDS = [r[0] for r in ROWS]
CODE = {k: float(p) for k, p in ROWS}
NEW = set(IDS[IDS.index("nopulse") + 1:])                      # the Nov 20, 2026 bets; older bets keep their tuned odds
MASK = re.search(r'const MASK_CH = "([^"]+)"', src).group(1)
JV = set(re.findall(r'"(\w+)"', re.search(r"const JUNK_VOID = new Set\(\[([^\]]*)\]", src).group(1)))
EDGE = 0.95
SHRINK = float(os.environ.get("SHRINK", 2)); LIFT_MIN = float(os.environ.get("LIFT_MIN", 0.12))
PEDGE = float(os.environ.get("PEDGE", 1.09))                # extra parlay margin, tuned so parlays pay back ~95% on the hold-out
HUNT_W = float(os.environ.get("HUNT_W", 0.55))               # a bot hunting a family is better at it than people: start a bit past halfway
SKIP = {"newsp", "newtr", "top10", "beat1", "wanted"}       # retired, needs the live board, or priced on its own
HUNT = {"fshark": "shark", "sharkweek": "shark", "fink": "ink", "calamari": "ink", "feel": "eel", "fshell": "shell", "fray": "ray",
        "fglow": "glow", "surfturf": "surf", "sushi": "sushi", "boil": "boil"}


def load(pat):
    rows = []
    for f in sorted(glob.glob(os.path.join(D, pat))): rows += json.load(open(f))
    return rows


def outcome(r, k):                                           # True / False / None (can't tell, or a thrown dive voids it)
    w, sk = r["mask"].split("|", 1)
    c = MASK[IDS.index(k)]
    if c in sk or (r["junk"] and k in JV): return None
    return c in w


def rate(rows, k):
    o = [x for x in (outcome(r, k) for r in rows) if x is not None]
    return (sum(o) / len(o), len(o)) if o else (None, 0)


gen = load("gen*.json"); hold = load("hold.json")
print(len(gen), "ordinary dives")
prior = {}
for k in IDS:
    if k in SKIP: continue
    p, n = rate(gen, k)
    if k not in NEW: prior[k] = CODE[k]; continue
    if p is None: print("  no data for", k); continue
    if k in HUNT:
        hp, hn = rate(load("h_%s.json" % HUNT[k]), k)
        print("  %-10s ordinary %.3f  hunting %.3f" % (k, p, hp))
        p = p + HUNT_W * (hp - p)
    prior[k] = round(max(p, 0.005), 3)
# Long shots a person can plan for but the bot never does (it doesn't aim for a reef fish then the floor, or for the bounty
# twice): starting odds by hand, for someone trying. Players' own records on the bets they take move them from there.
OVERRIDE = {"postcard": 0.2, "bounty2": 0.15, "boil": 0.12, "neighbours": 0.12}
prior.update(OVERRIDE)

# WANTED: per fish, halfway between an ordinary dive and one hunting it
wanted = {}
for f in sorted(glob.glob(os.path.join(D, "w_*.json"))):
    fid = os.path.basename(f)[2:-5]
    if fid in ("boot", "anchor"): continue                     # junk
    rows = json.load(open(f)); real = [r for r in gen if not r["junk"]]
    cas = sum(fid in r["ids"] for r in real) / len(real)
    hun = sum(fid in r["ids"] for r in rows if not r["junk"]) / max(1, sum(not r["junk"] for r in rows))
    p = cas + HUNT_W * (hun - cas)
    if p >= 0.03: wanted[fid] = round(p, 3)

# PAIR_LIFT: how much more (or less) often two bets win together than chance says, shrunk toward 1
keys = [k for k in IDS if k not in SKIP]
ZK = ["Z%d" % z for z in range(11)]


def zo(r, z): return None if (r["junk"]) else (int(z[1:]) in r["zones"])


def outk(r, k): return zo(r, k) if k[0] == "Z" else outcome(r, k)


lift = {}
RARE = {"balanced+fish100", "balanced+fish200", "balanced+legend", "lgtr+under", "tight+tour"}   # checked by hand Nov 20, 2026
cols = {k: [outk(r, k) for r in gen] for k in keys + ZK}
for a, b in itertools.combinations(keys + ZK, 2):
    if a[0] == "Z" and b[0] == "Z": continue
    both = [(x, y) for x, y in zip(cols[a], cols[b]) if x is not None and y is not None]
    n = len(both)
    if n < 200: continue
    pa = sum(x for x, _ in both) / n; pb = sum(y for _, y in both) / n
    e = n * pa * pb; j = sum(x and y for x, y in both)
    if e < 1: continue
    L = (j + SHRINK) / (e + SHRINK)
    if j == 0 and e >= 25: L = 0                                # never once together where chance says 25+: can't both win
    if L == 0 and "+".join(sorted([a, b])) in RARE: L = 0.05      # possible, just very rare: priced past x100, not "can't win"
    if abs(L - 1) > LIFT_MIN: lift["+".join(sorted([a, b]))] = round(L, 2)

# payback checks: singles at their starting price, and random 2- and 3-bet parlays
pays = lambda p: min(25, max(1.1, (EDGE / p) // 1 if EDGE / p >= 10 else ((EDGE / p * 10) // 1) / 10))
ppays = lambda p: 0 if p <= 0 or EDGE / p > 100 else max(1.1, (EDGE / p) // 1 if EDGE / p >= 10 else ((EDGE / p * 10) // 1) / 10)   # past x100: can't be placed
tot = n = 0
print("\nnew singles on hold-out dives, at the starting price (pays back):")
for k in keys:
    p, m = rate(hold, k)
    if p is None or k not in NEW: continue
    back = p * pays(max(0.9 * prior[k], 0.01)); tot += back; n += 1
    if back > 1.0 or back < 0.85: print("  %-10s %.2f" % (k, back))
print("  average %.3f over %d bets" % (tot / n, n))
for k in sorted(NEW):
    if k in prior: print("  %-10s prior %.3f  ordinary %.3f  hold-out %.3f" % (k, prior[k], rate(gen, k)[0] or 0, rate(hold, k)[0] or 0))
for fam in ["shark", "eel", "surf"]:
    rows = load("h_%s.json" % fam)
    for k in [k for k, v in HUNT.items() if v == fam]:
        p, _ = rate(rows, k); print("  hunting %-9s pays back %.2f at the starting price (before your record moves it)" % (k, p * pays(prior[k])))
random.seed(1)
rates = {k: (rate(gen, k)[0] or 0) for k in keys}
for legs in (2, 3):
    paid = staked = 0
    for _ in range(3000):
        ks = random.sample([k for k in keys if k in prior], legs)
        pr = 1
        for k in ks: pr *= max(rates[k], 0.005)
        for a, b in itertools.combinations(ks, 2): pr *= lift.get("+".join(sorted([a, b])), 1)
        pr *= PEDGE
        x = ppays(pr)
        if not x: continue
        for r in hold:
            o = [outcome(r, k) for k in ks]
            if any(v is None for v in o): continue
            staked += 1; paid += x if all(o) else 0
    print("%d-bet parlays pay back %.3f on hold-out dives (priced from each bet's own rate x PAIR_LIFT)" % (legs, paid / staked))
json.dump({"prior": prior, "wanted": wanted, "lift": lift}, open(os.path.join(D, "prices.json"), "w"), indent=0)
print("\n%d priors, %d WANTED fish, %d pair lifts -> %s" % (len(prior), len(wanted), len(lift), os.path.join(D, "prices.json")))

if "--write" in sys.argv:                                   # paste the numbers into game.js
    path = os.path.join(ROOT, "game.js"); g = open(path).read()
    for k in NEW:
        if k not in prior: continue
        g = re.sub(r'(\n  \["%s", "[^"]*", "[^"]*", )[\d.]+,' % k, lambda m: m.group(1) + ("%g" % prior[k]) + ",", g, count=1)
    def block(name, d):
        items = ['"%s": %g' % (k, v) if not re.match(r"^\w+$", k) else '%s: %g' % (k, v) for k, v in sorted(d.items())]
        lines, cur = [], ""
        for it in items:
            if len(cur) + len(it) > 116: lines.append(cur.rstrip()); cur = ""
            cur += it + ", "
        lines.append(cur.rstrip().rstrip(","))
        return "const %s = {\n  %s\n};" % (name, "\n  ".join(lines))
    g = re.sub(r"const WANTED_P = \{[^;]*\};", lambda m: block("WANTED_P", wanted), g, count=1)
    g = re.sub(r"const PAIR_LIFT = \{[^;]*\};", lambda m: block("PAIR_LIFT", lift), g, count=1)
    open(path, "w").write(g)
    print("wrote", path)
