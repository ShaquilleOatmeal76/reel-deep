"""Driftwood Isle, part 8d: the lighthouse finale and the topside rewards (island.js, web_export.py).
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_isle_finale.py"""
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "isle_finale"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)

MSG = "(ISLE.msg ? ISLE.msg.pages.join(' | ') : '')"
SLEEP = "(() => { ISLE.msg = null; ISLE.list = null; isleSleep(false); })()"
YES = "(() => { const m = ISLE.msg; m.t = 9; m.i = m.pages.length - 1; m.sel = 0; isleMsgAdvance(); })()"
LH = "(() => { ISLE.msg = null; const o = ISLE.map.objs.find(q => q.k === 'lighthouse'); isleAct(o); return " + MSG + "; })()"


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
        await ev("startIsland()"); await ev("(() => { ISLE.msg = null; const s = isleSave(); s.day = 2; s.min = 700; s.inv = s.inv.map((q, i) => i < 7 ? q : null); s.inv.push(...Array(9).fill(null)); })()")

        # the new topside things exist and are appended
        r = await ev("""[['KEEPER\\'S CAP', 'hats'], ['PICKLES', 'pets'], ['DRIFTWOOD ISLE', 'flags'], ['SEA GLASS', 'flair'], ['ISLAND SKIFF', 'boats']].map(([n, k]) => { const i = DATA[k].indexOf(n); return i === DATA[k].length - 1 && !!DATA.atlas[(k === 'flair' ? 'flair' : k.slice(0, -1)) + i]; })""")
        check("five island cosmetics, last in their lists, with art", r == [True] * 5, r)
        r = await ev("[ISLE_TITLES.every(t => TITLES.some(q => q[0] === t[0])), ISLE_TITLES.every(t => SHOP_TITLE_IDS.includes(TITLES.findIndex(q => q[0] === t[0]))), SONG_I.map(i => SONGS[i][4].split(' ').length), SONGS[0][4].split(' ').length]")
        check("six titles in the title list; two songs the same length as the rest", r[0] and r[1] and r[2] == [r[3], r[3]], r)
        await ev("(() => { ISLE.awT = 0; REEL.simTick(1 / 60); })()")
        r = await ev("[REEL.store.titles.includes('islander'), songOwned(SONG_I[0])]")
        check("landing on the island: ISLANDER and the Island Waltz", r == [True, True], r)

        # the lighthouse waits for the Dreamer
        await ev("isleGo('point', 400, 230, 'up')")
        check("locked until the bottom of the caves", "BOTTOM OF THE CAVES" in await ev(LH))
        await ev("(() => { const s = isleSave(); s.cave.boss[5] = 1; s.flags.lightkey = 1; })()")
        r = await ev(LH)
        check("with the Dreamer beaten, Marlowe's key opens the door", "MARLOWE'S BRASS KEY" in r, r)
        r = await ev(LH)
        check("then it needs rebuilding", "DREAMSTONE" in r and "10000" in r, r)
        await ev("(() => { ISLE.msg = null; const s = isleSave(); s.sd = 20000; [['wood', 300], ['stone', 300], ['glass', 40], ['gold', 20], ['dreamstone', 3]].forEach(([k, n]) => invAdd(k, n)); const o = ISLE.map.objs.find(q => q.k === 'lighthouse'); isleAct(o); })()"); await ev(YES)
        check("rebuilding it", await ev("isleSave().rest.light") == "work")
        await ev(SLEEP)
        r = await ev(MSG)
        check("rebuilt the next morning", "LIGHTHOUSE IS RESTORED" in r, r[-160:])
        await ev("(() => { isleSave().min = 900; isleGo('point', 400, 230, 'up'); })()")
        check("can't light it in daylight", "AFTER DARK" in await ev(LH))

        # the finale
        await ev("(() => { isleSave().min = 1260; })()")
        r = await ev(LH)
        check("after dark: the finale", "THE LOST ANGLER" in r and "DRIFTWOOD ISLE IS HOME" in r, r[:80])
        await ev("(() => { ISLE.msg.i = 5; ISLE.msg.t = 9; })()"); await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/finale.png")
        r = await ev("[!!isleSave().flags.lit, REEL.store.titles.includes('lightkeeper'), songOwned(SONG_I[1]), REEL.store.own.hat.includes(DATA.hats.indexOf(\"KEEPER'S CAP\")), REEL.store.titles.includes('cavediver')]")
        check("lit: LIGHTKEEPER, CAVE DIVER, Keep the Light, the Keeper's Cap", r == [True] * 5, r)
        await ev("ISLE.msg = null"); await ev("(() => { ISLE.px = 420; ISLE.py = 300; })()"); await page.wait_for_timeout(300); await page.screenshot(path=OUT + "/beam.png")
        r = await ev("""(() => { const R = Math.random; Math.random = () => 0.01; const sp = pickFish('deep', isleSave()); Math.random = R; return sp; })()""")
        check("the Angler's Fish bites off the point at night", r == "anglersfish", r)
        await ev(SLEEP)
        r = await ev(MSG)
        check("next morning: Bram saw it, and a bottle from someone else", "SAW YOUR LIGHT" in r and "COME AND FIND US" in r, r[-200:])

        # the other rewards
        await ev("ISLE.msg = null")
        r = await ev("""(() => { const s = isleSave(); s.rest.dock = 'done'; folkRec('pickles').pts = 800; s.morphs.calicocarp = 1; isleAwards();
          return [REEL.store.own.boat.includes(DATA.boats.indexOf('ISLAND SKIFF')), REEL.store.own.pet.includes(DATA.pets.indexOf('PICKLES')), fpOwns('paint.calico'), REEL.store.own.flag.includes(DATA.flags.indexOf('DRIFTWOOD ISLE'))]; })()""")
        check("skiff boat, Pickles the pet, a FIN PRIX paint; not the flag yet", r == [True, True, True, False], r)
        r = await ev("""(() => { const s = isleSave(); Object.keys(RESTORE).forEach(b => s.rest[b] = 'done'); for (let i = 1; i <= 20; i++) s.pages[i] = 1; MORPHS.forEach(m => s.morphs[m[0]] = 1); FESTS.forEach(f => s.fest[f.id + '_prize'] = 1); folkRec('bram').pts = 1000; isleAwards();
          return [REEL.store.own.flag.includes(DATA.flags.indexOf('DRIFTWOOD ISLE')), REEL.store.own.flair.includes(DATA.flair.indexOf('SEA GLASS')), ['breeder', 'champion', 'heartisle'].map(t => REEL.store.titles.includes(t))]; })()""")
        check("every building: the flag; all pages: sea glass flair; breeder, champion, heart of the isle", r == [True, True, [True, True, True]], r)

        # back topside: the lighthouse shines on the horizon
        await ev("(() => { ISLE.msg = null; isleLeave(); REEL.S.overlay = null; })()"); await ev("(n => { for (let i = 0; i < n; i++) REEL.simTick(1 / 60); })(30)")
        await page.wait_for_timeout(400); await page.screenshot(path=OUT + "/topside.png")
        check("no page errors", not errs, errs)
        await b.close()
    print("\n" + ("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails)))

asyncio.run(main())
