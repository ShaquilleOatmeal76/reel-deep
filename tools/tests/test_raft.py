"""Driftwood Isle, part 1: the raft (island.js). Planks, rope and sail at sea, the compass in the chip shop, the
shipwright's board, building the raft, and the island on the horizon. Old saves get the new fields.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_raft.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raft"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def fresh(p, w, h, save=None):
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    await ctx.route("**/*firebase*/**", lambda r: r.abort())
    if save: await ctx.add_init_script("localStorage.setItem('reeldeep', JSON.stringify(%s))" % save)
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
    await page.evaluate("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; })()")
    await page.wait_for_timeout(200)
    return b, page, errs

CAST = "(() => { const R = REEL; R.newDive(); R.cast(); R.S.overlay = null; return (R.S.rparts || []).map(d => d.k); })()"


async def main():
    async with async_playwright() as p:
        # an old save from before the island: no isle field
        b, page, errs = await fresh(p, 1440, 810, '{"coins": 50, "dives": 12, "log": {}}')
        ev = page.evaluate
        r = await ev("REEL.store.isle")
        check("old save gets isle defaults", r == {"planks": 0, "rope": 0, "sail": 0, "compass": 0, "built": 0, "met": 0}, r)
        check("old save keeps its coins", await ev("REEL.store.coins") == 50)
        kinds = []
        for _ in range(40): kinds += await ev(CAST)
        check("no raft parts before 50 dives", kinds == [], kinds)
        check("no shipwright tap before 50 dives", not await ev("raftTap(pierX() + 10, 85, 96)"))

        # after 50 dives: planks about 60% of dives, rope and sail sometimes
        await ev("REEL.store.dives = 50")
        kinds = []
        for _ in range(400): kinds += await ev(CAST)
        n = kinds.count("plank")
        check("planks drift by in about 60% of dives", 200 < n < 280, n)
        check("ropes and sails turn up", kinds.count("rope") > 50 and kinds.count("sail") > 40, (kinds.count("rope"), kinds.count("sail")))
        r = await ev("""(() => { const R = REEL; for (let i = 0; i < 50; i++) { R.newDive(); R.cast(); if (R.S.rparts.some(d => d.k === 'rope')) break; }
          const d = R.S.rparts.find(q => q.k === 'rope'), z = ZONES[1]; return d.y / M >= z[1] && d.y / M <= z[2]; })()""")
        check("rope is in the Kelp Forest", r)

        # touching a plank takes it without using a hook slot
        r = await ev("""(() => { const R = REEL; R.newDive(); R.cast(); const S = R.S; S.overlay = null;
          S.rparts = [{ k: 'plank', x: 100, y: 300 * M }]; S.hx = 107; S.hy = 300 * M; S.catch = [];
          raftHook(); return { planks: R.store.isle.planks, hook: S.catch.length, got: S.rparts[0].got }; })()""")
        check("plank collected, hook untouched", r == {"planks": 1, "hook": 0, "got": True}, r)
        r = await ev("""(() => { const R = REEL, S = R.S; S.rparts = [{ k: 'sail', x: 100, y: 500 * M }]; S.hx = 107; S.hy = 500 * M; raftHook(); return R.store.isle.sail; })()""")
        check("sail collected", r == 1)
        r = await ev("""(() => { const R = REEL; R.store.isle.planks = 60; R.newDive(); R.cast(); return R.S.rparts.filter(d => d.k === 'plank').length; })()""")
        check("no planks once there are 60", r == 0)

        # a dive with a plank drawn on screen
        await ev("""(() => { const R = REEL; R.store.isle.planks = 10; R.newDive(); R.cast(); const S = R.S; S.overlay = null; S.sink = 0;
          S.hy = 200 * M; S.cam = S.hy - 78; S.hx = 60; S.rparts = [{ k: 'plank', x: 150, y: 200 * M + 30 }, { k: 'rope', x: 200, y: 200 * M - 20 }]; })()""")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/dive_plank.png")

        # the compass in the chip shop
        r = await ev("""(() => { const R = REEL, i = SHOP_ROWS.findIndex(q => q[0] === 'compass'); R.tav().chips = 500; R.shopBuy(i); return [R.store.isle.compass, R.tav().chips, shopRowState(i)[1]]; })()""")
        check("compass bought for 300 chips", r == [1, 200, None], r)

        # the board: not ready until everything is in, then it builds
        await ev("(() => { REEL.newDive(); REEL.S.overlay = null; Object.assign(REEL.store.isle, { planks: 59, rope: 1, sail: 1, compass: 1 }); })()")
        check("tapping the shipwright opens the board", await ev("(() => { const wl = Math.round(-REEL.S.cam); return raftTap(pierX() + 10, wl - 10, wl) && REEL.S.overlay === 'raft' && REEL.store.isle.met === 1; })()"))
        await ev("raftTapOv(raftHits()[0][1] + 5, raftHits()[0][2] + 5)")
        check("can't build with 59 planks", await ev("REEL.S.overlay") == "raft")
        await ev("REEL.store.isle.planks = 60"); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + "/board_ready.png")
        await ev("raftTapOv(raftHits()[0][1] + 5, raftHits()[0][2] + 5)")
        check("build starts the scene", await ev("REEL.S.overlay") == "raftbuild")
        await page.wait_for_timeout(1500); await page.screenshot(path=OUT + "/build_mid.png")
        await ev("raftBuildTap()")
        check("scene can't be skipped before it ends", await ev("REEL.store.isle.built") == 0)
        await page.wait_for_timeout(3200); await page.screenshot(path=OUT + "/build_end.png")
        await ev("raftBuildTap()")
        r = await ev("({ built: REEL.store.isle.built, title: REEL.store.titles.includes('castaway'), ov: REEL.S.overlay })")
        check("raft built, CASTAWAY title", r == {"built": 1, "title": True, "ov": None}, r)
        kinds = []
        for _ in range(30): kinds += await ev(CAST)
        check("no more parts once built", kinds == [], kinds)
        saved = await ev("JSON.parse(localStorage.getItem('reeldeep')).isle.built")
        check("built is saved", saved == 1)
        await ev("REEL.newDive(); REEL.S.overlay = null"); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/title_built.png")
        r = await ev("(() => { const wl = Math.round(-REEL.S.cam); return raftTap(isleX(), wl - 5, wl); })()")
        check("tapping the island sails (or says soon)", r)
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # phone width
        b, page, errs = await fresh(p, 390, 700)
        await page.evaluate("(() => { REEL.store.dives = 60; REEL.store.isle.planks = 30; REEL.S.overlay = 'raft'; })()")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/board_phone.png")
        await page.evaluate("(() => { REEL.S.overlay = null; })()"); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT + "/title_phone.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
