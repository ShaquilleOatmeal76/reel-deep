"""Nov 18, 2026 update: sharks, the Angler's Hook, the NO PULSES lock, new titles, tavern sets, economy numbers.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_nov18.py
Writes to the live database are blocked."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nov18"); os.makedirs(OUT, exist_ok=True)
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


DIVE = """(lure => { const R = REEL; R.newDive(); R.S.lure = lure; R.cast(); R.S.overlay = null; R.S.sink = 0;
  R.S.hy = 300 * 6; R.S.cam = R.S.hy - 78; R.S.hx = 100; R.S.immune = 0; R.S.chunks = {}; for (let i = 0; i < 200; i++) R.S.chunks[i] = []; })"""
SHARK = """((id, front, v) => { const R = REEL, S = R.S; const k = Math.floor(S.hy / 72);   // a shark under the hook, its head or tail on it
  const f = { id, x: 0, y: S.hy, v, ph: 0, lb: 15, tr: false }; S.chunks[k].push(f);
  const r = R.fishRect(f), half = r[2] / 4, head = v >= 0 ? r[0] + r[2] - half : r[0] + half, tail = v >= 0 ? r[0] + half : r[0] + r[2] - half;
  f.x += S.hx - (front ? head : tail); return f; })"""


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        # ---- economy
        r = await ev("(() => { const R = REEL; return { cap: Math.max(...R.CATS.slice(0, -1).flatMap(c => c[2].map(x => x[1]))), stake: R.TAVs, maxStake: typeof MAX_STAKE } })()")
        check("prices capped at 5,000", r["cap"] == 5000, r)
        check("max stake is 75", await ev("MAX_STAKE") == 75)
        check("coin shop sells 14 hooks", await ev("REEL.CATS.find(c => c[1] === 'hook')[2].length") == 14)
        check("scratch card has all 6 squares", await ev("SCRATCH.filter(s => DATA.atlas[s[0]]).length") == 6)
        check("renames", await ev("SPEC.poop[1] === 'BROWN TROUT' && titleName('baiter') === 'BAIT MASTER' && titleName('mythic') === 'HOLY CRAP'"))
        check("angler's hook in the sinker slot", await ev("LURES[1][0] === 'angler' && LURES[1][5] === 2 && LURES[1][3] === 1"))
        await page.screenshot(path=OUT + "/title_wide.png")

        # ---- sharks: head-on with a fish steals it
        await ev(DIVE + "(0)")
        await ev("(() => { REEL.S.catch = [['tuna', 10, false, 300]]; })()")
        await ev(SHARK + "('blacktip', true, 20)")
        await ev("REEL.simTick(0.016)")
        r = await ev("(() => ({ n: REEL.S.catch.length, st: REEL.S.state, bit: REEL.store.ach.bit }))()")
        check("head-on shark steals the last fish", r["n"] == 0 and r["st"] == "down" and r["bit"] == 1, r)
        await page.screenshot(path=OUT + "/shark_chomp.png")
        # head-on with an empty hook ends the run
        await ev(DIVE + "(0)")
        await ev(SHARK + "('mako', true, -20)")
        await ev("REEL.simTick(0.016)")
        r = await ev("(() => ({ st: REEL.S.state, msg: REEL.S.msg }))()")
        check("head-on shark with empty hook ends the run", r["st"] == "turn" and r["msg"] == "CHOMP!", r)
        # from behind: caught
        await ev(DIVE + "(0)")
        await ev(SHARK + "('hammer', false, 20)")
        await ev("REEL.simTick(0.016)")
        r = await ev("(() => ({ n: REEL.S.catch.length, id: REEL.S.catch[0] && REEL.S.catch[0][0], sharks: REEL.store.ach.sharks }))()")
        check("shark from behind is caught", r["n"] == 1 and r["id"] == "hammer" and r["sharks"] == 1, r)
        # facing left, from behind
        await ev(DIVE + "(0)")
        await ev(SHARK + "('goblin', false, -14)")
        await ev("REEL.simTick(0.016)")
        check("left-facing shark from behind is caught", await ev("REEL.S.catch.length") == 1)

        # ---- the Angler's Hook
        await ev(DIVE + "(1)")
        await ev("(() => { const S = REEL.S; S.catch = [['tuna', 10, false, 300], ['koi', 60, false, 300]]; const k = Math.floor(S.hy / 72); S.chunks[k].push({ id: 'bass', x: S.hx - 6, y: S.hy, v: 0, ph: 0, lb: 3, tr: false }); })()")
        await ev("REEL.simTick(0.016)")
        r = await ev("(() => ({ n: REEL.S.catch.length, st: REEL.S.state }))()")
        check("hook fills", r["n"] == 3 and r["st"] == "turn", r)
        await ev("REEL.simTick(0.8)"); await ev("REEL.simTick(0.1)")
        check("reeling up after full", await ev("REEL.S.state") == "up")
        await ev("REEL.pulse()")
        r = await ev("(() => ({ n: REEL.S.catch.length, st: REEL.S.state, left: REEL.S.pulses, ids: REEL.S.catch.map(c => c[0]), pulsed: REEL.S.pulsed }))()")
        check("release lets the last fish go and the line goes back down", r["n"] == 2 and r["st"] == "down" and r["left"] == 1 and "bass" not in r["ids"] and r["pulsed"], r)
        await page.screenshot(path=OUT + "/angler_release.png")
        await ev("REEL.pulse()"); await ev("REEL.pulse()")
        r = await ev("(() => ({ n: REEL.S.catch.length, left: REEL.S.pulses }))()")
        check("only two releases", r["n"] == 1 and r["left"] == 0, r)
        # angler wakes the Sleeper with an empty hook
        await ev(DIVE + "(1)")
        await ev("(() => { const S = REEL.S; S.hy = (C.MAX_M - 10) * 6; S.cam = S.hy - 78; S.hx = 46 + OX; S.eye = 1; })()")
        await ev("REEL.pulse()")
        check("angler's release wakes the Sleeper", await ev("REEL.S.state") == "boss")
        await ev("(() => { REEL.BOSS = null; })()")

        # ---- NO PULSES lock
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; REEL.tav().bet = { k: 'nopulse', stake: 10, pays: 2, line: 100, cast: false }; })()")
        r = await ev("(() => ({ ok1: lureOK(1), ok0: lureOK(0) }))()")
        check("NO PULSES bet greys out the Angler's Hook", not r["ok1"] and r["ok0"], r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/lure_greyed.png")
        await ev("(() => { REEL.S.lure = 1; REEL.cast(); })()")
        check("casting with a greyed lure falls back to standard", await ev("REEL.S.lure") == 0)
        await ev("(() => { REEL.tav().bet = null; REEL.newDive(); REEL.S.overlay = null; REEL.S.lure = 1; REEL.tav().chips = 500; REEL.openBet(); })()")
        await ev("(() => { const b = REEL.TAV.bet; const opts = BETS.map(x => [x[0], x[1], 2, x[2]]); b.opts = opts.filter(o => o[0] === 'nopulse').concat(opts.slice(0, 4)); b.sel = 0; })()")
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/bet_greyed_wide.png")
        await ev("REEL.placeBet()")
        check("can't place NO PULSES with the Angler's Hook", await ev("REEL.tav().bet") is None)
        await ev("(() => { REEL.S.overlay = null; })()")

        # ---- titles
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; REEL.S.catch = [['tuna', 50, true, 100], ['koi', 300, true, 20], ['bass', 40, true, 50]]; REEL.beginHaul(); })()")
        check("HAT TRICK", await ev("REEL.store.titles.includes('hattrick')"))
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; REEL.S.catch = [['trueking', 680, false, 900], ['megalodon', 560, true, 900]]; REEL.beginHaul(); })()")
        check("HEAVYWEIGHT", await ev("REEL.store.titles.includes('heavy')"))
        await ev("(() => { REEL.store.ach.rel = 49; REEL.newDive(); REEL.S.overlay = null; REEL.S.lure = 1; REEL.cast(); REEL.S.overlay = null; REEL.S.catch = [['tuna', 5, false, 9]]; REEL.S.hy = 600; REEL.pulse(); REEL.S.catch = [['tuna', 5, false, 9]]; REEL.beginHaul(); })()")
        check("CATCH AND RELEASE", await ev("REEL.store.titles.includes('release')"))
        r = await ev("TITLES.slice(-15).map(t => t[1].length <= 24 && t[2].length <= 23).every(Boolean)")
        check("new title text fits", r)

        # ---- tavern shop: buy the Chip Hook and wear it
        await ev("(() => { REEL.tav().chips = 99999; REEL.store.dives = 30; })()")
        r = await ev("(() => { const i = REEL.SHOP_ROWS.findIndex(x => x[0] === 'chiphook'); REEL.shopBuy(i); return REEL.store.own.hook.includes(14); })()")
        check("Chip Hook bought with chips", r)
        await ev("(() => { REEL.tavOpen && REEL.tavOpen(); S.overlay = 'chipshop'; TAV.shopSel = REEL.SHOP_ROWS.findIndex(x => x[0] === 'jpline'); })()")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/chipshop_wide.png")
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # ---- phone width
        b, page, errs = await fresh(p, 390, 700)
        await page.screenshot(path=OUT + "/title_phone.png")
        await page.evaluate("(() => { REEL.tav().chips = 99999; REEL.store.dives = 30; S.overlay = 'chipshop'; TAV.shopSel = REEL.SHOP_ROWS.findIndex(x => x[0] === 'jpline'); })()")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/chipshop_phone.png")
        await page.evaluate(DIVE + "(0)")
        await page.evaluate(SHARK + "('leopard', false, 16)")
        await page.evaluate("(() => { REEL.S.immune = 5; })()")
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shark_phone.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("FAILED: " + ", ".join(fails) if fails else "ALL PASSED")
    sys.exit(1 if fails else 0)

asyncio.run(main())
