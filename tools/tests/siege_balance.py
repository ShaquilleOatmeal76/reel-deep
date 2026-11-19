"""Siege of the Deep balance check: the bot (siege_bot.js) plays every map with two hero kits and prints win/loss,
hull left and the wave reached. Serve the repo first (python3 -m http.server 8765 --bind 127.0.0.1), then:
  python3 tools/tests/siege_balance.py                 # no research: a player partway through
  python3 tools/tests/siege_balance.py --res           # everything researched, every zone open: a late-game player
  python3 tools/tests/siege_balance.py --res 9,10      # only some zones
  python3 tools/tests/siege_balance.py "Object.assign(SIEGE.TUNE, {b2: 0.2})"   # try other numbers without editing
As shipped (Nov 19, 2026): without research the bot clears zones 0-3 and much of 4-9; with research it wins nearly
everything except the Floor, which is the hardest (the Sleeper usually beats it at the very end)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
RES = "true" if "--res" in sys.argv else "false"
args = [a for a in sys.argv[1:] if a != "--res"]
setup = next((a for a in args if "(" in a), "")
zones = next((a for a in args if "(" not in a), "")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 960, "height": 540})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8765/index.html?siege"); await pg.wait_for_timeout(800)
        await pg.add_script_tag(path=os.path.join(HERE, "siege_bot.js"))
        if setup: await pg.evaluate(setup)
        ids = [i for i in await pg.evaluate("Object.keys(SIEGE.SMAPS)") if not zones or i.split(".")[0] in zones.split(",")]
        for mid in ids:
            rs = [await pg.evaluate(f"siegeBot('{mid}', 1.0, 1500, {{kit: {k}, research: {RES}}})") for k in (0, 2)]
            print(mid, " ".join(f"{'W' if r['won'] else 'L'}{r['hull']:>2} w{r['wave']}/{r['of']}" for r in rs), flush=True)
        await pg.evaluate("REEL.store.siege = undefined")
        print("errors:", errs[:3]); await b.close()


asyncio.run(main())
