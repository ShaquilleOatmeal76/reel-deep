"""Driftwood Isle, part 3: farming and selling (island.js). The starting kit, the way east to the Tide Flats, tilling,
planting, watering, growing, rain, seasons ending, harvesting, the selling bin, the seed stand, forage, the bag.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_farm.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_farm"); os.makedirs(OUT, exist_ok=True)
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
SLEEP = "(() => { ISLE.msg = null; isleSleep(false); ISLE.msg = null; isleGo('flats', 440, 400, 'down'); })()"


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        await ev("startIsland()")
        r = await ev("({ inv: isleSave().inv.slice(0, 4), sd: isleSave().sd, water: isleSave().water, pages: ISLE.msg.pages.length })")
        check("starting kit: hoe, can, 15 lettuce seeds, 100 sand dollars", r["inv"] == [["hoe", 1], ["can", 1], ["s_lettuce", 15], ["rod", 1]] and r["sd"] == 100 and r["water"] == 30, r)
        check("the intro explains the garden", r["pages"] == 5, r)
        await ev("ISLE.msg = null")

        # east along the coast road to the Tide Flats
        await ev("(() => { ISLE.px = 1100; ISLE.py = 452; })()")
        await page.keyboard.down("ArrowRight"); await ev(TICK + "(30)"); await page.keyboard.up("ArrowRight")
        r = await ev("({ id: ISLE.map.id, x: ISLE.px, y: ISLE.py })")
        check("the coast road leads to the Tide Flats", r["id"] == "flats" and r["x"] < 48, r)
        await page.keyboard.down("ArrowLeft"); await ev(TICK + "(90)"); await page.keyboard.up("ArrowLeft")
        check("and back to the Port", await ev("ISLE.map.id") == "port")

        # till, plant, water: face the garden tile below you
        await ev("(() => { isleGo('flats', 344, 392, 'down'); isleSave().sel = 0; })()")
        tile = await ev("facingTile()")
        await page.keyboard.press("KeyE")
        key = "flats:%d,%d" % (tile[0], tile[1])
        check("the hoe tills the garden", await ev("!!isleSave().farm['%s']" % key), tile)
        await page.keyboard.press("Digit3"); await page.keyboard.press("KeyE")
        r = await ev("[isleSave().farm['%s'].c, isleSave().inv[2][1]]" % key)
        check("seeds plant in tilled ground", r == ["lettuce", 14], r)
        await page.keyboard.press("Digit2"); await page.keyboard.press("KeyE")
        r = await ev("[isleSave().farm['%s'].w, isleSave().water]" % key)
        check("the can waters it", r == [1, 29], r)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/planted.png")
        # outside the garden the hoe does nothing
        await ev("(() => { ISLE.px = 200; ISLE.py = 300; ISLE.dir = 'down'; isleSave().sel = 0; })()")
        n0 = await ev("Object.keys(isleSave().farm).length"); await page.keyboard.press("KeyE")
        check("the hoe only works in the garden", await ev("Object.keys(isleSave().farm).length") == n0)

        # growing: a watered day is a day of growth; an unwatered one isn't (force sunny days)
        await ev("window._w = weatherOf; weatherOf = () => 'sun'; 0")
        await ev(SLEEP)
        check("watered: grew a day", await ev("isleSave().farm['%s'].d" % key) == 1)
        await ev(SLEEP)
        check("not watered: no growth", await ev("isleSave().farm['%s'].d" % key) == 1)
        for _ in range(2): await ev("isleSave().farm['%s'].w = 1" % key); await ev(SLEEP)
        r = await ev("isleSave().farm['%s']" % key)
        check("three watered days: lettuce is ripe", r["d"] == 3, r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/ripe.png")
        await ev("(() => { ISLE.px = 344; ISLE.py = 392; ISLE.dir = 'down'; })()")
        await page.keyboard.press("KeyE")
        r = await ev("({ e: isleSave().farm['%s'], n: isleSave().inv.filter(q => q && q[0] === 'lettuce').reduce((a, q) => a + q[1], 0) })" % key)
        check("harvest: lettuce in the bag, ground still tilled", r["e"]["c"] is None and r["n"] >= 1, r)
        # rain waters everything
        await ev("weatherOf = () => 'rain'; 0"); await ev(SLEEP)
        check("rain waters the garden", await ev("isleSave().farm['%s'].w" % key) == 1)
        await ev("weatherOf = window._w; 0")

        # regrowing crops and seasons ending
        await ev("""(() => { const s = isleSave(); s.farm['flats:22,25'] = { c: 'pea', d: 5, w: 0 }; s.farm['flats:23,25'] = { c: 'lettuce', d: 1, w: 0 }; })()""")
        await ev("(() => { ISLE.px = 22 * 16 + 8; ISLE.py = 25 * 16 - 2; ISLE.dir = 'down'; })()")
        await page.keyboard.press("KeyE")
        check("beach peas regrow after picking", await ev("isleSave().farm['flats:22,25']") == {"c": "pea", "d": 2, "w": 0})
        await ev("(() => { const s = isleSave(); s.day = 28; })()"); await ev(SLEEP)
        r = await ev("[isleSave().season, isleSave().farm['flats:22,25'].dead, isleSave().farm['flats:23,25'].dead]")
        check("spring crops die when summer comes", r == [1, 1, 1], r)

        # the bin: hold something sellable, use the bin, paid overnight
        await ev("(() => { isleGo('port', 206, 412, 'up'); const s = isleSave(); s.inv[4] = ['lettuce', 4]; s.sel = 4; ISLE.msg = null; })()")
        sd0 = await ev("isleSave().sd")
        await page.keyboard.press("KeyE")
        check("into the bin", await ev("isleSave().bin") == [["lettuce", 4]])
        await ev(SLEEP)
        check("the bin pays overnight (4 x 28)", await ev("isleSave().sd") == sd0 + 112, await ev("isleSave().sd") - sd0)

        # the seed stand (summer now)
        await ev("(() => { isleGo('port', 452, 414, 'up'); ISLE.msg = null; })()")
        await page.keyboard.press("KeyE")
        check("the seed stand opens", await ev("!!ISLE.shop"))
        r = await ev("shopList().map(c => c.item.replace(/^s_/, ''))")
        check("it sells this season's seeds", "melon" in r and "lettuce" not in r and "kelp" in r, r)
        sd0 = await ev("isleSave().sd"); await page.keyboard.press("KeyE")
        r = await ev("[isleSave().sd, isleSave().inv.some(q => q && q[0] === shopList()[0].item)]")
        check("buying takes sand dollars", r[0] == sd0 - (await ev("shopList()[0].price")) and r[1], r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/shop.png")
        await page.keyboard.press("Escape")
        check("Escape closes the stand", await ev("ISLE.shop") is None)

        # forage: things wash up each morning, 10 a day, and you can pick them up
        r = await ev("isleSave().forage.items.length")
        check("24 things wash up (10 on the beaches, 6 in the woods, 8 on Shipwreck Beach and Gull Rock from part 8)", r == 24, r)
        r = await ev("""(() => { const f = isleSave().forage.items.find(q => q[0] === 'flats'); isleGo('flats', f[1], f[2] + 6, 'up'); ISLE.msg = null; return f[3]; })()""")
        await page.keyboard.press("KeyE")
        check("picking one up", await ev("isleSave().inv.some(q => q && q[0] === '%s')" % r) and await ev("isleSave().forage.items.length") == 23)

        # the can runs dry and fills at the garden barrel
        await ev("(() => { const s = isleSave(); s.water = 0; s.sel = 1; ISLE.px = 416; ISLE.py = 348; ISLE.dir = 'up'; })()")
        await page.keyboard.press("KeyE")
        check("the barrel fills the can", await ev("isleSave().water") == 30)

        # the bag: Tab, move the shell to the toolbar
        await page.keyboard.press("Tab")
        check("Tab opens the bag", await ev("!!ISLE.inv"))
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/bag.png")
        await ev("(() => { const s = isleSave(); s.inv[12] = ['pearl', 1]; s.inv[8] = null; ISLE.inv.sel = 12; })()")
        await page.keyboard.press("KeyE"); await ev("ISLE.inv.sel = 8"); await page.keyboard.press("KeyE")
        check("swapping moves things", await ev("[isleSave().inv[8], isleSave().inv[12]]") == [["pearl", 1], None])
        await page.keyboard.press("Escape")
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # a save from part 2 (no bag yet) gets the kit, with a message
        old = '{"dives": 80, "isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 0, "day": 4, "min": 600, "sd": 0, "intro": 1, "area": "port", "x": 0, "y": 0}}}'
        b, page, errs = await fresh(p, 390, 700, old)
        await page.evaluate("startIsland()")
        r = await page.evaluate("({ day: isleSave().day, sd: isleSave().sd, hoe: isleSave().inv[0][0], msg: ISLE.msg.pages[0] })")
        check("old island save: kit added, day kept", r["day"] == 4 and r["sd"] == 100 and r["hoe"] == "hoe" and "SHIPWRIGHT" in r["msg"], r)
        await page.evaluate("ISLE.msg = null"); await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/phone.png")
        box = await page.locator("#game").bounding_box()
        x0, y0 = await page.evaluate("tbGeo()")
        await page.mouse.click(box["x"] + (x0 + 1 * 18 + 8) / 240 * box["width"], box["y"] + (y0 + 8) / await page.evaluate("IH") * box["height"])
        check("tapping the toolbar picks a slot (phone)", await page.evaluate("isleSave().sel") == 1)
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
