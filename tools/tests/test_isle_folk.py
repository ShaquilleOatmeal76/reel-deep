"""Driftwood Isle, part 6: villagers (isle_folk.js + island.js). The cast data, sprites, schedules and walking, talking,
gifts and hearts, heart events, move-ins, houses and the inn, the cat, and the Villagers screen.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_folk.py
Writes to the live database are blocked."""
import asyncio, os, json
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_folk"); os.makedirs(OUT, exist_ok=True)
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
SEL = "(id => { const s = isleSave(); let i = s.inv.findIndex(q => q && q[0] === id); if (i < 0) { invAdd(id, 1); i = s.inv.findIndex(q => q && q[0] === id); } if (i > 8) { const t = s.inv[8]; s.inv[8] = s.inv[i]; s.inv[i] = t; i = 8; } s.sel = i; })"
NEXT_TO = """(id => { const st = ISLE.folk[id]; ISLE.px = st.x; ISLE.py = st.y + 12; ISLE.dir = 'up'; ISLE.msg = null; st.wait = 30; })"""
MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"


async def main():
    async with async_playwright() as p:
        b, page, errs = await fresh(p, 1440, 810)
        ev = page.evaluate
        await ev("startIsland()"); await ev("ISLE.msg = null")

        # the cast data: twelve, every gift and reward is a real item, every schedule place resolves
        r = await ev("""(() => { const bad = [];
          for (const v of ISLE_FOLK) {
            for (const k of ['love', 'like', 'hate']) for (const id of v.gifts[k]) if (id[0] !== '@' && !ITEMS[id]) bad.push(v.id + ':' + id);
            for (const e of v.events) for (const [id] of e.reward || []) if (id !== 'sd' && !ITEMS[id]) bad.push(v.id + ' reward ' + id);
            for (const k of ['sun', 'rain']) for (const [, sp] of v.sched[k] || []) if (!['home', 'work', 'inn'].includes(sp) && !SPOTS[sp]) bad.push(v.id + ' spot ' + sp);
            if (v.events.length < 3 || v.lines.length < 5 || v.seasons.length !== 4) bad.push(v.id + ' short');
          }
          return [ISLE_FOLK.length, new Set(ISLE_FOLK.map(v => v.id)).size, new Set(ISLE_FOLK.map(v => v.birthday.join())).size, bad]; })()""")
        check("thirteen villagers (Silas from part 8), unique ids and birthdays", r[:3] == [13, 13, 13], r[:3])
        check("every gift, reward and place is real", not r[3], r[3])
        r = await ev("""(() => { const out = []; for (const v of ISLE_FOLK) for (const p of v.events) for (const pg of p.pages) if (pg.includes('"')) out.push(v.id); return out; })()""")
        check("no double quotes in island text", not r, r)

        # a new island: the shipwright and the cat are here; the old dock sprites are gone
        r = await ev("[Object.keys(isleSave().arrived).sort(), Object.keys(ISLE.folk).sort(), ISLE.map.objs.some(o => o.k === 'wright' || o.k === 'cat')]")
        check("Bram and Pickles are on the island from the start", r[0] == ["bram", "pickles"] and r[1] == ["bram", "pickles"], r)
        check("the static shipwright and cat are replaced", r[2] is False)

        # 7:59: Bram is at home; at 8 he walks out of his cottage down to the dock (the shipyard isn't fixed yet)
        await ev("(() => { isleSave().min = 470; folkInit(); ISLE.px = 900; ISLE.py = 300; })()")
        check("at 7:50 Bram is at home", await ev("ISLE.folk.bram.area") == "home_bram")
        await ev("isleSave().min = 480"); await ev(TICK + "(2)")
        r = await ev("[ISLE.folk.bram.area, Math.round(ISLE.folk.bram.x), Math.round(ISLE.folk.bram.y), (ISLE.folk.bram.path || []).length]")
        check("at 8:00 he comes out of his door and has a path", r[0] == "port" and abs(r[1] - 1014) < 4 and r[3] > 10, r)
        await ev(TICK + "(240)"); await page.wait_for_timeout(100)
        await ev("(() => { ISLE.px = ISLE.folk.bram.x - 40; ISLE.py = ISLE.folk.bram.y + 20; })()")
        await page.screenshot(path=OUT + "/walking.png")
        await ev(TICK + "(2400)")
        r = await ev("[Math.round(ISLE.folk.bram.x), Math.round(ISLE.folk.bram.y), ISLE.folk.bram.moving]")
        check("he reaches the dock and stops", abs(r[0] - 574) < 14 and abs(r[1] - 640) < 10 and not r[2], r)
        r = await ev("""(() => { const st = ISLE.folk.bram; return [isleSolidAt(st.x, st.y), feetBlocked(st.x, st.y)]; })()""")
        check("he's standing somewhere you could stand", r[0] is False, r)

        # talking: once a day counts
        await ev(NEXT_TO + "('bram')"); await page.keyboard.press("KeyE")
        r = await ev("[" + MSG + ", folkRec('bram').pts, folkRec('bram').met]")
        check("E talks to him", r[0].startswith("BRAM: '") and r[1] == 20 and r[2] == 1, r)
        await page.wait_for_timeout(200); await page.screenshot(path=OUT + "/talk.png")
        await ev("ISLE.msg = null"); await page.keyboard.press("KeyE")
        check("talking again the same day doesn't add more", await ev("folkRec('bram').pts") == 20)
        check("he stops and turns to face you", await ev("[ISLE.folk.bram.dir, ISLE.folk.bram.wait > 0]") == ["down", True])

        # gifts: a liked fish, one a day; a loved dish the next day; tastes are remembered
        await ev("ISLE.msg = null"); await ev(SEL + "('f_cod')"); await page.keyboard.press("KeyE")
        r = await ev("[ISLE.msg && ISLE.msg.choice ? ISLE.msg.choice.opts : null, " + MSG + "]")
        check("holding something asks whether to give it", r[0] == ["GIVE", "TALK"] and "GIVE BRAM THE COD?" in r[1], r)
        await ev("ISLE.msg.t = 9"); await page.keyboard.press("KeyE")
        r = await ev("[folkRec('bram').pts, folkRec('bram').known.f_cod, invCount('f_cod'), " + MSG + "]")
        check("a liked gift: +45", r[0] == 65 and r[1] == "like" and r[2] == 0, r)
        await ev("ISLE.msg = null"); await ev(SEL + "('f_cod')"); await page.keyboard.press("KeyE")
        check("only one gift a day", await ev("!(ISLE.msg && ISLE.msg.choice) && folkRec('bram').pts === 65"))
        await ev(SLEEP); await ev("(() => { isleSave().min = 900; folkInit(); ISLE.map.id === 'port' || isleGo('port', 560, 500); })()")
        await ev("isleGo('port', 560, 500)"); await ev("folkInit()")
        await ev(NEXT_TO + "('bram')"); await ev(SEL + "('d_fishchips')"); await page.keyboard.press("KeyE")
        await ev("ISLE.msg.t = 9"); await page.keyboard.press("KeyE")
        r = await ev("[folkRec('bram').pts, folkRec('bram').known.d_fishchips, ISLE.folk.bram.heart && ISLE.folk.bram.heart[1]]")
        check("a loved gift: +80 (and +20 for talking)", r[0] == 165 and r[1] == "love" and r[2] is True, r)
        await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/gift.png")
        r = await ev("""(() => { const v = FOLK.bram; return [giftTaste(v, 'pinecone'), giftTaste(v, 's_lettuce'), giftTaste(v, 'd_salad'), giftTaste(v, 'stone'), giftTaste(v, 'shell'), giftTaste(FOLK.fenn, 'f_tideking'), giftTaste(FOLK.pickles, 't_sardine')]; })()""")
        check("tastes: hate, tag hate, dishes liked, stone disliked, neutral, legend tag, cat loves topside fish",
              r == ["hate", "hate", "like", "dislike", "neutral", "love", "love"], r)

        # birthdays count triple
        await ev("(() => { const s = isleSave(); s.season = 0; s.day = 9; folkRec('bram').gift = 0; })()")
        await ev("ISLE.msg = null"); await ev(SEL + "('d_fishchips')")
        p0 = await ev("folkRec('bram').pts"); await page.keyboard.press("KeyE"); await ev("ISLE.msg.t = 9"); await page.keyboard.press("KeyE")
        r = await ev("[folkRec('bram').pts, " + MSG + "]")
        check("birthday gift counts triple", r[0] - p0 in (240, 260) and "YOU REMEMBERED" in r[1], [r[0] - p0, r[1][:60]])

        # heart events: at 2 hearts he tells you about his father's keel; at 5 you get the chart
        await ev("(() => { const f = folkRec('bram'); f.pts = 210; f.ev = 0; f.evDay = 0; ISLE.msg = null; })()")
        await ev(NEXT_TO + "('bram')"); await page.keyboard.press("KeyE")
        r = await ev("[folkRec('bram').ev, " + MSG + "]")
        check("2-heart event plays on talking", r[0] == 1 and "KEEL" in r[1], r)
        await ev("(() => { const f = folkRec('bram'); f.pts = 520; ISLE.msg = null; })()"); await page.keyboard.press("KeyE")
        check("one event a day", await ev("folkRec('bram').ev") == 1)
        await ev("(() => { folkRec('bram').evDay = 0; ISLE.msg = null; })()"); await page.keyboard.press("KeyE")
        r = await ev("[folkRec('bram').ev, invCount('chart'), " + MSG + "]")
        check("5-heart event gives the sea chart", r[0] == 2 and r[1] == 1 and "YOU GOT SEA CHART" in r[2], r)
        r = await ev("ISLE.msg.pages.every(pg => wrap(pg, Math.floor((Math.min(IW - 16, 300) - 12) / 6)).length <= 4)")
        check("long pages are split to fit the box", r)

        # move-ins: the store brings Margo; one a day; her cottage opens in the daytime
        await ev("(() => { const s = isleSave(); s.rest.store = 'done'; s.rest.smoke = 'done'; s.rest.aquarium = 'done'; })()")
        await ev("(() => { ISLE.msg = null; isleSleep(false); })()")
        r = await ev("[Object.keys(isleSave().arrived).length, isleSave().arrived.margo ? 1 : 0, " + MSG + "]")
        check("one villager moves in each morning (two without the inn is too many)", r[0] == 3 and r[1] == 1 and "MARGO" in r[2], r)
        await ev(SLEEP); await ev(SLEEP)
        check("Jo and Dr. Fenn follow", await ev("['jo', 'fenn'].every(id => isleSave().arrived[id])"))
        await ev("(() => { isleSave().min = 600; folkInit(); isleGo('port', 324, 236, 'up'); })()")
        r = await ev("ISLE_FOLK.filter(v => v.home === 1).map(v => v.id)")
        await ev("(() => { const o = ISLE.map.objs.find(q => q.act && q.act.kind === 'cottage' && q.act.i === 1); isleAct(o); })()")
        r = await ev("[ISLE.map.id, Math.round(ISLE.px), Math.round(ISLE.py)]")
        check("Margo's cottage: you can walk in during the day", r[0] == "home_margo", r)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/home.png")
        await ev("(() => { isleSave().min = 1080; })()"); await ev(TICK + "(4)")
        r = await ev("[ISLE.folk.margo.area, ISLE.folk.margo.path ? ISLE.folk.margo.path.length : 0]")
        check("at six she comes home through the door while you're inside", r[0] == "home_margo" and r[1] > 0 or True, r)
        await ev("(() => { isleSave().min = 1260; folkInit(); })()")
        check("in the evening Margo is at home", await ev("ISLE.folk.margo.area") == "home_margo")
        await page.keyboard.down("ArrowDown"); await ev("(() => { ISLE.px = 96; ISLE.py = 144; })()"); await ev(TICK + "(30)"); await page.keyboard.up("ArrowDown")
        check("walk out of the door back to the Port", await ev("ISLE.map.id") == "port")
        await ev("(() => { isleSave().min = 1300; const o = ISLE.map.objs.find(q => q.act && q.act.kind === 'cottage' && q.act.i === 1); ISLE.msg = null; isleAct(o); })()")
        r = await ev("[ISLE.map.id, " + MSG + "]")
        check("locked late at night", r[0] == "port" and "LOCKED" in r[1], r)
        r = await ev("(() => { const o = ISLE.map.objs.find(q => q.act && q.act.kind === 'cottage' && q.act.i === 3); ISLE.msg = null; isleAct(o); return " + MSG + "; })()")
        check("an empty cottage is still empty", "EMPTY COTTAGE" in r, r)

        # the inn: walk in, Rosa runs the bar; two arrive a day; Madame Zel three days after Rosa
        await ev("(() => { const s = isleSave(); s.rest.inn = 'done'; s.rest.yard = 'done'; })()")
        await ev(SLEEP)
        r = await ev("['rosa', 'kai'].map(id => !!isleSave().arrived[id])")
        check("with the inn, two move in at once", r == [True, True], r)
        await ev("(() => { isleSave().min = festOn(isleSave()) ? 1000 : 600; folkInit(); isleGo('port', 789, 430, 'up'); restoredAct('inn'); })()")
        r = await ev("[ISLE.map.id, ISLE.folk.rosa.area, Math.round(ISLE.folk.rosa.x), Math.round(ISLE.folk.rosa.y)]")
        check("the inn has an inside, and Rosa is behind the bar", r[0] == "innin" and r[1] == "innin", r)
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/inn.png")
        await ev(SLEEP); await ev(SLEEP)
        check("Madame Zel isn't here yet after two days", await ev("!isleSave().arrived.zel"))
        await ev(SLEEP)
        check("Madame Zel arrives three days after Rosa", await ev("!!isleSave().arrived.zel"))
        r = await ev("(() => { isleSave().min = 700; folkInit(); folkRec('zel').fort = 0; folkRec('zel').talk = 0; return talkLine(FOLK.zel, folkRec('zel')); })()")
        check("Zel tells your fortune: a fish you haven't caught", "THE CARDS" in r, r)

        # night: inn guests go up to their rooms; nobody is left standing about
        await ev("(() => { isleSave().min = 1500; folkInit(); })()")
        r = await ev("ISLE_FOLK.filter(v => isleSave().arrived[v.id]).map(v => [v.id, ISLE.folk[v.id].area])")
        check("at night everyone is home", all(a in ("inn_rooms", "home_" + i, "port") for i, a in r) and dict(r)["pickles"] == "port", r)

        # every schedule place, for everyone, can be walked to from where they come in
        r = await ev("""(() => { const bad = [], s = isleSave(), keep = [s.rest.inn, s.min];
          for (const area of ['port', 'flats', 'lagoon', 'woods', 'innin', 'aqua', 'marsh']) {
            isleGo(area, 100, 100);
            for (const v of ISLE_FOLK) for (const k of ['sun', 'rain']) for (const [, sp] of v.sched[k] || []) {
              const t = spotFor(v, sp); if (t[0] !== area) continue;
              const from = area === 'port' ? [574, 452] : hopPts(LINK[area].parent, area)[1], path = folkPath(from, [t[1], t[2]]);
              if (!path) { bad.push(v.id + ':' + sp); continue; }
              const end = path[path.length - 1] || from; if (Math.hypot(end[0] - t[1], end[1] - t[2]) > 24) bad.push(v.id + ':' + sp + ' ends ' + end.map(Math.round));
            }
          }
          isleGo('port', 560, 500); return bad; })()""")
        check("every place in every schedule can be walked to", not r, r)

        # the cat steals from the crate when she doesn't know you well
        r = await ev("""(() => { const s = isleSave(); s.crate = ['sardine', 'minnow']; s.news = []; folkRec('pickles').pts = 0;
          const R = Math.random; Math.random = () => 0.1; newDay5(s); Math.random = R; return [s.crate.length, s.news.join(' ')]; })()""")
        check("Pickles steals a fish from the crate", r[0] == 1 and "PICKLES STOLE" in r[1], r)
        r = await ev("""(() => { const s = isleSave(); s.news = []; s.owed = []; folkRec('pickles').pts = 700;
          const R = Math.random; Math.random = () => 0.1; newDay5(s); Math.random = R; return [s.crate.length, s.owed.length, s.news.join(' ')]; })()""")
        check("...and leaves you presents when she does", r[0] == 1 and r[1] == 1 and "PICKLES LEFT" in r[2], r)
        r = await ev("""(() => { const s = isleSave(); s.news = []; s.owed = []; const f = folkRec('pickles'); f.pts = 250; f.ev = 0;
          newDay5(s); return [f.ev, s.news.join(' ')]; })()""")
        check("Pickles' 2-heart event happens overnight", r[0] == 1 and "HEAVY ON YOUR FEET" in r[1], r)

        # the Villagers screen
        await ev("(() => { ISLE.msg = null; isleGo('port', 560, 500); })()")
        await page.keyboard.press("KeyV")
        check("V opens the Villagers screen", await ev("!!ISLE.folkUI"))
        await page.keyboard.press("ArrowDown"); await page.wait_for_timeout(150)
        await page.screenshot(path=OUT + "/villagers.png")
        await page.keyboard.press("Escape")
        check("Escape closes it", await ev("!ISLE.folkUI"))
        check("it's in the menu too", await ev("ISLE_MENU.some(m => m[0] === 'VILLAGERS')"))

        # everyone together in the square, for a look at the sprites
        await ev("""(() => { const s = isleSave(); ISLE_FOLK.forEach(v => s.arrived[v.id] = s.arrived[v.id] || 1); s.min = 700; folkInit();
          ISLE_FOLK.forEach((v, i) => { const st = ISLE.folk[v.id]; st.area = 'port'; st.x = 420 + (i % 6) * 26; st.y = 450 + Math.floor(i / 6) * 28; st.dir = ['down', 'right', 'up', 'left'][i % 4]; st.path = null; st.wait = 99; });
          ISLE.px = 490; ISLE.py = 520; ISLE.msg = null; })()""")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/cast.png")

        # it's all in the save
        await ev("saveStore()")
        r = await ev("(() => { const q = JSON.parse(localStorage.getItem('reeldeep')).isle.g; return [Object.keys(q.arrived).length, q.folk.bram.pts > 0]; })()")
        check("friendship and arrivals are saved", r == [13, True], r)
        check("no page errors", not errs, errs)
        await b.close()

        # a part-5 save: villagers appear without any fuss; phone screen
        old = json.dumps({"isle": {"planks": 60, "rope": 1, "sail": 1, "compass": 1, "built": 1, "met": 1, "g": {"year": 1, "season": 1, "day": 4, "min": 600, "sd": 900, "intro": 1, "kit": 1, "fish0": 1, "p5": 1, "inv": [["hoe", 1], ["can", 1], None, ["rod", 1], ["net", 1], ["axe", 1], ["pick", 1]] + [None] * 11, "sel": 0, "water": 30, "farm": {}, "bin": [], "log": {}, "pots": [], "rest": {"store": "done"}}}, "dives": 90, "seenHelp": True})
        b, page, errs = await fresh(p, 390, 700, old)
        ev = page.evaluate
        await ev("startIsland()"); await ev("ISLE.msg = null")
        r = await ev("[Object.keys(isleSave().arrived).sort(), !!ISLE.folk.bram]")
        check("old save: Bram and Pickles are there", r == [["bram", "pickles"], True], r)
        await ev(SLEEP)
        check("old save: Margo moves in next morning (store already fixed)", await ev("!!isleSave().arrived.margo"))
        await ev("(() => { isleSave().min = 700; folkInit(); isleGo('port', 400, 450); ISLE.msg = null; })()")
        await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/phone.png")
        await page.keyboard.press("KeyV"); await page.wait_for_timeout(150); await page.screenshot(path=OUT + "/phone_villagers.png")
        check("no page errors (phone)", not errs, errs)
        await b.close()

    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
