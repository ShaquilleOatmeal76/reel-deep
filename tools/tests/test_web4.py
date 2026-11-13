import asyncio, os
from playwright.async_api import async_playwright
OUT = os.path.dirname(os.path.abspath(__file__)) + "/w4"; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={"width": 390, "height": 700}, device_scale_factor=1)).new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto("file:///home/claude/reel-deep-web/index.html"); await page.wait_for_function("window.REEL && window.REEL.S")
        await page.evaluate("(() => { const st = REEL.store; st.seenHelp = true; REEL.S.overlay = null; Object.assign(st.eq, {char: 20, hat: 25, boat: 17, pet: 11, flag: 2, line: 11, flair: 12}); st.coins = 2300; st.name = 'KDB'; })()")
        await page.wait_for_timeout(400); await page.screenshot(path=f"{OUT}/title.png")
        box = await page.locator("#game").bounding_box()
        async def tap(lx, ly): await page.mouse.click(box["x"] + lx / 120 * box["width"], box["y"] + ly / 200 * box["height"])
        await tap(98, 160); await page.wait_for_timeout(200)
        for c in range(10):
            await page.screenshot(path=f"{OUT}/shop{c}.png")
            if c == 1: await tap(84, 113); await page.wait_for_timeout(150); await page.screenshot(path=f"{OUT}/shop1b.png")
            await tap(110, 8); await page.wait_for_timeout(120)
        await tap(60, 194); await tap(20, 174); await page.wait_for_timeout(200); await page.screenshot(path=f"{OUT}/tasks.png")
        print("tasks:", await page.evaluate("JSON.stringify(REEL.tasks())"))
        await tap(60, 194); await page.keyboard.press("Space"); await page.wait_for_timeout(800)
        for m in (500, 640, 780, 900, 1050, 1150):
            await page.evaluate("(m => { const S = REEL.S; S.hy = m * 6; S.cam = S.hy - 78; S.immune = 99; })(%d)" % m)
            await page.wait_for_timeout(500); await page.screenshot(path=f"{OUT}/d{m}.png")
        print("errors", errs)
        await b.close()
asyncio.run(main())
