import asyncio
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":60,"seenHelp":true,"tav":{"chips":1000}}'
fails = []
def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)
CZH = "(h => { const m = h.find(q => q[5] === STAKE_MAX); return [m[1] + m[3] / 2, m[2] + m[4] / 2]; })"
GAMES = [
  ["dive bet", "openBet()", "bet", "TAV.bet.stake", 1000, "wideMenus() ? (h => [h[1] + h[3] / 2, h[2] + h[4] / 2])(betWideHits().find(q => q[0] === 'max')) : [OX + 105, 133]"],
  ["catch 21", "c21New(false)", "c21", "TAV.c21.bet", 1000, "wideMenus() ? [WX() + 144, 144] : [OX + 63, 135]"],
  ["vip catch 21", "c21New(true)", "c21", "TAV.c21.bet", 1000, "wideMenus() ? [WX() + 144, 144] : [OX + 63, 135]"],
  ["derby", "derbyNew(0,false)", "derby", "TAV.derby.bet", 1000, f"wideMenus() ? {CZH}(derbyWideHits()) : [OX + 63, 22 + TAV.derby.racers.length * derbyLane(TAV.derby) + 4 + 34]"],
  ["plinko", "plinkoOpen()", "plinko", "TAV.plinko.bet", 1000, "(() => { const m = plButtons().find(q => q[0] === 'max'); return [m[1] + m[3] / 2, m[2] + m[4] / 2]; })()"],
  ["line snap", "snapOpen()", "snap", "CZ.snap.bet", 1000, f"{CZH}(snapHits())"],
  ["bigger", "bigOpen()", "bigger", "CZ.big.bet", 1000, f"{CZH}(bigHits())"],
  ["crown", "caOpen()", "crown", "CZ.ca.bet", 1000, f"{CZH}(caHits())"],
  ["reels", "rdOpen()", "reel", "CZ.rd.bet", 1000, f"{CZH}(rdHits())"],
  ["wheel", "whOpen()", "wheel", "CZ.wh.bet", 1000, f"{CZH}(whHits())"],
  ["treasure", "tdOpen()", "treasure", "CZ.td.bet", 1000, f"{CZH}(tdHits())"],
  ["net", "nhOpen()", "net", "CZ.nh.bet", 1000, f"{CZH}(nhHits())"],
]
async def main():
    async with async_playwright() as p:
        for w, h, tag in [(1440, 810, "pc"), (390, 700, "ph")]:
            b = await p.chromium.launch(); page = await b.new_page(viewport={"width": w, "height": h})
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.route("**firebaseio**", lambda r: r.abort())
            await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r})")
            await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(300)
            for name, setup, ov, get, exp, pos in GAMES:
                await page.evaluate(f"(() => {{ REEL.store.tav.chips = 1000; {setup}; S.overlay = '{ov}'; }})()")
                await page.wait_for_timeout(150)
                before = await page.evaluate(get)
                x, y = await page.evaluate(pos)
                r = await page.evaluate("(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left, c.top, c.width, c.height, LW, LH]; })()")
                px, py = r[0] + x * r[2] / r[4], r[1] + y * r[3] / r[5]
                await page.mouse.click(px, py); await page.wait_for_timeout(150)
                after = await page.evaluate(get)
                exp = await page.evaluate("REEL.store.tav.chips")   # MAX = all in (the bet panel may have added the daily chips)
                check(f"{tag} {name}: MAX {before} -> {after}", after == exp, (before, after, x, y))
                await page.screenshot(path=f"/tmp/{tag}_{name.replace(' ','_')}.png")
            # MAX respects your chips
            await page.evaluate("(() => { REEL.store.tav.chips = 32; openBet(); S.overlay = 'bet'; })()")
            await page.evaluate("TAV.bet.stake = stakeStep(TAV.bet.stake, STAKE_MAX)")
            check(f"{tag} max capped by chips (32 -> 32)", await page.evaluate("TAV.bet.stake") == 32)
            # no table limit (Nov 19, 2026): MAX = all your chips; +/- step with the size of the stake
            await page.evaluate("(() => { REEL.store.tav.chips = 123456; })()")
            r = await page.evaluate("[stakeStep(10, STAKE_MAX), stakeStep(95, 1), stakeStep(100, 1), stakeStep(100, -1), stakeStep(500, 1), stakeStep(2000, 1), stakeStep(2000, -1), stakeStep(10000, 1)]")
            check(f"{tag} all in + bigger steps for bigger stakes", r == [123456, 100, 125, 95, 600, 2500, 1900, 12500], r)
            check(f"no errors {tag}", not errs, errs); await b.close()
    print("ALL PASSED" if not fails else "FAILED: " + ", ".join(fails))
asyncio.run(main())
