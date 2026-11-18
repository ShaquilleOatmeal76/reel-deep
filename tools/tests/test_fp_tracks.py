# FIN PRIX tracks: races a robot (small wobble, maxed fish) N times on every track and prints win rate, average place,
# lap times and how often the AI leaves the road. Serve the repo on port 8000 first. Nov 18, 2026 (12 tracks, part 2):
# every track finishes, AI off-road ~0%, laps 23-29 s, robot wins ~15-65% per track at 6 races (noisy).
import asyncio, sys
from playwright.async_api import async_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
BOT = {"noise": 0.08, "lag": 0.08, "lv": [10, 10, 10]}
JS = r"""([k, bot, n]) => { const out = []; let hits = 0, spins = 0, aiHits = 0;
  for (let i = 0; i < n; i++) { const r = FPX.race(bot, k); out.push(r); }
  const pl = out.map(r => r.place);
  return { win: pl.filter(p => p === 1).length / n, avg: pl.reduce((a, b) => a + b, 0) / n, time: out.reduce((a, r) => a + r.time, 0) / n, off: out.reduce((a, r) => a + r.aiOff, 0) / n, lap: out.reduce((a, r) => a + r.first, 0) / n / 3, segs: FPX.K.segs.length }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await (await b.new_context(viewport={"width": 800, "height": 450})).new_page()
        errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
        await page.route("**/*firebase*/**", lambda r: r.abort())
        await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.FPX && window.REEL && REEL.S")
        for k in (sys.argv[2].split(",") if len(sys.argv) > 2 else await page.evaluate("FPX.FP_ORDER")):
            r = await page.evaluate(JS, [k, BOT, N])
            print(f"{k:8s} segs {r['segs']:5d} win {r['win']:.0%} avg {r['avg']:.1f} you {r['time']:.0f}s  winner lap {r['lap']:.1f}s  ai off {r['off']:.1%}", flush=True)
        print("errors", errs[:3]); await b.close()
asyncio.run(main())
