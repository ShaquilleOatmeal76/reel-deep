"""Driftwood Isle, part 8b: the eight festivals (island.js).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_festivals.py
Writes to the live database are blocked."""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_fest"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


TICK = "(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })"
SEL = "(id => { const s = isleSave(); s.inv[8] = [id, 1]; s.sel = 8; })"
MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
CLEAR = "(() => { ISLE.msg = null; ISLE.list = null; })()"
DAY = "((se, d, m) => { const s = isleSave(); s.season = se; s.day = d; s.min = m; folkInit(); })"
BOOTH = "(() => { const f = festLive(isleSave()), [a, x, y] = festPlace(f); if (ISLE.map.id !== a) isleGo(a, x, y + 26, 'up'); ISLE.px = x; ISLE.py = y + 22; ISLE.dir = 'up'; ISLE.msg = null; })()"
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
        await ev("startIsland()"); await ev(CLEAR)
        await ev("(() => { const s = isleSave(); ['store', 'smoke', 'aquarium', 'yard'].forEach(b => s.rest[b] = 'done'); ['margo', 'jo', 'fenn', 'kai'].forEach(id => s.arrived[id] = 1); })()")

        r = await ev("[FESTS.length, FESTS.map(f => f.season).join(''), new Set(FESTS.map(f => f.season + ':' + f.day)).size, ISLE_FOLK.filter(v => FESTS.some(f => f.season === v.birthday[0] && f.day === v.birthday[1])).map(v => v.id)]")
        check("eight festivals, two a season, none on a birthday", r[0] == 8 and r[1] == "00112233" and r[2] == 8 and not r[3], r)
        r = await ev("(() => { const s = isleSave(); s.season = 0; s.day = 12; s.news = []; s.day = 12; newDay5(s); const a = s.news.join(' '); s.day = 13; s.news = []; newDay5(s); return [a, s.news.join(' ')]; })()")
        check("the day before: TOMORROW; on the day: TODAY with the time", "TOMORROW: THE TIDE FAIR" in r[0] and "TODAY: THE TIDE FAIR" in r[1] and "9:00" in r[1], r)
        check("festival weather is fine", await ev("weatherOf({ year: 1, season: 0, day: 13, min: 600 })") == "sun")

        # the Tide Fair: everyone gathers; show the judge something
        await ev(DAY + "(0, 13, 600)"); await ev("isleGo('port', 520, 560, 'up')"); await ev(TICK + "(1800)")
        r = await ev("folkHere().filter(v => !v.hermit).map(v => { const st = ISLE.folk[v.id], [a, x, y] = festPlace(festLive(isleSave())); return st.area === 'port' && Math.hypot(st.x - x, st.y - y) < 110; })")
        check("the villagers gather round the booth", all(r) and len(r) >= 5, r)
        await ev("(() => { ISLE.px = 520; ISLE.py = 540; ISLE.dir = 'up'; })()"); await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/fair.png")
        await ev(BOOTH); await ev(SEL + "('hoe')"); await page.keyboard.press("KeyE")
        check("the booth explains the show", "SHOW THE JUDGE" in await ev(MSG))
        await ev(CLEAR); await ev(SEL + "('pearl')"); await page.keyboard.press("KeyE"); await ev(YES)
        r = await ev("[isleSave().fest['fair:1'], invCount('f_ribbon'), " + MSG + "]")
        check("a pearl wins gold and the Blue Ribbon", "GOLD" in r[0] and r[1] == 1, r)
        await ev(CLEAR); await page.keyboard.press("KeyE")
        check("only once a year", "ALREADY" in await ev(MSG))

        # Kite Day: keep it in the wind
        await ev(CLEAR); await ev(DAY + "(0, 24, 700)"); await ev(BOOTH); await page.keyboard.press("KeyE"); await ev(YES)
        check("Kite Day starts the kite", await ev("!!ISLE.kite"))
        await ev(TICK + "(60)"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/kite.png")
        await ev("(() => { for (let i = 0; i < 1400 && ISLE.kite; i++) { ISLE.kite.y = ISLE.kite.band; ISLE.kite.v = 0; REEL.simTick(1 / 60); } })()")
        r = await ev("[!!ISLE.kite, isleSave().fest['kite:1'], invCount('f_kite')]")
        check("kite in the wind the whole time: gold and the prize kite", r[0] is False and "9" in r[1] and r[2] == 1, r)

        # the Derby: 90 seconds, inches count; derby carp only today
        await ev(CLEAR); await ev(DAY + "(1, 11, 600)"); await ev(BOOTH); await page.keyboard.press("KeyE"); await ev(YES)
        check("the derby clock starts", await ev("ISLE.contest && ISLE.contest.t") == 90)
        r = await ev("""(() => { const R = Math.random; Math.random = () => 0.05; const sp = pickFish('lake', isleSave()); Math.random = R; return sp; })()""")
        check("derby carp bite in the Lagoon on derby day", r == "derbycarp", r)
        r = await ev("""(() => { const s = Object.assign({}, isleSave(), { day: 12 }); const R = Math.random; let got = false; for (let i = 0; i < 300; i++) if (pickFish('lake', s) === 'derbycarp') got = true; return got; })()""")
        check("...and not the day after", r is False)
        await ev("(() => { logCatch('derbycarp', 1); logCatch('carp', 1); ISLE.card = null; })()")
        await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/derby.png")
        await ev("(() => { ISLE.contest.t = 0.01; })()"); await ev(TICK + "(3)")
        r = await ev("[!!ISLE.contest, isleSave().fest['derby:1'], invCount('f_cup')]")
        check("time up: big catch wins the Derby Cup", r[0] is False and "INCHES" in r[1] and r[2] == 1, r)

        # Lantern Night
        await ev(CLEAR); await ev(DAY + "(1, 25, 1300)"); await ev(BOOTH); await page.keyboard.press("KeyE"); await ev(YES)
        r = await ev("[!!ISLE.lanterns, isleSave().fest['lantern:1'], invCount('f_lantern')]")
        check("Lantern Night: lanterns on the sea, a paper lantern to keep", r[0] and r[1] and r[2] == 1, r)
        await ev("ISLE.msg = null"); await ev(TICK + "(120)"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/lanterns.png")
        r = await ev("""(() => { const R = Math.random; Math.random = () => 0.05; const sp = pickFish('sea', isleSave()); Math.random = R; return sp; })()""")
        check("lantern fish bite on Lantern Night (after 9 pm)", r == "lanternfish", r)

        # Salvage Day: dig the red Xs
        await ev(CLEAR); await ev(DAY + "(2, 16, 600)"); await ev(BOOTH); await page.keyboard.press("KeyE"); await ev(YES)
        await ev(SEL + "('hoe')")
        r = await ev("""(() => { const C = ISLE.contest; for (const d of C.spots.slice(0, 11)) { ISLE.px = d[0]; ISLE.py = d[1] + 4; ISLE.dir = 'up'; ISLE.msg = null; isleInteract(); } return C.n; })()""")
        check("Salvage Day: dig the marked spots", r == 11, r)
        await ev("ISLE.contest.t = 0.01"); await ev(TICK + "(3)")
        check("eleven finds wins the Ship's Bell", await ev("invCount('f_bell')") == 1)

        # the Harvest Supper: a dish, judged
        await ev(CLEAR); await ev(DAY + "(2, 27, 1100)"); await ev(BOOTH); await ev(SEL + "('pearl')"); await page.keyboard.press("KeyE")
        check("the supper wants a dish, not a pearl", "HOLD A DISH" in await ev(MSG))
        await ev(CLEAR); await ev(SEL + "('d_breakfast')"); await page.keyboard.press("KeyE"); await ev(YES)
        check("a dish on the table", "RIBBON" in await ev(MSG))

        # Ice Fishing Morning counts fish
        await ev(CLEAR); await ev(DAY + "(3, 8, 480)"); await ev(BOOTH); await page.keyboard.press("KeyE"); await ev(YES)
        await ev("(() => { for (let i = 0; i < 4; i++) logCatch('perch', 0.1); ISLE.card = null; ISLE.contest.t = 0.01; })()"); await ev(TICK + "(3)")
        check("ice fishing: four fish is silver", "SILVER" in await ev(MSG))

        # Midwinter: the secret friend
        await ev(CLEAR)
        await ev("(() => { const s = isleSave(); s.season = 3; s.day = 24; s.news = []; s.day = 25; newDay5(s); s.min = 700; folkInit(); })()")
        r = await ev("isleSave().secret")
        check("Midwinter morning: you drew a name", r and r["id"] in ["bram", "margo", "jo", "fenn", "kai"], r)
        await ev(BOOTH); await page.keyboard.press("KeyE")
        check("the booth tells you whose name", "YOU DREW" in await ev(MSG))
        r = await ev("""(() => { const s = isleSave(), id = s.secret.id, f = folkRec(id); f.gift = 0; f.pts = 0; f.talk = DAYN(s); s.inv[8] = ['shell', 1]; s.sel = 8; ISLE.msg = null; giveGift(FOLK[id], f); return [f.pts, isleSave().fest['midwinter:1'], (ISLE.msg ? ISLE.msg.pages.join(' ') : '')]; })()""")
        check("a gift to your secret friend counts four times, and you get one back", r[0] >= 180 and "SWAPPED" in r[1] and "MERRY MIDWINTER" in r[2], r)
        r = await ev("""(() => { const R = Math.random; Math.random = () => 0.05; const sp = pickFish('sea', isleSave()); Math.random = R; return sp; })()""")
        check("midwinter cod in the sea today", r == "midwintercod", r)
        check("festival fish all catchable on their day", await ev("['lanternfish', 'derbycarp', 'midwintercod'].every(id => FISH[id])"))
        check("no page errors", not errs, errs)
        await b.close()
    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
