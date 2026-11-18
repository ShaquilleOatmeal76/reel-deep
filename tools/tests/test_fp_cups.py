# FIN PRIX cup difficulty: robot win / podium rates per cup at each cup's AI skill (FP_CUP_SKILL). Port 8000.
import asyncio
from playwright.async_api import async_playwright
BOTS = {"good": {"noise": 0.08, "lag": 0.08, "lv": [10, 10, 10]}, "sloppy": {"noise": 0.25, "lag": 0.25, "lv": [6, 6, 6]}}
JS = r"""([cup, bot, n]) => { const c = FPX.FP_CUPS.find(x => x.id === cup), base = FPX.FP_TUNE.skill; FPX.FP_TUNE.skill = {minnow: 0.985, reef: 0.995, deep: 1.005, abyss: 1.015}[cup]; const pl = [];
  for (let i = 0; i < n; i++) for (const k of c.tracks) pl.push(FPX.race(bot, k).place);
  FPX.FP_TUNE.skill = base; return [pl.filter(p => p === 1).length / pl.length, pl.filter(p => p <= 3).length / pl.length, pl.reduce((a, b) => a + b, 0) / pl.length]; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await (await b.new_context(viewport={"width": 800, "height": 450})).new_page()
        await page.route("**/*firebase*/**", lambda r: r.abort())
        await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.FPX && window.REEL && REEL.S")
        for cup in ("minnow", "reef", "deep", "abyss"):
            for name, bot in BOTS.items():
                w, pod, avg = await page.evaluate(JS, [cup, bot, 3])
                print(f"{cup:7s} {name:6s} win {w:.0%} podium {pod:.0%} avg {avg:.1f}", flush=True)
        await b.close()
asyncio.run(main())
