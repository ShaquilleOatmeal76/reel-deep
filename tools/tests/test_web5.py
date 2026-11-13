import asyncio, os
from playwright.async_api import async_playwright
OUT = os.path.dirname(os.path.abspath(__file__)) + "/w5"; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={"width": 390, "height": 700}, device_scale_factor=1)).new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto("file:///home/claude/reel-deep-web/index.html"); await page.wait_for_function("window.REEL && window.REEL.S")
        await page.evaluate("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; })()")
        await page.wait_for_timeout(500); await page.keyboard.press("Space"); await page.wait_for_timeout(800)
        for tag, depth, ids in (("shallow", 60, ["koi", "tuna"]), ("deep", 980, ["trueking", "frill"])):
            await page.evaluate("""((m, a, b) => { const S = REEL.S; S.sink = 0; S.hy = m * 6; S.cam = S.hy - 78; S.immune = 99;
                const k = Math.floor((S.hy + 40) / 72); const c = REEL.visible(); 
                const arr = S.chunks[k] || (S.chunks[k] = []); arr.length = 0;
                arr.push({id: a, x: 8, y: S.hy + 40, v: 0, ph: 0, lb: 300, tr: false});
                arr.push({id: b, x: 64, y: S.hy + 40, v: 0, ph: 1, lb: 80, tr: true}); })(%d, '%s', '%s')""" % (depth, ids[0], ids[1]))
            await page.wait_for_timeout(300); await page.screenshot(path=f"{OUT}/{tag}.png")
        await page.evaluate("(() => { const S = REEL.S; S.immune = 0; for (const [i, c] of Object.entries(S.chunks)) for (const f of c) if (f.id === 'trueking') { REEL.startFight(+i, f); return; } })()")
        await page.wait_for_timeout(600); await page.screenshot(path=f"{OUT}/fight_legend.png")
        await page.evaluate("(() => { const S = REEL.S; S.fight = null; S.state = 'down'; S.resume = 'down'; for (const [i, c] of Object.entries(S.chunks)) for (const f of c) if (f.id === 'frill') { REEL.startFight(+i, f); return; } })()")
        await page.wait_for_timeout(600); await page.screenshot(path=f"{OUT}/fight_trophy.png")
        await page.evaluate("(() => { const S = REEL.S; S.fight = null; S.catch = [['trueking', 620, false], ['frill', 400, true], ['tuna', 12, false]]; REEL.beginHaul(); })()")
        await page.wait_for_timeout(3600); await page.screenshot(path=f"{OUT}/haul.png")
        print("errors", errs); await b.close()
asyncio.run(main())
