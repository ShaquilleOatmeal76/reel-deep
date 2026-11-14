"""How hard is the endgame Flipside? Plays runs with a good bot and an ok one and prints how often they catch themselves.
The target: a good player wins about 1 run in 5.
Usage (serve the game folder first: python3 -m http.server 8765 --bind 127.0.0.1):
  python3 test_flipside.py [runs] ['{"sense": 60, ...}' to try other FL_TUNE values] [lure index]"""
import asyncio, sys, json, os
from collections import Counter
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
TUNE = sys.argv[2] if len(sys.argv) > 2 else "{}"
LURE = int(sys.argv[3]) if len(sys.argv) > 3 else 0
BOT = open(os.path.dirname(os.path.abspath(__file__)) + '/flipside_bot.js').read()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for vw, vh, tag in ((390, 700, "phone"), (1440, 810, "wide")):
            pg = await (await b.new_context(viewport={"width": vw, "height": vh})).new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.route("**/*firebase*", lambda r: r.abort())
            await pg.goto("http://127.0.0.1:8765/index.html"); await pg.wait_for_function("window.REEL && window.REEL.S")
            await pg.evaluate("t => Object.assign(REEL.FL_TUNE, t)", json.loads(TUNE))
            for skill in ("good", "ok"):
                res = await pg.evaluate(f"(() => {{ const f = {BOT}; const out = []; for (let i = 0; i < {N}; i++) out.push(f('{skill}', {LURE})); return out; }})()")
                wins = sum(r[0] for r in res); causes = Counter(r[2] for r in res)
                print(f"{tag:5} {skill:4}: won {wins}/{N} ({wins*100//N}%)  avg reach {sum(r[1] for r in res)/N:.0f} m  avg catch {sum(r[3] for r in res)/N:.1f}  lunges/run {sum(r[5] for r in res)/N:.1f}  lunges/100m {100*sum(r[5] for r in res)/max(1,sum(r[1] for r in res)):.2f}  {dict(causes)}")
            if errs: print("errors", errs[:3])
        await b.close()
asyncio.run(main())
