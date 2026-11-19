"""Driftwood Isle, part 8a: Shipwreck Beach, Mangrove Marsh and Silas, the skiff and Gull Rock (island.js).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_areas.py
Writes to the live database are blocked."""
import asyncio, os, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_areas"); os.makedirs(OUT, exist_ok=True)
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
    await page.evaluate("""(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 80;
      Object.assign(REEL.store.isle, { planks: 60, rope: 1, sail: 1, compass: 1, built: 1 }); })()""")
    await page.wait_for_timeout(200)
    return b, page, errs

TICK = "(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })"
SEL = "(id => { const s = isleSave(); let i = s.inv.findIndex(q => q && q[0] === id); if (i < 0) { invAdd(id, 1); i = s.inv.findIndex(q => q && q[0] === id); } if (i > 8) { const t = s.inv[8]; s.inv[8] = s.inv[i]; s.inv[i] = t; i = 8; } s.sel = i; })"
MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
CLEAR = "(() => { ISLE.msg = null; ISLE.list = null; })()"


async def walk(page, key, n=40):
    await page.keyboard.down(key); await page.evaluate(TICK + "(%d)" % n); await page.keyboard.up(key)


async def main():
    async with async_playwright() as p:
        old = json.dumps({"isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 0, "day": 6, "min": 600, "sd": 5000, "intro": 1, "kit": 1, "fish0": 1, "p5": 1, "p7": 1, "inv": [["hoe", 1], ["can", 1], None, ["rod", 1], ["net", 1], ["axe", 1], ["pick", 1]] + [None] * 11, "sel": 0, "water": 30, "farm": {}, "bin": [], "log": {}, "pots": [], "folk": {}, "arrived": {"bram": 1, "pickles": 1}}}, "dives": 90, "seenHelp": True})
        b, page, errs = await fresh(p, 1440, 810, old)
        ev = page.evaluate
        await ev("startIsland()")
        check("old save: told about the cleared piles", "SHIPWRECK BEACH" in await ev(MSG))
        await ev(CLEAR); await ev("isleSave().min = 600")

        # west of the Woods: Shipwreck Beach
        await ev("isleGo('woods', 20, 420, 'left')"); await walk(page, "ArrowLeft", 20)
        r = await ev("[ISLE.map.id, ISLE.map.objs.some(o => o.k === 'pile')]")
        check("west of the Woods: Shipwreck Beach (pile gone)", r == ["wreck", False], r)
        await ev("(() => { ISLE.px = 720; ISLE.py = 360; })()"); await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/wreck.png")
        r = await ev("digSpots().length")
        check("six spots to dig each day", r == 6, r)
        await ev(SEL + "('hoe')")
        r = await ev("""(() => { const d = digSpots()[0]; ISLE.px = d[0]; ISLE.py = d[1] + 16 + 3; ISLE.dir = 'up'; ISLE.msg = null; window._d = d; return ISLE.inv; })()""")
        n0 = await ev("isleSave().inv.filter(Boolean).reduce((a, q) => a + q[1], 0)")
        await page.keyboard.press("KeyE")
        r = await ev("[_d[2], isleSave().inv.filter(Boolean).reduce((a, q) => a + q[1], 0)]")
        check("dig with the hoe: salvage", r[0] == 1 and r[1] > n0, [n0, r])
        r = await ev("""(() => { const R = Math.random, S = stormNow; stormNow = () => true; Math.random = () => 0.1; const d = [10, 10, 0]; digUp(d); Math.random = R; stormNow = S; return invCount('spyglass'); })()""")
        check("a storm out at sea brings rarer salvage", r == 1, r)
        r = await ev("[waterKind(700, 520), (() => { const R = Math.random; Math.random = () => 0.01; const s = Object.assign({}, isleSave(), { min: 1300 }); const sp = pickFish('sea', s); Math.random = R; return sp; })()]")
        check("the Captain lives off Shipwreck Beach", r[1] == "captain", r)
        await walk(page, "ArrowRight", 2)
        await ev("(() => { ISLE.msg = null; ISLE.px = 1435; ISLE.py = 200; })()"); await walk(page, "ArrowRight", 20)
        check("east off the beach back to the Woods", await ev("ISLE.map.id") == "woods")

        # east of the Lagoon: Mangrove Marsh, and Silas
        await ev("isleGo('lagoon', 1110, 600, 'right')"); await walk(page, "ArrowRight", 20)
        r = await ev("[ISLE.map.id, !!isleSave().flags.marsh, !!isleSave().arrived.silas, !!ISLE.folk.silas]")
        check("east of the Lagoon: the marsh; finding it finds Silas", r == ["marsh", True, True, True], r)
        r = await ev("[waterKind(300, 250), pickFish('marsh', Object.assign({}, isleSave(), { season: 1, min: 1300 })) !== null]")
        check("marsh fishing", r == ["marsh", True], r)
        await ev("(() => { ISLE.px = 700; ISLE.py = 300; isleSave().min = 700; folkInit(); })()"); await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/marsh.png")
        r = await ev("(() => { const st = ISLE.folk.silas, t = spotFor(FOLK.silas, 'hut'); return [st.area, Math.round(st.x), Math.round(st.y), folkPath([20, 400], [t[1], t[2]]) !== null]; })()")
        check("Silas is at his hut, and you can walk there", r[0] == "marsh" and r[3], r)
        await ev("(() => { const st = ISLE.folk.silas; ISLE.px = st.x; ISLE.py = st.y + 12; ISLE.dir = 'up'; st.wait = 30; ISLE.msg = null; })()")
        await page.keyboard.press("KeyE")
        check("talk to Silas", (await ev(MSG)).startswith("SILAS: '"))
        await ev(CLEAR)

        # the skiff: restore it, then sail to Gull Rock
        await ev("isleGo('port', 620, 740, 'down')")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'skiff'); isleAct(o); return " + MSG + "; })()")
        check("the skiff at the dock needs fixing", "SKIFF" in r and "SCRAP" in r, r)
        await ev("(() => { ISLE.msg = null; invAdd('wood', 150); invAdd('fiber', 40); invAdd('scrap', 20); const o = ISLE.map.objs.find(q => q.k === 'skiff'); isleAct(o); ISLE.msg.t = 9; ISLE.msg.i = ISLE.msg.pages.length - 1; ISLE.msg.sel = 0; isleMsgAdvance(); })()")
        check("restoring the skiff", await ev("isleSave().rest.dock") == "work")
        await ev("(() => { ISLE.msg = null; isleSleep(false); ISLE.msg = null; isleSave().min = 700; isleGo('port', 620, 740, 'down'); })()")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'skiff'); isleAct(o); return [ISLE.list && ISLE.list.kind, listRows().map(q => q.name)]; })()")
        check("the fixed skiff sails round the island", r[0] == "boat" and "GULL ROCK" in r[1] and len(r[1]) == 4, r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/boat.png")
        await ev("(() => { ISLE.list.sel = listRows().findIndex(q => q.name === 'GULL ROCK'); listPick(); })()")
        r = await ev("[ISLE.map.id, isleSolidAt(ISLE.px, ISLE.py)]")
        check("Gull Rock", r == ["gull", False], r)
        await ev("(() => { ISLE.px = 240; ISLE.py = 330; })()"); await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/gull.png")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.act && q.act.kind === 'secret'); isleAct(o); return [isleSave().flags.gullsecret, " + MSG + "]; })()")
        check("Gull Rock's secret: the keeper's tin box", r[0] == 1 and "THE GROUPER IS REAL" in r[1], r)
        await ev(CLEAR)
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.act && q.act.kind === 'nest'); const c = isleSave().inv.filter(Boolean).length; isleAct(o); ISLE.msg = null; isleAct(o); return " + MSG + "; })()")
        check("a gull nest gives something once a day", "EMPTY GULL NEST" in r, r)
        r = await ev("(() => { const R = Math.random; Math.random = () => 0.01; const s = Object.assign({}, isleSave(), { season: 1, min: 700 }); const sp = pickFish('deep', s); Math.random = R; return sp; })()")
        check("the Gull Rock Grouper", r == "grouper", r)
        await ev("(() => { ISLE.msg = null; const o = ISLE.map.objs.find(q => q.k === 'skiff_r'); isleAct(o); ISLE.list.sel = listRows().findIndex(q => q.name === 'THE PORT'); listPick(); })()")
        check("sail home", await ev("ISLE.map.id") == "port")
        check("villagers screen fits thirteen", await ev("folkGeo()[3] <= IH - 12"))
        check("no page errors", not errs, errs)
        await b.close()

    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
