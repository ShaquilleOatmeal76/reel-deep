"""Chips past a billion (Nov 20, 2026): every casino game, the dive bets and the tavern board.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_bignum.py   (the database is faked)
Screenshots of every betting screen with 5 billion chips go to tools/tests/bignum/."""
import asyncio, json, os
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":300,"seenHelp":true,"name":"KAD","tav":{"chips":5000000000,"stats":{"stack":5000000000,"win":1500000000,"fast":0,"hands":3,"derbies":0}},"sec":{"sleeper":true}}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bignum"); os.makedirs(OUT, exist_ok=True)
fails = []
GAMES = [  # name, setup, overlay, stake getter (from test_typebet)
    ["dive bet", "openBet()", "bet", "TAV.bet.stake"], ["catch 21", "c21New(false)", "c21", "TAV.c21.bet"], ["vip catch 21", "c21New(true)", "c21", "TAV.c21.bet"],
    ["derby", "derbyNew(0,false)", "derby", "TAV.derby.bet"], ["plinko", "plinkoOpen()", "plinko", "TAV.plinko.bet"], ["line snap", "snapOpen()", "snap", "CZ.snap.bet"],
    ["bigger", "bigOpen()", "bigger", "CZ.big.bet"], ["crown", "caOpen()", "crown", "CZ.ca.bet"], ["reels", "rdOpen()", "reel", "CZ.rd.bet"],
    ["wheel", "whOpen()", "wheel", "CZ.wh.bet"], ["treasure", "tdOpen()", "treasure", "CZ.td.bet"], ["net", "nhOpen()", "net", "CZ.nh.bet"],
]


def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)


