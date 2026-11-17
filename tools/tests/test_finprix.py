# FIN PRIX difficulty check: robots drive your fish for N full races each and report win and podium rates.
# Serve the repo first:  python3 -m http.server 8000   then:  python3 tools/tests/test_finprix.py [races per bot]
# Bots: sharp (perfect line, maxed fish), good (tiny wobble and lag), sloppy (no drifting, big wobble), rookie (barely
# trained fish). Kade asked for "super hard": Nov 17, 2026 tuning (with personalities, FP_TUNE.skill 1.01) gave sharp/good ~20-30% wins, sloppy 0%.
# Tune FP_TUNE in finprix.js (skill, spread, lead) and re-run after changing the AI or the physics.
import asyncio, json, sys
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 20
BOTS = {"sharp": {"noise": 0.0, "lag": 0, "lv": [10, 10, 10]}, "good": {"noise": 0.08, "lag": 0.08, "lv": [10, 10, 10]}, "sloppy": {"noise": 0.25, "lag": 0.25, "lv": [10, 10, 10], "noDrift": True}, "rookie": {"noise": 0.1, "lag": 0.1, "lv": [2, 2, 2]}}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await (await b.new_context(viewport={"width": 1440, "height": 810})).new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.route("**/*firebase*/**", lambda r: r.abort())
        await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.FPX && window.REEL && REEL.S")
        for name, bot in BOTS.items():
            res = await page.evaluate("([bot, n]) => { const out = []; for (let i = 0; i < n; i++) out.push(FPX.race(bot)); return out; }", [bot, N])
            places = [r["place"] for r in res]
            print(f"{name:7s} win {places.count(1)/N:.0%}  podium {sum(1 for x in places if x <= 3)/N:.0%}  avg place {sum(places)/N:.1f}  time {sum(r['time'] for r in res)/N:.0f}s  ai off-road {sum(r['aiOff'] for r in res)/N:.1%}")
        print("errors", errs[:3]); await b.close()
asyncio.run(main())
