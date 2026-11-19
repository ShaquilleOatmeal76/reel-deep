"""Nov 19, 2026: knocking on the crack is free, the crack calls the light from the Bone Yard, the deepest-depth readout,
and bet texts that say their depths. Run from the repo root:  python3 -m http.server 8765 &  then
python3 tools/tests/test_crack.py   Writes to the live database are blocked."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crack"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def fresh(p, w, h):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    await ctx.route("**/*firebase*/**", lambda r: r.abort())
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
    await page.evaluate("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; })()")
    await page.wait_for_timeout(300)
    return b, page, errs


# a dive on lure `lure` with the hook at depth m, an empty ocean, the Sleeper beaten but the game not
DIVE = """((lure, m) => { const R = REEL; R.store.sec.sleeper = true; R.store.sec.beat = false; R.newDive(); R.S.lure = lure; R.cast();
  R.S.overlay = null; R.S.hy = m * 6; R.S.reached = m; R.S.cam = R.S.hy - 78; R.S.hx = 100; R.S.immune = 0; R.S.chunks = {};
  for (let i = 0; i < 200; i++) R.S.chunks[i] = []; })"""
FISH = """((id, dy) => { const S = REEL.S, k = Math.floor((S.hy + (dy || 0)) / 72); const f = { id, x: 0, y: S.hy + (dy || 0), v: 0, ph: 0, lb: 12, tr: false };
  S.chunks[k].push(f); const r = REEL.fishRect(f); f.x += S.hx - (r[0] + r[2] / 2); return f; })"""


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        tick = "(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })"

        # ---- free knock: glow lure, pulse already spent, hook at the crack
        await ev(DIVE + "(2, 1150)")
        await ev("(() => { const S = REEL.S; S.pulses = 0; S.hx = OX + 108; })()")
        await ev("REEL.pulse()")
        r = await ev("(() => ({ st: REEL.S.state, f: !!REEL.FLIP }))()")
        check("glow lure with 0 pulses opens the crack", r["st"] == "flip", r)
        # wrong lure, 0 pulses: says it wants a light, nothing spent, still diving
        await ev(DIVE + "(0, 1150)")
        await ev("(() => { const S = REEL.S; S.pulses = 0; S.hx = OX + 108; })()")
        await ev("REEL.pulse()")
        check("standard lure still bounces off", await ev("REEL.S.state") == "down")
        # glow lure, pulse kept: it's still there after entering (free)
        await ev(DIVE + "(2, 1150)")
        await ev("(() => { REEL.S.hx = OX + 108; })()")
        await ev("REEL.pulse()")
        check("knock doesn't spend the pulse", await ev("REEL.S.state === 'flip'"))

        # ---- the crack calls: full hook below 830 m keeps sinking
        await ev(DIVE + "(2, 850)")
        await ev("(() => { REEL.S.catch = [['tuna', 10, false, 840], ['tuna', 10, false, 845]]; })()")
        await ev(FISH + "('magma')")
        await ev(tick + "(2)")
        r = await ev("(() => ({ st: REEL.S.state, n: REEL.S.catch.length }))()")
        check("full hook in the Bone Yard keeps sinking", r["st"] == "down" and r["n"] == 3, r)
        await ev(FISH + "('magma', 14)")
        await ev(tick + "(30)")
        r = await ev("(() => ({ st: REEL.S.state, n: REEL.S.catch.length }))()")
        check("extra fish bump off a full hook", r["st"] == "down" and r["n"] == 3, r)
        await page.screenshot(path=OUT + "/called_wide.png")
        # ...rides to the floor, rises slowly past the crack, can knock
        await ev("(() => { REEL.S.hy = 1150 * 6; REEL.S.reached = 1150; REEL.S.hx = OX + 108; })()")
        await ev(tick + "(120)")
        r = await ev("(() => ({ st: REEL.S.state, b: REEL.S.bottom, fr: REEL.S.freeRide, m: REEL.S.hy / 6 }))()")
        check("floor with a full hook rises slowly, no floor credit", r["st"] == "rise" and r["b"] is False and r["fr"] is True, r)
        await page.screenshot(path=OUT + "/rise_wide.png")
        await ev("REEL.pulse()")
        r = await ev("(() => ({ st: REEL.S.state, toFlip: !!REEL.S.toFlip }))()")
        check("knock on the way up banks the catch and crosses", r["toFlip"], r)
        # missing the crack: reels in fast once past it
        await ev(DIVE + "(2, 1157)")
        await ev("(() => { REEL.S.catch = [['tuna', 10, false, 900], ['tuna', 10, false, 900], ['tuna', 10, false, 900]]; REEL.S.hx = 30; })()")
        await ev(tick + "(240)")
        check("missed crack: reels in after passing it", await ev("REEL.S.state") == "up")

        # ---- not called: above the Bone Yard, a different lure, or after beating the game
        for lure, m, beat, name in [(2, 700, False, "above the Bone Yard"), (0, 850, False, "standard lure"), (2, 850, True, "after beating the game")]:
            await ev(DIVE + f"({lure}, {m})")
            if beat: await ev("REEL.store.sec.beat = true")
            await ev("(() => { REEL.S.catch = [['tuna', 10, false, 0], ['tuna', 10, false, 0]]; })()")
            await ev(FISH + "('cinder')")
            await ev(tick + "(2)")
            check("full hook turns back: " + name, await ev("REEL.S.state") == "turn")
        await ev("REEL.store.sec.beat = false")

        # ---- deepest readout
        await ev(DIVE + "(0, 900)")
        await ev("(() => { REEL.S.hy = 400 * 6; REEL.S.state = 'up'; REEL.S.cam = REEL.S.hy - 78; })()")
        await ev(tick + "(3)")
        await page.screenshot(path=OUT + "/deepest_wide.png")
        await ev("(() => { REEL.S.catch = [['tuna', 12, false, 600]]; REEL.beginHaul(); })()")
        check("haul remembers the depth", await ev("REEL.S.haul.deep") >= 899)
        await ev(tick + "(150)")
        await page.screenshot(path=OUT + "/haul_wide.png")

        # ---- bet texts fit and say depths
        r = await ev("REEL.BETS.filter(x => x[2].length > 19).map(x => x[0])")
        check("bet meanings fit 19 characters", not r, r)
        check("zone bets give depths", await ev("REEL.BETS.filter(x => /^z\\d$/.test(x[0])).every(x => / M/.test(x[2]))"))
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; REEL.openBet(); })()")
        await ev(tick + "(2)")
        await page.screenshot(path=OUT + "/bet_wide.png")
        check("no page errors (wide)", not errs, errs)
        await b.close()

        b, page, errs = await fresh(p, 390, 700)
        ev = page.evaluate
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; REEL.openBet(); })()")
        await ev(tick + "(2)")
        await page.screenshot(path=OUT + "/bet_phone.png")
        await ev("(() => { REEL.S.overlay = null; })()")
        await ev(DIVE + "(0, 900)")
        await ev("(() => { REEL.S.hy = 400 * 6; REEL.S.state = 'up'; REEL.S.cam = REEL.S.hy - 78; })()")
        await ev(tick + "(3)")
        await page.screenshot(path=OUT + "/deepest_phone.png")
        await ev("(() => { REEL.S.catch = [['tuna', 12, false, 600], ['lantern', 4, false, 300]]; REEL.S.reached = 1158; REEL.beginHaul(); })()")
        await ev(tick + "(150)")
        await page.screenshot(path=OUT + "/haul_phone.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("ALL PASS" if not fails else "FAILED: " + ", ".join(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
