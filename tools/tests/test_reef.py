"""The Coral Reef (Nov 19, 2026): zone 10, between the Kelp Forest and Twilight.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_reef.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reef"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if not ok else ""))
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


AT = """(m => { const R = REEL; R.newDive(); R.S.lure = 0; R.cast(); R.S.overlay = null; R.S.sink = 0;
  R.S.hy = m * 6; R.S.cam = R.S.hy - 78; R.S.hx = LW / 2; R.S.immune = 99; })"""


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        r = await ev("[100, 150, 169, 171, 200, 249, 251, 300, 400, 1159].map(zoneOf)")
        check("zones by depth", r == [0, 1, 1, 10, 10, 10, 2, 2, 3, 9], r)
        check("depth order", await ev("ZORD") == [0, 1, 10, 2, 3, 4, 5, 6, 7, 8, 9])
        check("zone 10 is the Coral Reef", await ev("ZONES[10][0]") == "CORAL REEF")
        reef = await ev("LOGGED.filter(s => s[2] === 10).map(s => [s[0], !!DATA.atlas[s[0]], s[7]])")
        check("13 reef species with sprites", len(reef) == 13 and all(x[1] for x in reef), reef)
        check("3 reef legendaries", sum(1 for x in reef if x[2]) == 3)
        check("log is 142", await ev("LOGGED.length") == 142)
        check("two reef sharks bite", await ev("SHARKS.includes('whitetip') && SHARKS.includes('nurse') && SHARKS.length === 11"))
        check("JAWS says 11", await ev("TITLES.find(t => t[0] === 'jaws')[2]") == "CATCH ALL 11 SHARKS")
        check("reef title appended after the old ones", await ev("TITLES.findIndex(t => t[0] === 'zone10') > TITLES.findIndex(t => t[0] === 'podium') && titleName('zone10') === 'REEF RAIDER'"))
        check("zone titles 0-9 kept", await ev("[...Array(10).keys()].every(i => TITLES[i + 1][0] === 'zone' + i)"))
        check("reef legend fights like a shallow one", await ev("fightStyle(SPEC.goliath) === 'heavy' && fightStyle(SPEC.rainbow) === 'heavy'"))
        check("abyss fish still shrink", await ev("fightStyle(SPEC.angler) === 'shrink' && fightStyle(SPEC.tang) === 'heavy'"))
        check("log steps by depth", await ev("[zoneStep(1, 1), zoneStep(10, 1), zoneStep(2, -1), zoneStep(0, -1), zoneStep(9, 1)]") == [10, 2, 10, 9, 0])
        check("task text", await ev("taskText({k: 'zone', a: 10, n: 3})") == "3 REEF FISH")
        check("aquarium has a reef tank", await ev("aquaObjects().some(o => o.k === 'tank' && o.act.z === 10)"))

        # ---- the ocean: reef fish live at 170-250 m, blend at both edges, nowhere else
        r = await ev("""(() => { const R = REEL, out = {}; for (let seed = 1; seed < 60; seed++) { R.newDive(); R.S.seed = seed; R.S.chunks = {};
            for (let i = 0; i < 170; i++) for (const f of chunk(i)) { if (f.id === 'jelly' || !SPEC[f.id]) continue; const z = SPEC[f.id][2], m = Math.floor(f.y / 6 / 10) * 10;
              if (z === 10) out[m] = (out[m] || 0) + 1; } } return out; })()""")
        ms = sorted(int(k) for k in r)
        check("reef fish only near 170-250 m", ms and ms[0] >= 145 and ms[-1] <= 275, r)
        check("reef fish fill the zone", sum(r.get(str(m), 0) for m in range(180, 240, 10)) > 100, r)
        r = await ev("""(() => { const R = REEL; let kelp = 0, twi = 0; for (let seed = 1; seed < 60; seed++) { R.newDive(); R.S.seed = seed; R.S.chunks = {};
            for (let i = 0; i < 170; i++) for (const f of chunk(i)) { if (!SPEC[f.id]) continue; const z = SPEC[f.id][2], m = f.y / 6;
              if (z === 1 && m > 195) kelp++; if (z === 2 && m < 225) twi++; } } return [kelp, twi]; })()""")
        check("kelp and twilight fish stay out of the middle of the reef", r == [0, 0], r)
        check("tripod still only on the floor", await ev("""(() => { const R = REEL; let n = 0; for (let s = 1; s < 40; s++) { R.newDive(); R.S.seed = s; R.S.chunks = {};
            for (let i = 0; i < 100; i++) for (const f of chunk(i)) if (f.id === 'tripod') { if (f.y !== DEPTH_PX - 12) return -1; n++; } } return n; })()""") > 0)
        # reef legendaries get placed in the reef
        r = await ev("""(() => { const R = REEL, ds = []; for (let s = 0; s < 300; s++) { R.newDive(); R.S.lure = 2; R.cast(); R.S.overlay = null;
            for (const k in R.S.special) for (const sp of R.S.special[k]) if (SPEC[sp[0]][2] === 10) ds.push(sp[1] / 6); } return [ds.length, Math.min(...ds), Math.max(...ds)]; })()""")
        check("reef legendaries spawn in the reef", r[0] > 5 and r[1] >= 170 and r[2] <= 250, r)
        # zone popups come in depth order
        r = await ev("""(() => { const R = REEL; R.newDive(); R.S.lure = 0; R.cast(); R.S.overlay = null; R.S.chunks = {}; for (let i = 0; i < 200; i++) R.S.chunks[i] = [];
            R.S.immune = 999; const seen = []; for (let k = 0; k < 4000 && R.S.hy < 330 * 6; k++) { R.simTick(1 / 60); R.S.popups.forEach(p => { if (ZONES.some(z => z[0] === p[0]) && !seen.includes(p[0])) seen.push(p[0]); }); } return seen; })()""")
        check("zone names pop up in depth order", r[:4] == ["KELP FOREST", "CORAL REEF", "TWILIGHT", "THE WRECK"], r)
        # bounty only adds reef fish from Nov 20
        r = await ev("""(() => { const D = Date, out = []; for (const day of ['2026-11-19T12:00', '2026-11-25T12:00', '2026-12-03T12:00']) {
            window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [day])); } static now() { return new D(day).getTime(); } };
            out.push(todaysBounty()); } window.Date = D; return out; })()""")
        check("bounty works", all(isinstance(x, str) and x for x in r), r)

        # ---- screenshots: a dive in the reef, wide and narrow, and the log
        await ev(AT + "(205)")
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + "/reef_wide.png")
        await ev(AT + "(176)")
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/reef_top_wide.png")
        await ev("(() => { REEL.newDive(); REEL.S.overlay = 'log'; REEL.S.logPage = 10; })()")
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/log_wide.png")
        check("no errors (wide)", not errs, errs)
        await b.close()

        b, page, errs = await fresh(p, 390, 700)
        ev = page.evaluate
        await ev(AT + "(215)")
        await page.wait_for_timeout(400)
        await page.screenshot(path=OUT + "/reef_phone.png")
        await ev("(() => { REEL.newDive(); REEL.S.overlay = 'log'; REEL.S.logPage = 10; })()")
        await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/log_phone.png")
        check("no errors (phone)", not errs, errs)
        await b.close()
    print("ALL PASS" if not fails else "FAILED: " + ", ".join(fails))


asyncio.run(main())
