"""Driftwood Isle, part 8c: the hatchery and the 30 morphs (island.js).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_hatchery.py"""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_hatch"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)

MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
SLEEP = "(() => { ISLE.msg = null; ISLE.list = null; isleSleep(false); ISLE.msg = null; })()"
YES = "(() => { const m = ISLE.msg; m.t = 9; m.i = m.pages.length - 1; m.sel = 0; isleMsgAdvance(); })()"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=1)
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("""(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 80; Object.assign(REEL.store.isle, { planks: 60, rope: 1, sail: 1, compass: 1, built: 1 }); })()""")
        await ev("startIsland()"); await ev("(() => { ISLE.msg = null; const s = isleSave(); s.day = 2; s.min = 600; s.sd = 9000; s.inv = s.inv.map((q, i) => i < 7 ? q : null); })()")

        r = await ev("[MORPHS.length, new Set(MORPHS.map(m => m[0])).size, BREEDS.length, BREEDS.every(sp => FISH[sp]), MORPHS.every(m => itemIcon('m_' + m[0]).width > 0)]")
        check("30 morphs, 15 kinds of fish that can have them, all with icons", r == [30, 30, 15, True, True], r)

        await ev("isleGo('lagoon', 736, 690, 'up')")
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.k === 'hatch'); isleAct(o); return " + MSG + "; })()")
        check("the hatchery ruin can be restored", "TO RESTORE IT" in r and "COPPER" in r, r)
        await ev("(() => { ISLE.msg = null; invAdd('wood', 120); invAdd('stone', 120); invAdd('glass', 20); invAdd('copper', 10); const o = ISLE.map.objs.find(q => q.k === 'hatch'); isleAct(o); })()"); await ev(YES)
        check("restoring it", await ev("isleSave().rest.hatch") == "work")
        await ev(SLEEP)
        await ev("(() => { isleSave().min = 600; isleGo('lagoon', 736, 690, 'up'); const o = ISLE.map.objs.find(q => q.k === 'hatch'); isleAct(o); })()")
        r = await ev("[ISLE.list && ISLE.list.kind, listRows().length]")
        check("the hatchery: four tanks and the collection", r == ["hatch", 5], r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/hatchery.png")

        # put a pair of carp in tank 1
        await ev("(() => { invAdd('f_carp', 2); ISLE.list.sel = 0; listPick(); })()")
        check("an empty tank asks which pair", await ev("ISLE.list.kind") == "hatchpick")
        await ev("(() => { ISLE.list.sel = BREEDS.indexOf('carp'); listPick(); })()")
        r = await ev("[isleSave().hatch[0] && isleSave().hatch[0].sp, invCount('f_carp')]")
        check("the pair goes in", r == ["carp", 0], r)
        await ev("(() => { ISLE.list.sel = 1; listPick(); ISLE.list.sel = BREEDS.indexOf('koi'); listPick(); })()")
        check("can't put in a kind you don't have two of", await ev("isleSave().hatch[1]") is None)
        await ev(SLEEP); await ev(SLEEP)
        await ev("(() => { const s = isleSave(); s.news = []; s.day++; newDay5(s); window._news = s.news.join(' '); s.day--; })()")
        await ev(SLEEP)
        check("news when something hatches", "HATCHED" in await ev("_news"))
        r = await ev("(() => { ISLE.list = { kind: 'hatch', sel: 0, top: 0 }; return listRows()[0].name; })()")
        check("after three days: ready", "READY" in r, r)
        r = await ev("(() => { const R = Math.random; Math.random = () => 0.1; listPick(); Math.random = R; return [invCount('m_platcarp'), isleSave().morphs.platcarp, " + MSG + "]; })()")
        check("a lucky hatch: the rare Platinum Carp, into the collection", r[0] == 1 and r[1] == 1 and "PLATINUM CARP" in r[2], r)
        await ev("ISLE.msg = null")
        r = await ev("(() => { const s = isleSave(); s.hatch[0].day -= 3; ISLE.list = { kind: 'hatch', sel: 0, top: 0 }; const R = Math.random; Math.random = () => 0.9; listPick(); Math.random = R; return invCount('f_carp'); })()")
        check("usually: a plain carp, and the pair breeds again", r == 1, r)
        r = await ev("(() => { ISLE.list = { kind: 'morphs', sel: 0, top: 0 }; return [listRows().filter(q => q.ok).length, listRows().length]; })()")
        check("the Morph Collection shows 1 of 30", r == [1, 30], r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/morphs.png")
        r = await ev("[giftTaste(FOLK.fenn, 'm_platcarp'), ITEMS.m_platcarp.sell >= 300]")
        check("Dr. Fenn loves morphs; they sell well", r == ["love", True], r)
        check("no page errors", not errs, errs)
        await b.close()
    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
