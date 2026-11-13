import asyncio, os
from playwright.async_api import async_playwright
OUT = os.path.dirname(os.path.abspath(__file__)) + "/w3"; os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for tag, vw, vh in (("n", 390, 700), ("w", 1280, 720)):
            page = await (await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)).new_page()
            errs = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); page.on("pageerror", lambda e: errs.append(str(e)))
            await page.goto("file:///home/claude/reel-deep-web/index.html"); await page.wait_for_function("window.REEL && window.REEL.S")
            await page.evaluate("(() => { const st = REEL.store; st.seenHelp = true; REEL.S.overlay = null; st.eq.char = 4; st.eq.hat = 4; st.eq.boat = 4; st.eq.flair = 1; st.eq.line = 5; st.eq.hook = 6; st.name = 'KDB'; st.coins = 340; })()")
            await page.wait_for_timeout(400); await page.screenshot(path=f"{OUT}/{tag}_title.png")
            await page.keyboard.press("Space"); await page.wait_for_timeout(2500)
            # force a trophy fight, then a legendary one
            for name, pick in (("trophy", "f.id !== 'jelly'"), ("legend", "f.id !== 'jelly'")):
                await page.evaluate("""(() => { const v = REEL.visible().filter(([i, f]) => %s && f.y > REEL.S.hy); const [i, f] = v[0]; %s REEL.startFight(i, f); })()""" % (pick, "f.tr = true; f.lb = 60;" if name == "trophy" else "f.id = 'megalodon'; f.lb = 500;"))
                await page.wait_for_timeout(700); await page.screenshot(path=f"{OUT}/{tag}_fight_{name}.png")
                for _ in range(40):
                    st = await page.evaluate("REEL.S.state")
                    if st != "fight": break
                    ok = await page.evaluate("(() => { const fg = REEL.S.fight; return fg && Math.abs(fg.pos - fg.win[0]) < fg.win[1] * .6; })()")
                    if ok: await page.keyboard.press("Space")
                    await page.wait_for_timeout(30)
                print(tag, name, "after fight:", await page.evaluate("JSON.stringify([REEL.S.state, REEL.S.catch])"))
            # jump to just above the floor and ride back up
            await page.evaluate("(() => { REEL.S.hy = 1150 * 6; REEL.S.cam = REEL.S.hy - 78; })()")
            await page.wait_for_timeout(2600); await page.screenshot(path=f"{OUT}/{tag}_rise.png")
            print(tag, "state:", await page.evaluate("JSON.stringify([REEL.S.state, REEL.S.bottom, Math.round(REEL.S.hy / 6)])"))
            await page.evaluate("(() => { const v = REEL.visible().filter(([i, f]) => f.id !== 'jelly'); REEL.land(v[0][0], v[0][1]); })()")
            await page.wait_for_timeout(9000); await page.screenshot(path=f"{OUT}/{tag}_haul.png")
            print(tag, "haul:", await page.evaluate("JSON.stringify(REEL.S.haul && [REEL.S.haul.total, REEL.S.haul.mult, REEL.S.haul.extra.map(e => e[0]), REEL.S.haul.news.map(e => e[0])])"), "errors", errs)
        await b.close()
asyncio.run(main())
