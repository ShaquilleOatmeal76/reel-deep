"""Driftwood Isle, part 9: shack upgrades, wardrobe, radio, Bram at the Rusty Hook, shared aquariums and the Best Island
board (island.js, database.rules.json). The shared database is faked in memory here.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_finish.py"""
import asyncio, os, json, re
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_finish"); os.makedirs(OUT, exist_ok=True)
fails = []
DB = {}


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def fake_db(route):                     # /aquarium/<code>.json PUT/GET, /island.json POST/GET
    req = route.request; path = re.sub(r"^https?://[^/]+", "", req.url).split("?")[0]
    if req.method in ("PUT", "POST"):
        key = path if req.method == "PUT" else path + "#" + str(len(DB))
        if req.method == "PUT" and key in DB: await route.fulfill(status=401, body="{}"); return
        DB[key] = json.loads(req.post_data); await route.fulfill(status=200, content_type="application/json", body="{}"); return
    if path == "/island.json": await route.fulfill(status=200, content_type="application/json", body=json.dumps({k: v for k, v in DB.items() if k.startswith("/island.json#")})); return
    await route.fulfill(status=200, content_type="application/json", body=json.dumps(DB.get(path)))

MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
CHOOSE = "(k => { const m = ISLE.msg; m.t = 9; m.i = m.pages.length - 1; m.sel = k; isleMsgAdvance(); })"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810}, device_scale_factor=1)
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        await ctx.route("**/aquarium/**", fake_db); await ctx.route("**/island.json*", fake_db)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("""(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 80; REEL.store.name = 'KAD'; Object.assign(REEL.store.isle, { planks: 60, rope: 1, sail: 1, compass: 1, built: 1 }); })()""")
        await ev("startIsland()"); await ev("(() => { ISLE.msg = null; const s = isleSave(); s.min = 700; s.sd = 50000; s.inv = s.inv.map((q, i) => i < 7 ? q : null); s.inv.push(...Array(9).fill(null)); })()")

        # the shack: wardrobe and radio from the start
        await ev("isleDoor('shack')")
        r = await ev("[ISLE.map.id, ISLE.map.A.w, ['wardrobe', 'radio', 'stove'].map(k => ISLE.map.objs.some(o => o.k === k))]")
        check("the shack has a wardrobe and a radio", r == ["shack", 12, [True, True, True]], r)
        await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/shack0.png")
        # the wardrobe: your topside hat and pet show on the island
        await ev("(() => { REEL.store.own.hat.push(3); REEL.store.own.pet.push(3); REEL.store.eq.hat = 0; REEL.store.eq.pet = 0; isleAct(ISLE.map.objs.find(o => o.k === 'wardrobe')); })()")
        await ev("(() => { ISLE.list.sel = 1; listPick(); ISLE.list.sel = 2; listPick(); })()")
        r = await ev("[REEL.store.eq.hat, REEL.store.eq.pet, listRows()[1].name]")
        check("the wardrobe changes your hat and pet", r[0] == 3 and r[1] == 3 and "CROWN" in r[2], r)
        await ev("(() => { ISLE.list = null; isleGo('port', 400, 450, 'down'); })()"); await ev("(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })(30)")
        r = await ev("[!!ISLE.pet, ISLE.pet && ISLE.pet.area]")
        check("your pet follows you on the island", r == [True, "port"], r)
        await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/hatpet.png")
        # the radio
        await ev("(() => { isleDoor('shack'); isleAct(ISLE.map.objs.find(o => o.k === 'radio')); })()")
        r = await ev("listRows().map(q => q.name)")
        check("the radio lists songs you own", r[0] == "OFF" and "ISLAND WALTZ" in r, r)
        await ev("(() => { ISLE.list.sel = listRows().findIndex(q => q.name === 'ISLAND WALTZ'); listPick(); ISLE.list = null; })()")
        check("...and plays one", await ev("ISLE.radio === SONG_I[0]"))

        # shack upgrades at the shipyard, one after another
        await ev("(() => { isleSave().rest.yard = 'done'; ISLE.list = { kind: 'yard', sel: 0, top: 0 }; })()")
        r = await ev("listRows().map(q => q.name)")
        check("only the first shack upgrade is offered", "BIGGER SHACK" in r and "SHACK KITCHEN" not in r and "SECOND ROOM" not in r, r)
        await ev("(() => { invAdd('wood', 650); invAdd('stone', 230); invAdd('iron', 10); invAdd('glass', 10); invAdd('gold', 5); for (const n of ['BIGGER SHACK', 'SHACK KITCHEN', 'SECOND ROOM']) { ISLE.list = { kind: 'yard', sel: listRows().findIndex(q => q.name === n), top: 0 }; listPick(); } ISLE.list = null; })()")
        r = await ev("[shackTier(), !!ISLE.maps.shack]")
        check("all three upgrades bought; the shack is rebuilt", r == [3, False], r)
        await ev("(() => { isleGo('port', 151, 416, 'up'); isleDoor('shack'); })()")
        r = await ev("[ISLE.map.A.w, ISLE.map.A.h, ['counter', 'fridge', 'idoor', 'wardrobe'].map(k => ISLE.map.objs.some(o => o.k === k)), isleSolidAt(ISLE.px, ISLE.py)]")
        check("a bigger shack with a kitchen, fridge and a door to the second room", r == [18, 12, [True, True, True, True], False], r)
        await page.wait_for_timeout(250); await page.screenshot(path=OUT + "/shack3.png")
        await ev("isleAct(ISLE.map.objs.find(o => o.k === 'counter'))")
        check("the kitchen cooks every recipe", await ev("ISLE.list.kind === 'cook' && ISLE.list.where === 'smoke'"))
        await ev("(() => { ISLE.list = null; isleAct(ISLE.map.objs.find(o => o.k === 'fridge')); })()")
        check("the fridge is storage", await ev("!!ISLE.chest && chestSlots().length === 18"))
        await ev("(() => { ISLE.chest = null; isleAct(ISLE.map.objs.find(o => o.k === 'idoor')); })()")
        check("through to the second room", await ev("ISLE.map.id") == "shack2")
        await page.keyboard.down("ArrowDown"); await ev("(() => { ISLE.px = 96; ISLE.py = 144; })()"); await ev("(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })(30)"); await page.keyboard.up("ArrowDown")
        r = await ev("[ISLE.map.id, isleSolidAt(ISLE.px, ISLE.py)]")
        check("and back into the shack", r == ["shack", False], r)
        await ev("(() => { ISLE.msg = null; isleSleep(false); ISLE.msg = null; })()")
        check("bed still works in the bigger shack", await ev("ISLE.map.id === 'shack' && !isleSolidAt(ISLE.px, ISLE.py + 30)"))

        # shared aquariums
        await ev("(() => { const s = isleSave(); s.rest.aquarium = 'done'; ['minnow', 'sardine', 'koi'].forEach(id => s.donated[id] = 1); s.morphs.calicocarp = 1; s.min = 700; isleGo('aqua', 160, 160, 'up'); })()")
        await ev("(() => { ISLE.msg = null; isleAct(ISLE.map.objs.find(o => o.k === 'plaque')); })()")
        check("the plaque offers SHARE and VISIT", await ev("ISLE.msg.choice.opts") == ["SHARE", "VISIT", "DONE"])
        await ev(CHOOSE + "(0)"); await page.wait_for_timeout(500)
        r = await ev("[isleSave().aquaCode, " + MSG + "]")
        code = r[0]
        check("sharing gives a six-letter code", code and len(code) == 6 and "YOUR AQUARIUM CODE" in r[1], r)
        stored = DB.get("/aquarium/" + (code or "") + ".json")
        check("what's shared: name, donations, morphs", stored and stored["n"] == "KAD" and set(stored["d"].split(",")) == {"minnow", "sardine", "koi"} and stored["m"] == "calicocarp", stored)
        DB["/aquarium/FRND23.json"] = {"n": "ZED", "d": "minnow,tuna,marlin,shark", "m": "inkkoi", "t": 1}
        page.once("dialog", lambda d: asyncio.ensure_future(d.accept("frn-d23")))
        await ev("(() => { ISLE.msg = null; isleAct(ISLE.map.objs.find(o => o.k === 'plaque')); })()"); await ev(CHOOSE + "(1)"); await page.wait_for_timeout(600)
        r = await ev("[ISLE.visit && ISLE.visit.n, ISLE.visit && ISLE.visit.d.size, " + MSG + "]")
        check("visiting a friend's aquarium by code", r[0] == "ZED" and r[1] == 4 and "ZED'S AQUARIUM" in r[2], r)
        await ev("ISLE.msg = null"); await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/visit.png")
        await ev("(() => { isleAct(ISLE.map.objs.find(o => o.k === 'donate')); })()")
        check("you can't donate in a friend's aquarium", "DONATE AT YOUR OWN" in await ev(MSG))
        await ev("(() => { ISLE.msg = null; isleGo('port', 598, 416, 'down'); })()")
        check("leaving ends the visit", await ev("ISLE.visit") is None)
        page.once("dialog", lambda d: asyncio.ensure_future(d.accept("ZZZ-Z22")))
        await ev("(() => { isleGo('aqua', 160, 160, 'up'); ISLE.msg = null; isleAct(ISLE.map.objs.find(o => o.k === 'plaque')); })()"); await ev(CHOOSE + "(1)"); await page.wait_for_timeout(500)
        check("an unknown code", "NO AQUARIUM HAS THAT CODE" in await ev(MSG))

        # the Best Island board
        await ev("(() => { ISLE.msg = null; isleGo('port', 310, 440, 'up'); isleAct(ISLE.map.objs.find(o => o.k === 'board')); })()")
        r = await ev("[" + MSG + ", islandScore()]")
        check("the board shows your island score", ("SCORES " + str(r[1])) in r[0] and r[1] > 0, r)
        await ev(CHOOSE + "(0)"); await page.wait_for_timeout(500)
        posted = [v for k, v in DB.items() if k.startswith("/island.json#")]
        check("posting to the Best Island board", posted and posted[0]["n"] == "KAD" and posted[0]["s"] > 0, posted)
        DB["/island.json#x"] = {"n": "ZED", "s": 99999, "t": 1}
        await ev("(() => { ISLE.msg = null; isleAct(ISLE.map.objs.find(o => o.k === 'board')); })()"); await ev(CHOOSE + "(1)"); await page.wait_for_timeout(500)
        r = await ev("[ISLE.list && ISLE.list.kind, listRows().map(q => q.name)]")
        check("the top 10, best first", r[0] == "board" and r[1][0].startswith("1. ZED") and any("KAD" in n for n in r[1]), r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/board.png")
        await ev("(() => { ISLE.list = null; REEL.store.name = ''; ISLE.msg = null; isleAct(ISLE.map.objs.find(o => o.k === 'board')); })()"); await ev(CHOOSE + "(0)"); await page.wait_for_timeout(300)
        check("no name: told to set one topside", "PUT YOUR NAME" in await ev(MSG))

        # the save stays small: old regrowth timers are forgotten
        r = await ev("(() => { const s = isleSave(); s.cut = { a: -5, b: -1, c: DAYN(s) + 5 }; s.news = []; newDay5(s); return Object.keys(s.cut); })()")
        check("expired regrowth timers are dropped each morning", r == ["c"], r)

        # topside: Bram at the Rusty Hook, island trophies on the bar
        await ev("(() => { const s = isleSave(); s.cave.boss[1] = 1; s.fest.derby_prize = 1; s.flags.lit = 3; ISLE.msg = null; isleLeave(); REEL.S.overlay = 'tavern'; })()")
        await ev("(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })(10)"); await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/tavern.png")
        check("the tavern draws with the island additions", await ev("!!decorDraw.isle"))
        r = json.load(open(os.path.join(os.path.dirname(OUT), "..", "..", "database.rules.json")))["rules"]
        check("database rules: island board, aquariums, saves up to 40000", "island" in r and "aquarium" in r and "40000" in r["saves"]["$code"][".validate"])
        check("no page errors", not errs, errs)
        await b.close()
    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
