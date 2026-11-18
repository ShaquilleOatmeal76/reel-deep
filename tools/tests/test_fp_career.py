# FIN PRIX career: opens THE PIT on PC and phone (screenshots), buys a kart body, plays a whole Minnow Cup and two
# time trials with a robot driving, and prints the medal, chips, records and ghost. Serve the repo on port 8000 first.
import asyncio, json
from playwright.async_api import async_playwright
O = "/tmp/fp_career_"
DRIVE = """() => { const K = FPX.KART; K.me.bot = { noise: 0, lag: 0, lv: [10,10,10] }; let n = 0; while (K.phase !== 'done' && n < 60 * 400) { FPX.kartUpdate(1/60); n++; } return [K.phase, K.me.place]; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, vp in (("pc", {"width": 1440, "height": 810}), ("phone", {"width": 390, "height": 760})):
            page = await (await b.new_context(viewport=vp)).new_page()
            errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
            await page.route("**/*firebase*/**", lambda r: r.abort())
            await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.FPX && window.REEL && REEL.S")
            await page.evaluate("const s = REEL.store; s.dives = 30; s.seenHelp = true; s.tav.chips = 5000; s.tav.fish = { name: 'SPEEDY', id: 'koi', lv: [8, 8, 8], races: 0, wins: 0 }; REEL.S.overlay = 'tavern'")
            await page.wait_for_timeout(300); await page.screenshot(path=O + name + "_tavern.png")
            for tab in ("cups", "trial", "garage", "train"):
                await page.evaluate(f"FPX.pitOpen('{tab}')"); await page.wait_for_timeout(300); await page.screenshot(path=O + f"{name}_pit_{tab}.png")
            if name == "phone": print(name, "errors", errs[:4]); continue
            # buy + equip a body via the garage
            await page.evaluate("FPX.pitOpen('garage'); FPX.PIT.cat = 0; FPX.pitAct('look', 1); FPX.pitAct('look', 1)")
            print("bought sub:", await page.evaluate("[REEL.store.tav.fp.own, REEL.store.tav.fp.eq, REEL.store.tav.chips]"))
            # a whole Minnow Cup with a robot driving
            await page.evaluate("FPX.fpStartCup(0)")
            for i in range(3):
                print("race", i + 1, await page.evaluate(DRIVE))
                await page.wait_for_timeout(200); await page.screenshot(path=O + f"cup_race{i+1}.png")
                await page.evaluate("FPX.fpNext()")
            await page.wait_for_timeout(300); await page.screenshot(path=O + "cup_done.png")
            print("cup:", await page.evaluate("[FPX.KART.cupEnd.medal, FPX.KART.cupEnd.chips, FPX.KART.cupEnd.got, REEL.store.tav.fp.cups, REEL.store.titles.slice(-2)]"))
            await page.evaluate("FPX.fpNext()"); await page.wait_for_timeout(200)
            print("back to:", await page.evaluate("[REEL.S.overlay, !!FPX.KART]"))
            # time trial twice (second one has a ghost)
            for k in range(2):
                await page.evaluate("FPX.PIT.track = 'kelp'; FPX.pitAct('race')")
                if k == 1:
                    await page.evaluate("const K = FPX.KART; K.me.bot = { noise: 0.05, lag: 0.05, lv: [10,10,10] }; while (K.me.lap < 1 || FPX.KART.t < 40) FPX.kartUpdate(1/60);")
                    await page.wait_for_timeout(200); await page.screenshot(path=O + "tt_ghost.png")
                print("tt", k, await page.evaluate(DRIVE))
                await page.wait_for_timeout(200); await page.screenshot(path=O + f"tt_done{k}.png")
                print("best:", await page.evaluate("[REEL.store.tav.fp.best, REEL.store.tav.stats.fast, Object.keys(JSON.parse(localStorage.getItem('reeldeep_ghosts') || '{}'))]"))
                await page.evaluate("FPX.fpExit()")
            await page.evaluate("FPX.pitOpen('cups')"); await page.wait_for_timeout(200); await page.screenshot(path=O + "pc_pit_after.png")
            print(name, "errors", errs[:4])
        await b.close()
asyncio.run(main())