async def main():
    posts, ok_rules = [], {"v": False}

    async def fake_db(route):                                # a fake database: the old rules refuse past 1,000,000 until "republished"
        req = route.request
        if req.method == "POST" and "/tavern/" in req.url:
            body = json.loads(req.post_data); posts.append(body)
            return await route.fulfill(status=200 if ok_rules["v"] or body["s"] <= 1000000 else 401, body="{}")
        if "/tavern/" in req.url:
            rows = {"a": {"n": "BIG", "s": 7654321098765, "t": 1}, "b": {"n": "KAD", "s": 5000000000, "t": 2}, "c": {"n": "SML", "s": 950000, "t": 3}, "d": {"n": "OLD", "s": 1000000, "t": 4}}
            return await route.fulfill(status=200, body=json.dumps(rows))
        return await route.fulfill(status=200, body="null")

    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, tag in [(1440, 810, "pc"), (390, 700, "ph")]:
            page = await b.new_page(viewport={"width": w, "height": h})
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r});")
            await page.route("**firebaseio**", fake_db)
            await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(300)
            ev = page.evaluate
            await ev("LB.url = 'https://test-board.firebaseio.com'")   # every request goes to fake_db
            if tag == "pc":
                r = await ev("[999, 9999, 12345, 456789, 1000000, 7890000, 1234567890, 5e12, 3.1e15, -2500000].map(n => fmtChips(n))")
                check("fmtChips: K, M, B, T, Q", r == ["999", "9999", "12.3K", "456K", "1M", "7.89M", "1.23B", "5T", "3.1Q", "-2.5M"], r)
                r = await ev("[9999999, 12345678].map(n => fmtChips(n, 1e7))")
                check("fmtChips shows the whole number under the room it's given", r == ["9999999", "12.3M"], r)
                r = await ev("[999, 45000, 150000, 2500000, 2.5e9, 999e9, 4e12].map(fmtChips3)")
                check("3-character stakes", r == ["999", "45K", ".1M", "2M", "2B", ".9T", "4T"] and all(len(x) <= 3 for x in r), r)
                r = await ev("['2500000', '2,500,000', '2.5M', '1b', '3T', ' 750k ', 'abc', ''].map(parseStake)")
                check("typed stakes: commas and K/M/B/T", r[:6] == [2500000, 2500000, 2500000, 1000000000, 3000000000000, 750000] and all(x != x for x in r[6:]), r)
                r = await ev("(() => { REEL.store.tav.chips = 5e9; return [stakeStep(10, STAKE_MAX), stakeStep(1e9, 1), stakeStep(1e9, -1), stakeStep(37, 1), stakeStep(123, -1)]; })()")
                check("ALL IN reaches 5 billion; +/- move big stakes in big steps; small steps unchanged", r == [5e9, 1.05e9, 9.95e8, 40, 100], r)
                # the typed box takes a billion
                await ev("(() => { REEL.store.tav.chips = 5e9; openBet(); TAV.bet.stake = stakeStep(TAV.bet.stake, STAKE_TYPE); })()"); await page.wait_for_timeout(100)
                await page.keyboard.press("Control+A"); await page.keyboard.type("2.5B"); await page.keyboard.press("Enter"); await page.wait_for_timeout(100)
                check("typing 2.5B in the bet box", await ev("TAV.bet.stake") == 2.5e9, await ev("TAV.bet.stake"))
                # money moves exactly
                r = await ev("""(() => { const q = REEL.store.tav; q.chips = 5e9; q.bet = null; openBet(); TAV.bet.ticks = []; TAV.bet.sel = 0; TAV.bet.stake = 2e9; const pays = TAV.bet.opts[0][2];
                  placeBet(); const after = q.chips; const i = BET_I[q.bet.k], f = BETS[i][4]; BETS[i][4] = () => true;
                  const m = settleBet({ total: 999, catch: [], sets: [], reached: 1158, bottom: true, bitten: 0 }); BETS[i][4] = f;
                  return [after, q.chips, Math.round(2e9 * pays) + 3e9, m[0], q.stats.win]; })()""")
                check("a 2-billion dive bet: stake taken, win paid exactly, shown short", r[0] == 3e9 and r[1] == r[2] and "B CHIPS" in r[3] and r[4] >= r[1] - 3e9, r)
                r = await ev("(() => { const q = REEL.store.tav; q.chips = 5e9; c21New(false); TAV.c21.bet = 2e9; c21Deal(); return q.chips; })()")
                check("catch 21 deals a 2-billion hand", r in (3e9, 3e9 + 2e9 * 2, 3e9 + 2e9 * 2.5, 3e9 + 2e9 * 3, 5e9), r)
                r = await ev("(() => { const q = REEL.store.tav; q.chips = 9e15; addChips(5e15, 'win'); return [q.chips === CHIP_TOP, Number.isSafeInteger(q.chips)]; })()")
                check("chips stop at the largest exact number", r == [True, True], r)
                # tavern board: a big best posts the real number, and only counts once the board takes it
                posts.clear()
                await ev("(() => { const q = REEL.store.tav; q.chips = 5e9; q.stats.stack = 5e9; q.stats.win = 0; q.posted = { stack: 3e9 }; q.bigPost = 0; q.postedAt = 0; tavPost(); })()")
                await page.wait_for_timeout(300)
                r = await ev("[REEL.store.tav.posted.stack, REEL.store.tav.bigPost]")
                check("old capped posts reset to 1M, real 5B posted, refused by old rules -> not marked posted", posts and posts[-1]["s"] == 5e9 and r == [1e6, 1], (posts, r))
                ok_rules["v"] = True; posts.clear()
                await ev("(() => { REEL.store.tav.postedAt = 0; tavPost(); })()"); await page.wait_for_timeout(300)
                check("after the new rules: posted and remembered", posts and posts[-1]["s"] == 5e9 and await ev("REEL.store.tav.posted.stack") == 5e9, posts)
                rules = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database.rules.json")))
                v = rules["rules"]["tavern"]["$board"]["$entry"][".validate"]
                check("database rules allow tavern scores up to 9,007,199,254,740,991", "<= 9007199254740991" in v)
            # screenshots: every betting screen with billions, then the tavern board
            for name, setup, ov, get in GAMES:
                await ev(f"(() => {{ REEL.store.tav.chips = 5432109876; {setup}; S.overlay = '{ov}'; {get} = 2345678901; }})()"); await page.wait_for_timeout(120)
                got = await ev(get)
                check(f"{tag} {name}: stake of 2.3 billion kept", got == 2345678901, got)
                await page.screenshot(path=os.path.join(OUT, f"{tag}_{name.replace(' ', '_')}.png"))
            await ev("(() => { REEL.store.tav.chips = 5432109876; TAV.board = 0; BOARDS.forEach(([k]) => tavLoad(k)); S.overlay = 'tavboard'; })()"); await page.wait_for_timeout(400)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_tavern_board.png"))
            await ev("(() => { S.overlay = 'tavern'; })()"); await page.wait_for_timeout(120)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_tavern.png"))
            check(f"{tag}: no page errors", not errs, errs[:3])
            await page.close()
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
