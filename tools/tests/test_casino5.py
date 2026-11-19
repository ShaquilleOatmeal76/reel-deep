"""Chip economy part 5 (Nov 18, 2026): decorate the bar, buy a round.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino5.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino5/."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino5"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        posts = []
        async def route(r):
            if r.request.method == "POST": posts.append(r.request.url)
            await r.abort()
        await ctx.route("**/*firebase*/**", route)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.store.name = 'KDB'; })()")

        check("15 decor items, 2,000 to 40,000", await ev("CASINO.DECOR_LIST.length === 15 && Math.min(...CASINO.DECOR_LIST.map(d => d[3])) === 2000 && Math.max(...CASINO.DECOR_LIST.map(d => d[3])) === 40000"))
        r = await ev("""(() => { const q = REEL.tav(); delete q.decor; return [CASINO.decorData().own.length, typeof CASINO.decorData().eq]; })()""")
        check("an old save without decor works", r == [0, "object"], r)
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 50000; q.spent = 0; casinoOpen('decor');
            CASINO.CZ.dc.sel = CASINO.DECOR_LIST.findIndex(d => d[2] === 'SHARK TANK'); EXTRA_OV.decor.key('Space', 0);
            const d = CASINO.decorData(); return [q.chips, d.own.includes('tank.2'), d.eq.tank, q.spent]; })()""")
        check("buying the shark tank takes 35,000 and puts it up", r == [15000, True, 2, 35000], r)
        r = await ev("""(() => { EXTRA_OV.decor.key('Space', 0); return CASINO.decorData().eq.tank; })()""")
        check("pressing again takes it down", r == -1, r)

        # every item drawn in both bars and the shop preview without errors
        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(150)
            for k in range(3):
                await ev("""((k) => { const d = CASINO.decorData(); for (const sl of Object.keys(CASINO.DECOR)) { d.eq[sl] = k; d.own.push(sl + '.' + k); } REEL.S.overlay = 'tavern'; })(%d)""" % k)
                await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/bar_%s_%d.png" % (tag, k))
            await ev("(() => { casinoOpen('decor'); })()"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/decor_%s.png" % tag)

        # buy a round
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 5000; q.round = ''; q.rounds = 9; CASINO.buyRound(); const a = [q.chips, q.round === dayString(), REEL.store.titles.includes('onthehouse')]; CASINO.buyRound(); a.push(q.chips); return a; })()""")
        check("buy a round: 1,000 chips, once a day, ON THE HOUSE at 10", r == [4000, True, True, 4000], r)
        await page.wait_for_timeout(300)
        check("the round is posted to /casino/rounds/<today>", any("/casino/rounds/" in u for u in posts), posts[-3:])
        r = await ev("""(() => { REEL.S.overlay = null; CASINO.roundsToday(); window.CASINO_R = 1; return 0; })()""")
        r = await ev("""(() => { const R = CASINO.roundsToday(); R.push('ABC', 'XYZ'); REEL.S.overlay = null; casinoTick(0.01); REEL.S.overlay = 'tavern'; casinoTick(0.01); return REEL.TAVs.say; })()""")
        check("walking into the bar names who bought rounds today", "ABC" in r and "ROUND" in r, r)
        r = await ev("""(() => { const i = REEL.SHOP_ROWS.findIndex(x => x[0] === 'round'); return REEL.shopRowState(i); })()""")
        check("chip shop row says you got today's round", r[1] is None and "TODAY" in r[2], r)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
