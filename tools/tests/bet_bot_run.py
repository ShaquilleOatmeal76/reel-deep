"""Plays dives with tools/tests/dive_bot.js and saves one JSON record per dive, for pricing the dive bets (Nov 20, 2026).
Run from the repo root:  python3 -m http.server 8765 &  then
  python3 tools/tests/bet_bot_run.py OUT.json DIVES [JSON options for BOT.run]   (several pages run side by side)"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8765/index.html"
BOT = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dive_bot.js")).read()
SAVE = '{"coins":0,"dives":40,"seenHelp":true,"name":"BOT","tav":{"chips":100}}'


async def worker(b, n, opt, seed, w, h):
    page = await b.new_page(viewport={"width": w, "height": h})
    await page.route("**firebaseio**", lambda r: r.abort())
    await page.add_init_script(f"localStorage.setItem('reeldeep', {SAVE!r}); Math.random = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)({seed});")
    await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S"); await page.wait_for_timeout(200)
    await page.evaluate(BOT)
    await page.evaluate("cancelAnimationFrame && (window.requestAnimationFrame = () => 0)")   # stop the live loop: the bot drives
    out = []
    while len(out) < n:
        out += await page.evaluate(f"BOT.run({min(25, n - len(out))}, {json.dumps(opt)})")
    await page.close()
    return out


async def main():
    path, n = sys.argv[1], int(sys.argv[2])
    opts = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    par = int(os.environ.get("PAR", "6"))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        sizes = [(1440, 810), (390, 700)]                 # PC and phone see different amounts of ocean
        res = await asyncio.gather(*[worker(b, n // par, opts, 1000 + 7919 * k + hash(path) % 997, *sizes[k % 2]) for k in range(par)])
        await b.close()
    rows = [r for rr in res for r in rr]
    json.dump(rows, open(path, "w"))
    print(path, len(rows), "dives")

asyncio.run(main())
