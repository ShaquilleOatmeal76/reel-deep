# Derby price check: prices 10 races, runs each of them 40,000 more times to measure every bet's real chance, and
# reports the true payback per bet type. All five should sit near 0.95 (EDGE).
# Serve the repo first:  python3 -m http.server 8000   then:  python3 tools/tests/test_derby.py
# Nov 18, 2026: [WIN 0.952, PLACE 0.952, SHOW 0.95, EXACTA 0.95, TRIFECTA 0.949]. If you change raceStep, racerMods,
# the stable, or the Harville correction in derbyPays (the 0.98 / 0.94 divisors), re-run this.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); page = await (await b.new_context(viewport={"width": 1440, "height": 810})).new_page()
        await page.route("**/*firebase*/**", lambda r: r.abort())
        await page.goto("http://localhost:8000/index.html"); await page.wait_for_function("window.DERBY && window.REEL && REEL.S")
        r = await page.evaluate("DERBY.exact(10, 40000)")
        print("true payback [WIN, PLACE, SHOW, EXACTA, TRIFECTA]:", r)
        await b.close()
asyncio.run(main())
