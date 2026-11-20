"""The back room is gone (Nov 20, 2026); RENAME A FISH lives in the chip shop.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_backroom.py   (live database blocked)"""
import asyncio, os
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
SAVE = '{"coins":50,"dives":300,"seenHelp":true,"name":"KAD","tav":{"chips":5000},"sec":{"sleeper":true,"woke":true},"log":{"tuna":{"n":3,"rec":12},"squid":{"n":1,"rec":9}}}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backroom"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(n, ok, v=""):
    print(("PASS " if ok else "FAIL ") + n, "" if ok else v)
    if not ok: fails.append(n)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, tag in [(1440, 810, "pc"), (390, 700, "ph")]:
            page = await b.new_page(viewport={"width": w, "height": h})
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.route("**firebaseio**", lambda r: r.abort())
            await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r})")
            await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(300)
            ev = page.evaluate
            r = await ev("tavRows().map(x => x[2])")
            check(f"{tag}: no BACK ROOM in the tavern, even after beating the Sleeper", "vip" not in r, r)
            await ev("(() => { REEL.tavOpen(); S.overlay = 'tavern'; })()"); await page.wait_for_timeout(150)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_tavern.png"))
            i = await ev("SHOP_ROWS.findIndex(r => r[0] === 'rename')")
            check(f"{tag}: RENAME A FISH is in the chip shop", i >= 0, i)
            await ev(f"(() => {{ TAV.shopSel = {i}; S.overlay = 'chipshop'; }})()"); await page.wait_for_timeout(120)
            await page.screenshot(path=os.path.join(OUT, f"{tag}_chipshop_rename.png"))
            await ev(f"shopBuy({i})"); await page.wait_for_timeout(80)
            check(f"{tag}: it opens the rename screen without charging", await ev("S.overlay") == "rename" and await ev("REEL.store.tav.chips") >= 5000)
            await ev("window.prompt = () => 'CHUNK'; renameFish('tuna')")
            r = await ev("[REEL.store.tav.names && REEL.store.tav.names.tuna, nameOf('tuna')]")
            check(f"{tag}: renaming still costs 100 and shows in the log", r[0] == "CHUNK" and await ev("REEL.store.tav.chips") <= 4900, r)
            await page.keyboard.press("Escape"); await page.wait_for_timeout(80)
            check(f"{tag}: back from renaming goes to the chip shop", await ev("S.overlay") == "chipshop", await ev("S.overlay"))
            await ev("(() => { S.overlay = 'tables'; })()"); await page.wait_for_timeout(60)
            await ev("casinoOpen ? casinoOpen('c21') : 0"); await page.wait_for_timeout(60)
            check(f"{tag}: Catch 21 is the normal table", await ev("TAV.c21 && !TAV.c21.vip"))
            check(f"{tag}: no page errors", not errs, errs[:3])
            await page.close()
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")

asyncio.run(main())
