"""How hard is the Sleeper? Plays it with a careful bot and a sloppy one and prints win rates.
Usage: python3 test_sleeper.py [fights] ['{"tent": [...], ...}' to try other SL_TUNE values]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60
TUNE = sys.argv[2] if len(sys.argv) > 2 else "{}"
import os
HERE = os.path.dirname(os.path.abspath(__file__))
BOT = open(HERE + '/sleeper_bot.js').read()   # serve the game folder first: python3 -m http.server 8765 --bind 127.0.0.1
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vw, vh, tag in ((390, 700, "phone"), (1440, 810, "wide")):
            pg = await (await b.new_context(viewport={"width": vw, "height": vh})).new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.route("**/*firebase*", lambda r: r.abort())
            await pg.goto("http://127.0.0.1:8765/index.html"); await pg.wait_for_function("window.REEL && window.REEL.S")
            await pg.evaluate("t => Object.assign(REEL.SL_TUNE, t)", json.loads(TUNE))
            for skill in ("good", "hug", "bad"):
                res = await pg.evaluate(f"(() => {{ const f = {BOT}; const out = []; for (let i = 0; i < {N}; i++) out.push(f('{skill}')); return out; }})()")
                wins = sum(r[0] for r in res); ph = [sum(1 for r in res if r[1] >= k) for k in (2, 3)]  # fights that got to phase 2, and to phase 3
                print(f"{tag:5} {skill:4}: won {wins}/{N} ({wins*100//N}%), reached phase 2: {ph[0]}, phase 3: {ph[1]}, avg hits {sum(r[2] for r in res)/N:.1f}, avg {sum(r[3] for r in res)/N:.0f}s")
                print("   hits taken by cause:", await pg.evaluate("JSON.stringify(window.CAUSES||{})")); await pg.evaluate("window.CAUSES={}")
            if errs: print("errors", errs[:3])
        await b.close()
asyncio.run(main())
