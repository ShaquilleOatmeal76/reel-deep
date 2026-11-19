"""Chip economy part 3 (Nov 18, 2026): Crown & Anchor, the Reel Deal, the Ship's Wheel.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino3.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino3/."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino3"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


FAST = "(() => { window._addChips = window._addChips || addChips; window.addChips = (n, why) => { const q = REEL.tav(); q.chips = Math.max(0, q.chips + n); return n; }; })()"
SLOW = "(() => { window.addChips = window._addChips; })()"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.tav().chips = 5000; })()")

        r = await ev("(() => [CASINO.HUBS.tables.games.map(g => g[0]), CASINO.HUBS.machines.games.map(g => g[0])])()")
        check("menus list the new games", "crown" in r[0] and "reel" in r[1] and "wheel" in r[1], r)

        # ---- exact paybacks
        r = await ev("""(() => { let e = 0; for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) e += CASINO.CA_PAY[[a, b, c].filter(d => d === 0).length]; return e / 216; })()""")
        check("crown & anchor: exactly 205/216 = 94.9%", abs(r - 205 / 216) < 1e-9, r)
        r = await ev("""(() => { const S = CASINO.RD_STRIPS; let e = 0, hit = 0, n = 0; for (const a of S[0]) for (const b of S[1]) for (const c of S[2]) { const x = CASINO.rdPays([a, b, c]); e += x; if (x > 1) hit++; n++; } return [e / n, hit / n, S.map(s => s.length)]; })()""")
        check("reel deal: every stop counted, 93.5-96% back from the reels, ~25% of spins win", 0.935 < r[0] < 0.96 and 0.2 < r[1] < 0.3 and r[2] == [24, 24, 24], r)
        print("  reel deal exact payback %.4f, hit rate %.3f" % (r[0], r[1]))
        r = await ev("""(() => { const W = CASINO.WH_SEG, c = {}; W.forEach(v => c[v] = (c[v] || 0) + 1); return [W.reduce((a, v) => a + v, 0) / W.length, c]; })()""")
        check("ship's wheel: 24 x0, 8 x1, 5 x2, 2 x5, 1 x10 = 95%", abs(r[0] - 0.95) < 1e-9 and r[1] == {"0": 24, "1": 8, "2": 5, "5": 2, "10": 1}, r)

        # ---- played for real (fast chips)
        await ev(FAST)
        r = await ev("""(() => { CASINO.GAME_OPEN.crown(); const c = CASINO.ca; c.bet = 50; REEL.tav().chips = 1e9; let st = 0, back = 0;
            for (let i = 0; i < 40000; i++) { c.pick = i % 6; const c0 = REEL.tav().chips; CASINO.caRoll(); CASINO.caTick(1); st += 50; back += REEL.tav().chips - c0 + 50; } return back / st; })()""")
        check("crown & anchor played 40,000 times: ~95% back", abs(r - 0.949) < 0.02, r)
        r = await ev("""(() => { CASINO.GAME_OPEN.reel(); const c = CASINO.rd; c.bet = 50; REEL.tav().chips = 1e9; let st = 0, back = 0;
            for (let i = 0; i < 40000; i++) { const c0 = REEL.tav().chips; CASINO.rdSpin(); for (let k = 0; k < 40 && c.phase === 'spin'; k++) CASINO.rdTick(0.05); st += 50; back += REEL.tav().chips - c0 + 50; } return back / st; })()""")
        check("reel deal played 40,000 times: ~94-95% back", abs(r - 0.945) < 0.06, r)
        r = await ev("""(() => { CASINO.GAME_OPEN.wheel(); const c = CASINO.wh; c.bet = 50; REEL.tav().chips = 1e9; let st = 0, back = 0, wrong = 0;
            for (let i = 0; i < 6000; i++) { const c0 = REEL.tav().chips; CASINO.whSpin(); for (let k = 0; k < 80 && c.phase === 'spin'; k++) CASINO.whTick(0.05);
              const a = ((Math.PI * 2 - (c.ang % (Math.PI * 2))) % (Math.PI * 2)), under = Math.floor(a / (Math.PI * 2) * 40) % 40; if (under !== c.seg) wrong++;
              st += 50; back += REEL.tav().chips - c0 + 50; } return [back / st, wrong]; })()""")
        check("ship's wheel: the pointer always stops on the segment that pays", r[1] == 0, r)
        check("ship's wheel played 6,000 times: ~95% back", abs(r[0] - 0.95) < 0.08, r)
        r = await ev("""(() => { REEL.tav().chips = 3; CASINO.caOpen && 0; const c = CASINO.ca; c.phase = 'done'; c.bet = 10; CASINO.caRoll(); return [c.phase, REEL.tav().chips]; })()""")
        check("can't roll without the chips", r == ["done", 3], r)
        await ev(SLOW)

        r = await ev("""(() => { const out = []; for (const g of ['crown', 'reel', 'wheel']) { REEL.tav().chips = 5000; CASINO.GAME_OPEN[g](); closeOverlay(); out.push(REEL.S.overlay); } return out; })()""")
        check("Back from each returns to its menu", r == ["tables", "machines", "machines"], r)

        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(150)
            for g, js in (("crown", "CASINO.caRoll(); CASINO.caTick(1);"), ("reel", "CASINO.rdSpin(); for (let k = 0; k < 40; k++) CASINO.rdTick(0.05);"), ("wheel", "CASINO.whSpin(); for (let k = 0; k < 70; k++) CASINO.whTick(0.05);")):
                await ev("(() => { REEL.tav().chips = 5000; CASINO.GAME_OPEN.%s(); %s })()" % (g, js)); await page.wait_for_timeout(120)
                await page.screenshot(path=OUT + "/%s_%s.png" % (g, tag))
            await ev("(() => { REEL.S.overlay = 'machines'; })()"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/machines_%s.png" % tag)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
