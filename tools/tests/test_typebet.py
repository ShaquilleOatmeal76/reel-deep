"""Typed bets (Nov 19, 2026): tap the stake on any betting screen, type any whole number, Enter. + and - snap to the grid.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_typebet.py   (live database blocked)"""
import asyncio, os
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":300,"seenHelp":true,"tav":{"chips":1000},"sec":{"sleeper":true}}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "typebet"); os.makedirs(OUT, exist_ok=True)
fails = []
def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)
TYP = "(h => { const m = h.find(q => q[5] === STAKE_TYPE || q[0] === 'stakebox'); return [m[1] + m[3] / 2, m[2] + m[4] / 2]; })"
GAMES = [  # name, setup, overlay, getter, position of the amount (PC wide, phone narrow)
  ["dive bet", "openBet()", "bet", "TAV.bet.stake", f"wideMenus() ? {TYP}(betWideHits()) : [OX + 52, 133]"],
  ["catch 21", "c21New(false)", "c21", "TAV.c21.bet", f"wideMenus() ? {TYP}(c21WideHits()) : [OX + 26, 135]"],
  ["vip catch 21", "c21New(true)", "c21", "TAV.c21.bet", f"wideMenus() ? {TYP}(c21WideHits()) : [OX + 26, 135]"],
  ["derby", "derbyNew(0,false)", "derby", "TAV.derby.bet", f"wideMenus() ? {TYP}(derbyWideHits()) : [OX + 26, 22 + TAV.derby.racers.length * derbyLane(TAV.derby) + 4 + 34]"],
  ["plinko", "plinkoOpen()", "plinko", "TAV.plinko.bet", f"{TYP}(plButtons())"],
  ["line snap", "snapOpen()", "snap", "CZ.snap.bet", f"{TYP}(snapHits())"],
  ["bigger", "bigOpen()", "bigger", "CZ.big.bet", f"{TYP}(bigHits())"],
  ["crown", "caOpen()", "crown", "CZ.ca.bet", f"{TYP}(caHits())"],
  ["reels", "rdOpen()", "reel", "CZ.rd.bet", f"{TYP}(rdHits())"],
  ["wheel", "whOpen()", "wheel", "CZ.wh.bet", f"{TYP}(whHits())"],
  ["treasure", "tdOpen()", "treasure", "CZ.td.bet", f"{TYP}(tdHits())"],
  ["net", "nhOpen()", "net", "CZ.nh.bet", f"{TYP}(nhHits())"],
]
async def click(page, pos):
    x, y = await page.evaluate(pos)
    r = await page.evaluate("(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left, c.top, c.width, c.height, LW, LH]; })()")
    await page.mouse.click(r[0] + x * r[2] / r[4], r[1] + y * r[3] / r[5])
async def main():
    async with async_playwright() as p:
        for w, h, tag in [(1440, 810, "pc"), (390, 700, "ph")]:
            b = await p.chromium.launch(); page = await b.new_page(viewport={"width": w, "height": h})
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.route("**firebaseio**", lambda r: r.abort())
            await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r})")
            await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(300)
            for name, setup, ov, get, pos in GAMES:
                await page.evaluate(f"(() => {{ REEL.store.tav.chips = 1000; {setup}; S.overlay = '{ov}'; }})()"); await page.wait_for_timeout(120)
                await click(page, pos); await page.wait_for_timeout(120)
                opened = await page.evaluate("document.getElementById('stakeModal').classList.contains('open')")
                if opened:
                    if name == "reels": await page.screenshot(path=os.path.join(OUT, f"{tag}_modal.png"))
                    await page.keyboard.press("Control+A"); await page.keyboard.type("37"); await page.keyboard.press("Enter"); await page.wait_for_timeout(100)
                got = await page.evaluate(get)
                check(f"{tag} {name}: tap amount, type 37 -> {got}", opened and got == 37, (opened, got))
                if name == "reels": await page.screenshot(path=os.path.join(OUT, f"{tag}_reel_37.png"))
            # dive bets: typing more than 75 gives 75, and a bigger stake can't be placed
            await page.evaluate("(() => { REEL.store.tav.chips = 100000; openBet(); S.overlay = 'bet'; TAV.bet.stake = stakeStep(TAV.bet.stake, STAKE_TYPE, DIVE_MAX); })()")
            await page.wait_for_timeout(100); await page.keyboard.press("Control+A"); await page.keyboard.type("5000"); await page.keyboard.press("Enter")
            check(f"{tag} dive bet: typing 5000 gives the 75 max", await page.evaluate("TAV.bet.stake") == 75)
            r = await page.evaluate("(() => { TAV.bet.stake = 5000; const c = REEL.store.tav.chips; placeBet(); return [REEL.store.tav.chips === c, !REEL.store.tav.bet]; })()")
            check(f"{tag} dive bet: a stake over 75 is refused", r == [True, True], r)
            await page.evaluate("S.overlay = null")
            # clamps, cancel, all in, + / - grid
            r = await page.evaluate("""(() => { REEL.store.tav.chips = 500; rdOpen(); S.overlay = 'reel'; CZ.rd.bet = 10; return 0; })()""")
            await page.evaluate("CZ.rd.bet = stakeStep(CZ.rd.bet, STAKE_TYPE)"); await page.wait_for_timeout(100); await page.keyboard.type("99999"); await page.keyboard.press("Enter")
            check(f"{tag} more than your chips -> all your chips", await page.evaluate("CZ.rd.bet") == 500)
            await page.evaluate("CZ.rd.bet = stakeStep(CZ.rd.bet, STAKE_TYPE)"); await page.wait_for_timeout(100); await page.keyboard.type("0"); await page.keyboard.press("Escape")
            check(f"{tag} escape cancels", await page.evaluate("CZ.rd.bet") == 500)
            await page.evaluate("CZ.rd.bet = 37"); await page.evaluate("CZ.rd.bet = stakeStep(CZ.rd.bet, STAKE_TYPE)"); await page.click("#stakeAll")
            check(f"{tag} ALL IN button", await page.evaluate("CZ.rd.bet") == 500)
            r = await page.evaluate("[stakeStep(37, 1), stakeStep(37, -1), stakeStep(3, 1), stakeStep(1, -1), stakeStep(5, -1), stakeStep(123, 1), stakeStep(123, -1)]")
            check(f"{tag} +/- snap to the grid", r == [40, 35, 4, 1, 4, 125, 100], r)
            await page.evaluate("(() => { CZ.rd.bet = 37; REEL.store.tav.chips = 500; })()"); await page.evaluate("rdSpin()")
            check(f"{tag} a 37 spin takes 37", await page.evaluate("REEL.store.tav.chips") == 463)
            await click(page, f"{TYP}(rdHits())"); await page.wait_for_timeout(100)
            check(f"{tag} no typing mid-spin", not await page.evaluate("document.getElementById('stakeModal').classList.contains('open')"))
            check(f"no errors {tag}", not errs, errs); await b.close()
    print("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails))
asyncio.run(main())
