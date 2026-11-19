"""Driftwood Isle, part 4: chill fishing and the island log (island.js, isle_fish.js). The rod and net, the Lagoon,
casting, shadows, bites, reeling, fish getting away, tide pools, crab pots, the log, and which fish can be caught now.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_fish.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_fish"); os.makedirs(OUT, exist_ok=True)
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
# a patient robot angler: wait for the bite, strike, then reel and ease off by the line
FISH_BOT = """(() => { let t = 0;
  while (ISLE.fish && ISLE.fish.phase !== 'reel' && t < 3600) { if (ISLE.fish.phase === 'wait' && ISLE.fish.bite > 0) { fishPress(); break; } REEL.simTick(1 / 60); t++; }
  if (!ISLE.fish || ISLE.fish.phase !== 'reel') return 'no bite';
  const sp = ISLE.fish.sp;
  for (let k = 0; k < 3600 && ISLE.fish; k++) { const F = ISLE.fish; F.hold = F.ten < (F.hold ? 0.8 : 0.35); REEL.simTick(1 / 60); }
  return ISLE.fish ? 'still reeling' : sp; })()"""


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        await ev("startIsland()")
        check("new kit has a rod and a net", await ev("isleSave().inv.slice(3, 5)") == [["rod", 1], ["net", 1]])
        await ev("ISLE.msg = null")
        check("175 log entries", await ev("ISLE_FISH.length") == 175 and await ev("new Set(ISLE_FISH.map(f => f[0])).size") == 175)

        # which fish can be caught now: everything not waiting for an area or festival still to come
        r = await ev("""(() => { const got = new Set(), base = { year: 1, day: 3 };
          for (const where of ['sea', 'deep', 'lake', 'river', 'pool', 'seapot', 'freshpot', 'cave1', 'cave2', 'cave3', 'cave4', 'cave5'])
            for (let se = 0; se < 4; se++) for (const min of [365, 400, 700, 1100, 1300]) for (const wx of ['sun', 'rain', 'snow']) for (const day of [3, 14]) {
              const s = Object.assign({}, base, { season: se, min, day }), old = weatherOf; weatherOf = () => wx;
              for (let k = 0; k < 400; k++) { const id = pickFish(where, s); if (id) got.add(id); }
              weatherOf = old; }
          const want = ISLE_FISH.filter(f => !LATER.test(f[3])).map(f => f[0]);
          return { missing: want.filter(id => !got.has(id)), n: want.length, extra: [...got].filter(id => !want.includes(id)) }; })()""")
        check("every fish that should be catchable now can be (%d)" % r["n"], not r["missing"] and not r["extra"], r)
        check("163 catchable now (the caves opened in part 7); marsh, wreck, Gull Rock and festivals wait", r["n"] == 163, r["n"])

        # north from the Port to the Lagoon
        await ev("(() => { ISLE.px = 600; ISLE.py = 20; })()")
        await page.keyboard.down("ArrowUp"); await ev(TICK + "(20)"); await page.keyboard.up("ArrowUp")
        check("north of the Port: the Lagoon", await ev("ISLE.map.id") == "lagoon")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/lagoon.png")

        # fishing off the lake pier: hold to charge, let go to cast
        await ev("(() => { isleGo('lagoon', 472, 566, 'up'); isleSave().sel = 3; isleSave().min = 700; ISLE.shadows = []; })()")
        await page.keyboard.down("KeyE"); await ev(TICK + "(25)"); await page.keyboard.up("KeyE")
        check("letting go casts", await ev("ISLE.fish && ISLE.fish.phase") == "fly")
        await ev(TICK + "(30)")
        r = await ev("[ISLE.fish && ISLE.fish.phase, waterKind(ISLE.fish.x, ISLE.fish.y)]")
        check("the bobber lands in the lake", r == ["wait", "lake"], r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/bobber.png")
        sp = await ev(FISH_BOT)
        r = await ev("({ log: isleSave().log['%s'], bag: isleSave().inv.some(q => q && q[0] === 'f_%s'), card: ISLE.card && ISLE.card.sp })" % (sp, sp))
        check("a fish bites, gets reeled in, goes in the log and the bag", sp in await ev("Object.keys(FISH)") and r["log"]["n"] == 1 and r["bag"] and r["card"] == sp, (sp, r))
        check("it's a Lagoon fish", await ev("['lake'].includes(FISH['%s'].where)" % sp), sp)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/card.png")
        await page.keyboard.press("KeyE")
        check("the card closes", await ev("ISLE.card") is None)

        # a missed bite: the fish swims off and the line stays out
        await ev("(() => { ISLE.fish = null; ISLE.dir = 'up'; isleSave().sel = 3; fishPress(); ISLE.fish.p = 0.5; castLine(); })()"); await ev(TICK + "(30)")
        await ev("""(() => { let t = 0; while (ISLE.fish && !(ISLE.fish.bite > 0) && t < 3600) { REEL.simTick(1 / 60); t++; } })()""")
        await ev(TICK + "(80)")
        r = await ev("[ISLE.fish && ISLE.fish.phase, !!(ISLE.fish && ISLE.fish.sh)]")
        check("a missed bite: it swims off, the line stays out", r == ["wait", False], r)
        await page.keyboard.press("KeyE")
        check("pressing E with no bite reels the line in", await ev("ISLE.fish") is None)

        # too much tension: it slips off, no harm
        await ev("ISLE.fish = { phase: 'reel', sp: 'sturgeon', size: 1, prog: 0.2, ten: 0.5, hold: true, over: 0, surge: 1, surgeT: 9, x: 472, y: 520 }")
        await ev(TICK + "(240)")
        r = await ev("[ISLE.fish, isleSave().log.sturgeon]")
        check("holding through the glow: it slips away", r == [None, None], r)
        # casting at dry land
        await ev("(() => { isleGo('lagoon', 560, 760, 'down'); fishPress(); ISLE.fish.p = 0.1; castLine(); })()"); await ev(TICK + "(30)")
        check("a cast onto dry land comes back", await ev("ISLE.fish") is None)
        # walking reels in
        await ev("(() => { isleGo('lagoon', 472, 566, 'up'); fishPress(); ISLE.fish.p = 0.5; castLine(); })()"); await ev(TICK + "(30)")
        await page.keyboard.down("ArrowDown"); await ev(TICK + "(5)"); await page.keyboard.up("ArrowDown")
        check("walking off reels the line in", await ev("ISLE.fish") is None)

        # sea fishing off the Port dock gets sea fish
        await ev("(() => { isleGo('port', 566, 770, 'left'); isleSave().min = 700; ISLE.shadows = []; fishPress(); ISLE.fish.p = 0.3; castLine(); })()")
        await ev(TICK + "(30)")
        sp = await ev(FISH_BOT)
        check("off the dock: a sea fish", await ev("['sea', 'deep'].includes((FISH['%s'] || {}).where)" % sp), sp)
        await ev("ISLE.card = null")

        # tide pools: the net at low tide
        r = await ev("""(() => { isleGo('flats', 900, 700); const M_ = ISLE.map, s = isleSave(); let m;
          for (m = DAY_START; m < DAY_END; m += 10) { s.min = m; if (M_.pools.some(poolDry)) break; }
          const i = M_.pools.findIndex(poolDry), p = M_.pools[i]; ISLE.px = p[0]; ISLE.py = p[1] + 4; ISLE.dir = 'up'; s.sel = 4; return [M_.pools.length, i, m]; })()""")
        check("the flats have tide pools", r[0] >= 6 and r[1] >= 0, r)
        before = await ev("Object.keys(isleSave().log).length")
        await page.keyboard.press("KeyE")
        r = await ev("[poolsToday().used.length, Object.keys(isleSave().log).length, (ISLE.toasts || []).map(q => q[0]).join('|')]")
        check("the net searches the pool", r[0] == 1 and (r[1] > before or "BARNACLE" in r[2]), r)
        await ev("ISLE.card = null"); await page.keyboard.press("KeyE")
        check("each pool once a day", "SEARCHED" in await ev("(ISLE.toasts || []).map(q => q[0]).join('|')"))
        r = await ev("""(() => { let n = 0, crit = 0; const s = isleSave(); for (let k = 0; k < 300; k++) { const id = pickFish('pool', s); if (id) { n++; if (FISH[id].page === 'pool' || FISH[id].where === 'pool') crit++; } } return [n, crit]; })()""")
        check("pools give tide-pool critters", r[0] == r[1] and r[0] > 250, r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/pools.png")

        # crab pots: buy, set, overnight
        await ev("(() => { isleGo('port', 452, 414, 'up'); ISLE.msg = null; ISLE.card = null; isleSave().sd = 5000; })()")
        await page.keyboard.press("KeyE")
        await ev("ISLE.shop.sel = shopList().findIndex(c => c.item === 'pot')")
        await page.keyboard.down("Shift"); await page.keyboard.press("KeyE"); await page.keyboard.up("Shift"); await page.keyboard.press("Escape")
        n = await ev("isleSave().inv.filter(q => q && q[0] === 'pot').reduce((a, q) => a + q[1], 0)")
        check("the stand sells crab pots", n == 5, n)
        r = await ev("""(() => { const s = isleSave(); s.sel = s.inv.findIndex(q => q && q[0] === 'pot'); isleGo('port', 576, 640, 'left');
          let placed = 0; for (const [x, dir] of [[566, 'left'], [586, 'right']]) for (const y of [640, 680, 720]) { ISLE.px = x; ISLE.py = y; ISLE.dir = dir; const n0 = s.pots.length; isleInteract(); if (s.pots.length > n0) placed++; }
          return [placed, s.pots.length]; })()""")
        check("pots go in the water beside the dock", r[0] >= 4, r)
        await ev("(() => { ISLE.msg = null; isleSleep(false); ISLE.msg = null; })()")
        r = await ev("isleSave().pots.filter(p => p.c).map(p => FISH[p.c].where)")
        check("overnight the pots fill with sea pot catches", len(r) >= 2 and all(w == "seapot" for w in r), r)
        r = await ev("""(() => { const s = isleSave(), p = s.pots.find(q => q.c); isleGo('port', p.x * 16 + 8 + 16, p.y * 16 + 10, 'left'); const c = p.c; isleInteract(); return [c, !!s.log[c], p.c]; })()""")
        check("checking a pot takes the catch", r[1] and r[2] is None, r)
        await ev("ISLE.card = null")

        # the log
        await page.keyboard.press("KeyL")
        check("L opens the island log", await ev("!!ISLE.log"))
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/log.png")
        await page.keyboard.press("Tab"); await page.keyboard.press("Tab")
        check("Tab turns the pages", await ev("ISLE.log.page") == 2)
        await page.keyboard.press("Escape")
        check("Escape closes it", await ev("ISLE.log") is None)
        # fish sell in the bin
        r = await ev("""(() => { const s = isleSave(); s.inv[9] = ['f_sardine', 3]; s.sel = 0; s.inv[0] = ['f_sardine', 3]; s.inv[9] = null; isleGo('port', 206, 412, 'up'); ISLE.msg = null; isleInteract(); return s.bin; })()""")
        check("fish sell in the bin", r == [["f_sardine", 3]], r)
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # a part-3 save without a rod gets the rod and net, with a message; phone: tap water to cast
        old = '{"dives": 80, "isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 0, "day": 6, "min": 700, "sd": 50, "intro": 1, "kit": 1, "area": "port", "x": 0, "y": 0, "inv": [["hoe", 1], ["can", 1], null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], "sel": 0, "water": 30, "farm": {}, "bin": [], "forage": null, "earned": 0}}}'
        b, page, errs = await fresh(p, 390, 700, old)
        await page.evaluate("startIsland()")
        r = await page.evaluate("({ inv: isleSave().inv.slice(0, 4), pages: ISLE.msg.pages.join(' ') })")
        check("old save: rod and net added, with a message", r["inv"][2] == ["rod", 1] and r["inv"][3] == ["net", 1] and "FISHING ROD" in r["pages"], r)
        await page.evaluate("(() => { ISLE.msg = null; isleGo('port', 576, 790, 'down'); isleSave().sel = 2; })()")
        box = await page.locator("#game").bounding_box()
        pos = await page.evaluate("(() => { const [cx, cy] = isleCam(); return [576 - cx + 50, 760 - cy, IH]; })()")
        await page.mouse.move(box["x"] + pos[0] / 240 * box["width"], box["y"] + pos[1] / pos[2] * box["height"])
        await page.mouse.down(); await page.evaluate(TICK + "(20)"); await page.mouse.up()
        check("phone: holding a tap on water casts toward it", await page.evaluate("ISLE.fish && ISLE.fish.phase") in ("fly", "wait"))
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/phone.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
