"""Driftwood Isle, part 5: crafting, cooking and restoring the port (island.js). The axe and pick in Driftwood Woods,
regrowth, crafting and placing, the chest, sprinklers and mulch, the pickle jar and smoker, cooking, restoring buildings,
the store and the shipyard, the aquarium and donations, and the fish crate fed by topside dives.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_craft.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_craft"); os.makedirs(OUT, exist_ok=True)
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
SLEEP = "(() => { ISLE.msg = null; isleSleep(false); ISLE.msg = null; })()"
GIVE = "((id, n) => { invAdd(id, n); })"
SEL = "(id => { const s = isleSave(); s.sel = s.inv.findIndex(q => q && q[0] === id); if (s.sel > 8) { const t = s.inv[8]; s.inv[8] = s.inv[s.sel]; s.inv[s.sel] = t; s.sel = 8; } })"
FACE = "((x, y, dir) => { ISLE.px = x; ISLE.py = y; ISLE.dir = dir; ISLE.msg = null; })"


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        await ev("startIsland()"); await ev("ISLE.msg = null; isleSave().inv[7] = null; isleSave().inv[8] = null")
        check("kit has an axe and a pick", await ev("isleSave().inv.slice(5, 7)") == [["axe", 1], ["pick", 1]])

        # west of the Port: the woods
        await ev("(() => { ISLE.px = 10; ISLE.py = 450; })()")
        await page.keyboard.down("ArrowLeft"); await ev(TICK + "(20)"); await page.keyboard.up("ArrowLeft")
        check("west of the Port: Driftwood Woods", await ev("ISLE.map.id") == "woods")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/woods.png")

        # chop a tree: three hits, wood, a stump, and it grows back in a week
        r = await ev("""(() => { const o = ISLE.map.objs.find(q => q.res && q.res.kind === 'tree' && q.k === 'pine' && q.x > 200 && q.y > 200);
          ISLE.px = o.x + 12; ISLE.py = o.y + 46; ISLE.dir = 'up'; window._tree = o; return [o.x, o.y]; })()""")
        await ev(SEL + "('axe')")
        w0 = await ev("invCount('wood')")
        for _ in range(3): await page.keyboard.press("KeyE")
        r = await ev("[invCount('wood'), objGone(_tree)]")
        check("three chops: wood and a stump", r[0] - w0 == 4 and r[1], r)
        check("the stump doesn't block", not await ev("isleSolidAt(_tree.x + _tree.solid[0] + 2, _tree.y + _tree.solid[1] + 2)"))
        for _ in range(7): await ev(SLEEP)
        check("the tree grows back in a week", not await ev("objGone(_tree)"))
        # break a boulder with the pick; the axe won't do
        await ev("(() => { isleGo('woods', 900, 560, 'left'); const o = ISLE.map.objs.find(q => q.k === 'boulder' && q.y > 200); ISLE.px = o.x + 11; ISLE.py = o.y + 26; ISLE.dir = 'up'; window._rock = o; })()")
        await ev(SEL + "('axe')"); await page.keyboard.press("KeyE")
        check("the axe won't break rock", "PICK" in await ev("(ISLE.toasts || []).map(q => q[0]).join('|')"))
        await ev(SEL + "('pick')"); s0 = await ev("invCount('stone')")
        for _ in range(2): await page.keyboard.press("KeyE")
        r = await ev("[invCount('stone') - %d, objGone(_rock)]" % s0)
        check("two hits break a boulder for 3-5 stone", 3 <= r[0] <= 5 and r[1], r)
        # tall grass by hand
        r = await ev("""(() => { const o = ISLE.map.objs.find(q => q.k === 'tgrass' && !objGone(q)); ISLE.px = o.x + 7; ISLE.py = o.y + 20; ISLE.dir = 'up'; isleSave().sel = 2; const f0 = invCount('fiber'); isleInteract(); return [invCount('fiber') - f0, objGone(o)]; })()""")
        check("pulling tall grass gives fiber", r[0] >= 1 and r[1], r)

        # crafting a chest and placing it
        await ev(GIVE + "('wood', 200)"); await ev(GIVE + "('stone', 200)"); await ev(GIVE + "('glass', 20)"); await ev(GIVE + "('fiber', 60)"); await ev(GIVE + "('shell', 5)")
        await page.keyboard.press("KeyC")
        check("C opens crafting", await ev("ISLE.list && ISLE.list.kind") == "craft")
        check("about 40 recipes", await ev("listRows().length") == 40)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/crafting.png")
        w0 = await ev("invCount('wood')"); await page.keyboard.press("KeyE")
        check("making a chest uses 40 wood", await ev("[invCount('chest'), invCount('wood')]") == [1, w0 - 40])
        await page.keyboard.press("Escape")
        await ev("(() => { isleGo('port', 300, 470, 'down'); })()"); await ev(SEL + "('chest')"); await page.keyboard.press("KeyE");
        r = await ev("isleSave().placed.map(p => [p.a, p.id])")
        check("placing the chest", r == [["port", "chest"]], r)
        check("it blocks the way", await ev("(() => { const p = isleSave().placed[0]; return isleSolidAt(p.x * 16 + 8, p.y * 16 + 8); })()"))
        await page.keyboard.press("KeyE")
        check("using it opens the chest", await ev("!!ISLE.chest"))
        st0 = await ev("invCount('stone')")
        await ev("(() => { ISLE.chest.side = 1; ISLE.chest.sel = isleSave().inv.findIndex(q => q && q[0] === 'stone'); })()"); await page.keyboard.press("KeyE")
        check("moving stone into the chest", await ev("chestSlots().some(q => q && q[0] === 'stone') && invCount('stone') === 0"))
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/chest.png")
        await ev("(() => { ISLE.chest.side = 0; ISLE.chest.sel = chestSlots().findIndex(q => q && q[0] === 'stone'); })()"); await page.keyboard.press("KeyE"); await page.keyboard.press("Escape")
        check("and back", await ev("invCount('stone')") == st0)

        # sprinklers water the garden each morning; mulch keeps a tile wet
        await ev("""(() => { const s = isleSave(); isleGo('flats', 360, 400, 'down'); s.placed.push({ a: 'flats', x: 23, y: 26, id: 'sprinkler' });
          s.farm['flats:24,26'] = { c: 'lettuce', d: 0, w: 0 }; s.farm['flats:25,26'] = { c: 'lettuce', d: 0, w: 0 }; s.farm['flats:22,28'] = { c: 'lettuce', d: 0, w: 0, mulch: 1 }; })()""")
        await ev("window._w = weatherOf; weatherOf = () => 'sun'; 0"); await ev(SLEEP)
        r = await ev("[isleSave().farm['flats:24,26'].w, isleSave().farm['flats:25,26'].w, isleSave().farm['flats:22,28'].w]")
        check("the sprinkler waters next to it, not two away; mulch stays wet", r == [1, 0, 1], r)
        await ev(SLEEP)
        check("watered by the sprinkler: it grew", await ev("isleSave().farm['flats:24,26'].d") == 1)
        await ev("weatherOf = window._w; 0")

        # the pickle jar and the fish smoker
        await ev("(() => { const s = isleSave(); isleGo('port', 300, 520, 'up'); s.placed.push({ a: 'port', x: 18, y: 31, id: 'jar' }, { a: 'port', x: 20, y: 31, id: 'smoker' }); invAdd('beet', 1); invAdd('f_sardine', 1); })()")
        await ev(FACE + "(18 * 16 + 8, 33 * 16 - 2, 'up')"); await ev(SEL + "('beet')"); await page.keyboard.press("KeyE")
        await ev(FACE + "(20 * 16 + 8, 33 * 16 - 2, 'up')"); await ev(SEL + "('f_sardine')"); await page.keyboard.press("KeyE")
        check("a beet in the jar, a sardine in the smoker", await ev("isleSave().placed.filter(p => p.m).map(p => p.m.out)") == ["j_beet", "k_f_sardine"])
        await ev(SLEEP); await ev("isleGo('port', 300, 520, 'up')")
        await ev(FACE + "(20 * 16 + 8, 33 * 16 - 2, 'up')"); await page.keyboard.press("KeyE")
        await ev(FACE + "(18 * 16 + 8, 33 * 16 - 2, 'up')"); await page.keyboard.press("KeyE")
        r = await ev("[invCount('k_f_sardine'), invCount('j_beet')]")
        check("next morning: smoked sardine; the pickles need another day", r == [1, 0], r)
        await ev(SLEEP); await ev("isleGo('port', 300, 520, 'up')"); await ev(FACE + "(18 * 16 + 8, 33 * 16 - 2, 'up')"); await page.keyboard.press("KeyE")
        check("two days: pickled beet, worth more than double", await ev("invCount('j_beet') === 1 && ITEMS.j_beet.sell > 2 * ITEMS.beet.sell"))

        # cooking at the stove; smokehouse recipes wait
        await ev("(() => { isleGo('shack', 159, 50, 'up'); invAdd('f_mackerel', 1); })()")
        await ev(FACE + "(159, 52, 'up')"); await page.keyboard.press("KeyE")
        check("the stove opens cooking", await ev("ISLE.list && ISLE.list.kind") == "cook")
        check("40 recipes", await ev("COOK.length") == 40)
        r = await ev("(() => { const rows = listRows(); return [rows[0].ok, rows.find(r => r.name === 'LOBSTER ROLL').info]; })()")
        check("grilled fish can be cooked; the lobster roll needs the smokehouse", r[0] and "SMOKEHOUSE" in r[1], r)
        await page.keyboard.press("KeyE")
        check("cooked a dish", await ev("invCount('d_grilled')") == 1)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/cooking.png")
        await page.keyboard.press("Escape")

        # restoring the store: pay, wait a night, shop
        await ev("(() => { const s = isleSave(); s.sd = 10000; isleGo('port', 400, 420, 'up'); ISLE.msg = null; })()")
        await page.keyboard.press("KeyE")
        check("the store asks to be restored", "RESTORE" in await ev("ISLE.msg && ISLE.msg.pages[1]"))
        await page.keyboard.press("KeyE"); await ev(TICK + "(120)"); await page.keyboard.press("KeyE")
        r = await ev("[isleSave().rest.store, isleSave().sd]")
        check("paid: work begins", r == ["work", 9200], r)
        await ev(SLEEP)
        check("the next morning it's restored", await ev("isleSave().rest.store") == "done" and await ev("artKey(ISLE.maps.port.objs.find(o => o.k === 'store'))") == "store_r")
        await ev("(() => { isleGo('port', 400, 420, 'up'); ISLE.msg = null; })()"); await page.keyboard.press("KeyE")
        check("the restored store sells things", await ev("ISLE.list && ISLE.list.kind") == "store" and await ev("listRows().some(r => r.icon === 'painting')"))
        await page.keyboard.press("Escape")

        # the shipyard: a bigger bag
        await ev("(() => { const s = isleSave(); s.rest.yard = 'done'; s.sd = 5000; invAdd('wood', 100); restoredAct('yard'); })()")
        await ev("ISLE.list.sel = 0"); await page.keyboard.press("KeyE")
        check("the bigger bag adds 9 slots", await ev("isleSave().inv.length") == 27)
        await page.keyboard.press("Escape"); await page.keyboard.press("Tab")
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/bigbag.png"); await page.keyboard.press("Escape")

        # the crate: topside dives send one fish each
        sp = await ev("TOPFISH[0][0]")
        r = await ev("""(() => { const R = REEL; const save = ISLE; isleLeave(); R.newDive(); R.S.catch = [['%s', 3, false], ['%s', 4, false]]; R.beginHaul();
          return [isleSave().crate.slice(-1)[0], R.S.haul.extra.map(e => e[0]).find(t => t.startsWith('CRATE'))]; })()""" % (sp, sp))
        check("a topside haul sends a fish to the crate", r[0] == sp and r[1] is not None, r)
        await ev("REEL.newDive(); startIsland(); ISLE.msg = null")
        r = await ev("""(() => { const s = isleSave(); s.crate.push(...TOPFISH.slice(1, 12).map(t => t[0])); isleGo('port', 538, 590, 'up'); isleAct(ISLE.map.objs.find(o => o.k === 'crate')); return s.inv.filter(q => q && q[0].startsWith('t_')).length; })()""")
        check("the crate empties into the bag", r >= 11, r)

        # the aquarium: restore, walk in, donate; every 10 donations pays 300
        await ev("(() => { isleSave().rest.aquarium = 'done'; restoredAct('aquarium'); })()")
        check("walking into the restored aquarium", await ev("ISLE.map.id") == "aqua")
        sd0 = await ev("isleSave().sd")
        r = await ev("(() => { isleAct(ISLE.map.objs.find(o => o.k === 'donate')); return Object.keys(isleSave().donated).length; })()")
        check("donating one of each kind", r >= 11, r)
        check("10 donations: 300 sand dollars", await ev("isleSave().sd") - sd0 == 300)
        await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/aquarium.png")
        await page.keyboard.down("ArrowDown"); await ev("ISLE.px = 160; ISLE.py = 176"); await ev(TICK + "(30)"); await page.keyboard.up("ArrowDown")
        check("out the door to the Port", await ev("ISLE.map.id") == "port")
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # a part-4 save gets an axe and a pick, with a message; phone screenshot of the woods
        old = '{"dives": 80, "isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 0, "day": 6, "min": 700, "sd": 50, "intro": 1, "kit": 1, "fish0": 1, "area": "port", "x": 0, "y": 0, "inv": [["hoe", 1], ["can", 1], ["rod", 1], ["net", 1], null, null, null, null, null, null, null, null, null, null, null, null, null, null], "sel": 0, "water": 30, "farm": {}, "bin": [], "forage": null, "earned": 0, "log": {}, "pots": []}}}'
        b, page, errs = await fresh(p, 390, 700, old)
        await page.evaluate("startIsland()")
        r = await page.evaluate("({ inv: isleSave().inv.slice(4, 6), pages: ISLE.msg.pages.join(' ') })")
        check("old save: axe and pick added, with a message", r["inv"] == [["axe", 1], ["pick", 1]] and "AXE" in r["pages"], r)
        await page.evaluate("(() => { ISLE.msg = null; isleGo('woods', 640, 470, 'up'); })()"); await page.wait_for_timeout(300)
        await page.screenshot(path=OUT + "/phone.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
