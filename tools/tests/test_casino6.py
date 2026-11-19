"""Chip economy part 6 (Nov 18, 2026): the progressive jackpot, the weekly tournament, the database rules.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino6.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino6/."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "casino6"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


async def main():
    rules = json.load(open(os.path.join(HERE, "..", "..", "database.rules.json")))["rules"]
    c = rules.get("casino", {})
    check("rules: casino/rounds, casino/jackpot (indexed by t), casino/cup (indexed by s)",
          "rounds" in c and c.get("jackpot", {}).get(".indexOn") == ["t"] and c.get("cup", {}).get("$week", {}).get(".indexOn") == ["s"])
    check("rules: the old boards are untouched", all(k in rules for k in ("daily", "all", "saves", "tavern", "flip")))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        posts = []
        async def route(r):
            if r.request.method == "POST": posts.append(r.request.url)
            await r.abort()
        await ctx.route("**/*firebase*/**", route)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.store.name = 'KDB'; })()")

        # ---- jackpot
        r = await ev("""(() => { const S = CASINO.RD_STRIPS; let e = 0, n = 0; for (const a of S[0]) for (const b of S[1]) for (const c of S[2]) { e += CASINO.rdPays([a, b, c]); n++; } return e / n; })()""")
        check("reels alone pay 93.97% now (room for the jackpot)", abs(r - 0.9397) < 0.0005, r)
        r = await ev("(() => [CASINO.JP_CAP / (75 * CASINO.JP_ODDS), 5000 / (75 * CASINO.JP_ODDS)])()")
        check("jackpot adds 0.3% at the base pot, 3.3% at the cap: total 94.3-97.3%", abs(r[0] - 0.0333) < 0.001 and abs(r[1] - 0.00333) < 0.0005, r)
        r = await ev("""(() => { const q = REEL.tav(); q.jpWon = 0; q.jpLast = Date.now() - 4 * 3600000; const a = CASINO.jpPot(); q.jpLast = Date.now() - 1000 * 3600000; const b0 = CASINO.jpPot(); return [a, b0]; })()""")
        check("pot grows 250 an hour from 5,000 and stops at 50,000", abs(r[0] - 6000) <= 1 and r[1] == 50000, r)
        r = await ev("""(() => { const q = REEL.tav(); q.chips = 100; q.jpLast = Date.now() - 4 * 3600000; CASINO.GAME_OPEN.reel(); const c = CASINO.rd; c.win = 0; const pot = CASINO.jpPot(); CASINO.jpWin(c); return [q.chips - 100, pot, CASINO.jpPot(), REEL.store.titles.includes('megajack')]; })()""")
        check("hitting it pays the pot, resets it for everyone, MEGA JACKPOT", r[0] == r[1] and r[2] == 5000 and r[3], r)
        await page.wait_for_timeout(300)
        check("the win is posted to /casino/jackpot", any("/casino/jackpot" in u for u in posts), posts[-3:])
        r = await ev("""(() => { const keep = Math.random; let hits = 0; const c = CASINO.rd; REEL.tav().chips = 1e9; c.bet = 75;
            Math.random = () => 0; CASINO.rdSpin(); for (let k = 0; k < 40 && c.phase === 'spin'; k++) CASINO.rdTick(0.05); Math.random = keep; return c.msg; })()""")
        check("a spin can trigger the jackpot", r.startswith("JACKPOT"), r)

        # ---- tournament
        r = await ev("""(() => { const a = JSON.stringify(CASINO.cupDeck(3000, 4)), b0 = JSON.stringify(CASINO.cupDeck(3000, 4)), c = JSON.stringify(CASINO.cupDeck(3000, 5)), d = JSON.stringify(CASINO.cupDeck(3001, 4)); return [a === b0, a !== c, a !== d]; })()""")
        check("same week + hand = same cards for everyone; other hands and weeks differ", r == [True, True, True], r)
        r = await ev("""(() => { const q = REEL.tav(); q.cup = null; q.chips = 5000; CASINO.cupEnter(); const a = q.chips; CASINO.cupEnter(); return [a, q.chips, CASINO.cupData().in, CASINO.cupData().stack]; })()""")
        check("buy-in 1,000 once a week, 1,000-point stack", r == [4000, 4000, True, 1000], r)
        r = await ev("""(() => { const c = CASINO.cupData(); let guard = 0;
            while (!c.done && guard++ < 200) { if (!c.cur) CASINO.cupDeal(); const h = c.cur; if (h.phase === 'play') { if (REEL.c21Sum(h.you) < 15) CASINO.cupHit(false); else CASINO.cupStand(); }
              while (h.phase === 'dealer') CASINO.cupTick(0.5); if (h.phase === 'over') CASINO.cupNext(); }
            return [c.done, c.hand, c.stack >= 0]; })()""")
        check("a whole tournament plays out (25 hands or broke)", r[0] and (r[1] == 25 or r[1] < 25) and r[2], r)
        await page.wait_for_timeout(300)
        check("the final stack is posted to /casino/cup/<week>", any("/casino/cup/" in u for u in posts) or await ev("CASINO.cupData().stack === 0"), posts[-3:])
        r = await ev("""(() => { const q = REEL.tav(), last = CASINO.dealerWeek() - 1; q.cupClaim = 0; CASINO.CZ.cupB[last] = { rows: [['KDB', 4200], ['ABC', 3000], ['XYZ', 2000]], msg: '', at: Date.now() };
            CASINO.cupClaim(); return [REEL.store.titles.includes('tablechamp'), REEL.store.titles.includes('podium'), CASINO.decorData().own.includes('keg.3'), CASINO.DECOR_LIST.some(d => d[2] === 'TOURNEY CUP'), q.cupClaim === last]; })()""")
        check("last week's winner gets TABLE CHAMP, PODIUM and the cup for the bar (once)", all(r), r)
        r = await ev("(() => CASINO.DECOR_ALL.filter(d => d[3] === 0).every(d => d[2] === 'TOURNEY CUP'))()")
        check("the tourney cup is never for sale", r)

        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(150)
            await ev("(() => { REEL.tav().cup = null; CASINO.GAME_OPEN.cup(); })()"); await page.wait_for_timeout(120); await page.screenshot(path=OUT + "/lobby_%s.png" % tag)
            await ev("(() => { REEL.tav().chips = 5000; CASINO.cupEnter(); CASINO.cupDeal(); })()"); await page.wait_for_timeout(120); await page.screenshot(path=OUT + "/hand_%s.png" % tag)
            await ev("(() => { CASINO.GAME_OPEN.reel(); })()"); await page.wait_for_timeout(120); await page.screenshot(path=OUT + "/reel_%s.png" % tag)
            await ev("(() => { REEL.S.overlay = 'tables'; })()"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/tables_%s.png" % tag)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
