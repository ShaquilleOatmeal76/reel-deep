"""Driftwood Isle, part 2: the island engine (island.js). Arriving by raft, the island screen, walking and collisions,
the shack door, sleeping, passing out at 2 am, the tide over the flats, leaving, the save, and the phone screen.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle"); os.makedirs(OUT, exist_ok=True)
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
    await page.evaluate("""(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 80;
      Object.assign(REEL.store.isle, { planks: 60, rope: 1, sail: 1, compass: 1, built: 1 }); })()""")
    await page.wait_for_timeout(200)
    return b, page, errs

TICK = "(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })"


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        r = await ev("(() => { const wl = Math.round(-REEL.S.cam); return raftTap(isleX(), wl - 5, wl); })()")
        r = await ev("({ st: REEL.S.state, w: canvas.width, h: canvas.height, area: ISLE.map.id, msg: !!ISLE.msg })")
        check("tapping the island sails there", r == {"st": "isle", "w": 384, "h": 216, "area": "port", "msg": True}, r)
        await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/arrive.png")
        for _ in range(5): await page.keyboard.press("Space")
        check("intro pages advance", await ev("ISLE.msg") is None)
        check("intro only once", await ev("isleSave().intro") == 1)

        # walking: 1 second up the dock is about 5 tiles
        y0 = await ev("ISLE.py")
        await page.keyboard.down("ArrowUp"); await ev(TICK + "(60)"); await page.keyboard.up("ArrowUp")
        y1 = await ev("ISLE.py")
        check("walks about 80 px a second", 70 < y0 - y1 < 90, y0 - y1)
        check("the clock runs (~1.7 game minutes a second)", 361 < await ev("isleSave().min") < 364)

        # walls stop you: walk up into the store
        await ev("(() => { ISLE.px = 400; ISLE.py = 420; ISLE.target = null; })()")
        await page.keyboard.down("ArrowUp"); await ev(TICK + "(90)"); await page.keyboard.up("ArrowUp")
        r = await ev("ISLE.py")
        check("the store's wall stops you", 405 < r < 416, r)
        # water stops you
        await ev("(() => { ISLE.px = 300; ISLE.py = 600; isleSave().min = 700; })()")
        await page.keyboard.down("ArrowDown"); await ev(TICK + "(200)"); await page.keyboard.up("ArrowDown")
        r = await ev("(() => { const A = ISLE.map.A; return [ISLE.py, A.shore(ISLE.px) + TIDE_BAND]; })()")
        check("you can't walk into the sea", r[0] < r[1], r)

        # the tide: the same spot on the flats is walkable at low tide, not at high tide
        r = await ev("""(() => { const s = isleSave(), A = ISLE.map.A, x = 300, y = A.shore(x) + 30; const out = [];
          for (let m = DAY_START; m < DAY_END; m += 5) { s.min = m; out.push([tideLevel(s), isleSolidAt(x, y)]); }
          return [out.filter(o => o[0] > 0.9).every(o => o[1]), out.filter(o => o[0] < 0.1).every(o => !o[1])]; })()""")
        check("the tide covers the flats and goes out again", r == [True, True], r)

        # the shack: walk in through the door, out again
        await ev("(() => { isleSave().min = 600; ISLE.px = 151; ISLE.py = 418; ISLE.dir = 'up'; })()")
        await page.keyboard.down("ArrowUp"); await ev(TICK + "(40)"); await page.keyboard.up("ArrowUp")
        check("walking into the door goes inside", await ev("ISLE.map.id") == "shack")
        await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/shack.png")
        await page.keyboard.down("ArrowDown"); await ev(TICK + "(60)"); await page.keyboard.up("ArrowDown")
        check("and back out", await ev("ISLE.map.id") == "port")

        # bed: a new day
        await ev("(() => { isleDoor('shack'); ISLE.px = 34; ISLE.py = 82; ISLE.dir = 'up'; })()")
        await page.keyboard.press("KeyE")
        check("the bed asks first", await ev("ISLE.msg && ISLE.msg.choice && ISLE.msg.pages[0]") == "GO TO BED FOR THE NIGHT?")
        await ev(TICK + "(60)"); await page.keyboard.press("Enter")
        r = await ev("({ day: isleSave().day, min: isleSave().min, area: ISLE.map.id })")
        check("sleeping starts the next morning", r == {"day": 2, "min": 360, "area": "shack"}, r)
        await ev("ISLE.msg = null")

        # 2 am: you pass out and wake up in bed, no harm done; day 28 rolls into the next season
        await ev("(() => { isleGo('port', 300, 440); const s = isleSave(); s.day = 28; s.min = DAY_END - 0.5; })()")
        await ev(TICK + "(60)")
        r = await ev("({ day: isleSave().day, season: isleSave().season, area: ISLE.map.id, sd: isleSave().sd })")
        check("passing out at 2 am: next day, in bed, next season", r == {"day": 1, "season": 1, "area": "shack", "sd": 100}, r)
        check("passing out says so", "FELL ASLEEP" in (await ev("ISLE.msg.pages[0]")))
        await ev("ISLE.msg = null")

        # night and rain screenshots
        await ev("(() => { isleGo('port', 200, 440); const s = isleSave(); s.min = 1290; })()"); await ev(TICK + "(30)")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/night.png")
        r = await ev("(() => { const s = { year: 1, season: 0, day: 1 }, w = []; for (let d = 1; d <= 28; d++) { s.day = d; w.push(weatherOf(s)); } return w; })()")
        check("weather: first day sunny, some rain in spring", r[0] == "sun" and 2 <= r.count("rain") <= 14, r)

        # talking to the shipwright and the raft home
        await ev("(() => { ISLE.msg = null; isleGo('port', 572, 626); ISLE.dir = 'up'; isleSave().min = 700; })()")
        await page.keyboard.press("KeyE")
        check("the shipwright talks", (await ev("ISLE.msg && ISLE.msg.pages[0]") or "").startswith("'"))
        await page.keyboard.press("Space")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/dock.png")

        # the menu: go back to your boat
        await page.keyboard.press("Escape")
        check("Escape opens the menu", await ev("!!ISLE.menu"))
        await ev("ISLE.menu.sel = ISLE_MENU.findIndex(m => m[0].startsWith('GO BACK'))"); await page.keyboard.press("Enter")
        r = await ev("({ st: REEL.S.state, w: canvas.width, isle: !!ISLE })")
        check("going back: title screen, ocean canvas", r["st"] == "title" and r["w"] == await ev("REEL.width") and r["isle"] is False, r)
        saved = await ev("JSON.parse(localStorage.getItem('reeldeep')).isle.g")
        check("the island is saved", saved and saved["season"] == 1 and saved["intro"] == 1, saved)
        # coming back: no intro, a short welcome
        await ev("startIsland()")
        check("coming back skips the intro", (await ev("ISLE.msg.pages[0]")).startswith("DRIFTWOOD ISLE. SUMMER"))
        await ev("isleLeave()")
        check("no page errors (wide)", not errs, errs)
        await b.close()

        # phone
        b, page, errs = await fresh(p, 390, 700)
        await page.evaluate("startIsland()")
        r = await page.evaluate("[canvas.width, canvas.height]")
        check("phone screen is 240 wide", r[0] == 240 and 380 < r[1] < 440, r)
        await page.evaluate("ISLE.msg = null"); await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/phone.png")
        # tap to walk
        box = await page.locator("#game").bounding_box()
        y0 = await page.evaluate("ISLE.py")
        await page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.2)
        await page.evaluate(TICK + "(60)")
        check("tap to walk", await page.evaluate("ISLE.py") < y0 - 40)
        check("no page errors (phone)", not errs, errs)
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
