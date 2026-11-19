"""Every script shares one global scope, so two files defining the same function name means the later file silently
replaces the earlier one. That froze the Sleeper fight (Nov 19, 2026): island.js's cave-boss drawBoss replaced game.js's.
This checks for duplicate top-level function names, then plays the first seconds of the Sleeper fight and checks it draws.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_names.py"""
import asyncio, collections, os, re, sys
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
fails = []
def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)

files = [l.split('"')[1] for l in open(os.path.join(ROOT, "index.html")) if "<script src=" in l]
seen = collections.defaultdict(list)
for f in files:
    for i, line in enumerate(open(os.path.join(ROOT, f)), 1):
        m = re.match(r"^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", line)
        if m: seen[m.group(1)].append(f"{f}:{i}")
dups = {k: v for k, v in seen.items() if len(v) > 1}
check(f"no top-level function defined twice across {len(files)} scripts", not dups, dups)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(1440, 810), (390, 700)]:
            pg = await b.new_page(viewport={"width": w, "height": h}); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
            await pg.route("**firebaseio**", lambda r: r.abort())
            await pg.add_init_script("localStorage.setItem('reeldeep', JSON.stringify({dives: 300, seenHelp: true}))")
            await pg.goto("http://127.0.0.1:8765/index.html"); await pg.wait_for_function("window.REEL && window.REEL.S")
            r = await pg.evaluate("""(() => { const S = REEL.S; REEL.cast(); S.overlay = null; S.state = 'down'; S.catch = []; S.eye = 1; S.pulses = Math.max(1, S.pulses);
              S.hy = (1160 - 8) * 6; S.hx = 46 + Math.floor((REEL.width - 120) / 2); S.immune = 99; REEL.pulse(); return S.state; })()""")
            await pg.wait_for_timeout(3500)
            mode = await pg.evaluate("REEL.BOSS && REEL.BOSS.mode")
            check(f"{w}: pulse at the eye starts the fight, it draws with no errors", r == "boss" and mode == "fight" and not errs, (r, mode, errs[:2]))
            await pg.screenshot(path="/tmp/sleeper_%d.png" % w); await pg.close()
        await b.close()
    print("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
