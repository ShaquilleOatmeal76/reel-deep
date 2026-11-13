import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await (await b.new_context(viewport={"width": 1440, "height": 900})).new_page()
        errs = []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto("file:///home/claude/reel-deep-web/index.html"); await page.wait_for_function("window.REEL && window.REEL.S")
        await page.wait_for_timeout(400)
        await page.keyboard.press("ArrowRight"); await page.keyboard.press("KeyD"); print("lure after right, D:", await page.evaluate("REEL.S.lure"))
        await page.keyboard.press("Space"); await page.wait_for_timeout(600)
        x0 = await page.evaluate("REEL.S.hx")
        await page.keyboard.down("KeyA"); await page.wait_for_timeout(350); await page.keyboard.up("KeyA"); x1 = await page.evaluate("REEL.S.hx")
        await page.keyboard.down("ArrowRight"); await page.wait_for_timeout(500); await page.keyboard.up("ArrowRight"); x2 = await page.evaluate("REEL.S.hx")
        await page.keyboard.down("Shift"); await page.keyboard.down("KeyD"); await page.wait_for_timeout(200); x3 = await page.evaluate("REEL.S.hx"); await page.keyboard.up("KeyD"); await page.keyboard.up("Shift")
        await page.wait_for_timeout(120); x4 = await page.evaluate("REEL.S.hx"); await page.wait_for_timeout(120); x5 = await page.evaluate("REEL.S.hx")
        print("state", await page.evaluate("REEL.S.state"), "x:", [round(v) for v in (x0, x1, x2, x3, x4, x5)], "pulses left", await page.evaluate("REEL.S.pulses"), "of", await page.evaluate("DATA.lures[REEL.S.lure][5]"))
        await page.screenshot(path="/home/claude/reel-deep-desktop.png")
        print("canvas box", await page.locator("#game").bounding_box(), "body bg", await page.evaluate("document.body.style.background"), "errors", errs)
        await b.close()
asyncio.run(main())
