"""Chip economy part 4 (Nov 18, 2026): Treasure Dive and Net Haul.
Run from the repo root:  python3 -m http.server 8765 &  then  python3 tools/tests/test_casino4.py
Writes to the live database are blocked. Screenshots go to tools/tests/casino4/."""
import asyncio, os, sys
from math import comb
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8765/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "casino4"); os.makedirs(OUT, exist_ok=True)
fails = []


def check(name, ok, info=""):
    print(("PASS " if ok else "FAIL ") + name + (" " + str(info) if info and not ok else ""))
    if not ok: fails.append(name)


FAST = "(() => { window._addChips = window._addChips || addChips; window.addChips = (n) => { const q = REEL.tav(); q.chips = Math.max(0, q.chips + n); return n; }; })()"
SLOW = "(() => { window.addChips = window._addChips; })()"


async def main():
    # exact keno payback: 8 of 20 drawn, 5 picked
    pay = [0, 0, 0, 2, 6, 40]
    keno = sum(comb(8, m) * comb(12, 5 - m) * pay[m] for m in range(6)) / comb(20, 5)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 810})
        await ctx.route("**/*firebase*/**", lambda r: r.abort())
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(URL); await page.wait_for_function("window.REEL && window.REEL.S")
        ev = page.evaluate
        await ev("(() => { REEL.store.seenHelp = true; REEL.S.overlay = null; REEL.store.dives = 300; REEL.tav().chips = 5000; })()")
        r = await ev("(() => CASINO.HUBS.machines.games.map(g => g[0]))()")
        check("machines menu lists treasure dive and net haul", "treasure" in r and "net" in r, r)
        check("net haul: 20 fish on the board, pays x2/x6/x40", await ev("CASINO.NH_FISH.length === 20 && CASINO.NH_PAY.join() === '0,0,0,2,6,40'"))
        check("net haul exact payback 94.6%", abs(keno - 0.946) < 0.001, keno)
        # treasure dive: payout after k safe crates x chance of getting there = 0.95 for every k and jelly count
        r = await ev("""(() => { const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; }; const bad = [];
            for (const j of [1, 3, 5, 10]) for (let k = 1; k <= 25 - j; k++) { const ev = CASINO.tdMult(k, j) * C(25 - j, k) / C(25, k); if (Math.abs(ev - 0.95) > 1e-9) bad.push([j, k, ev]); } return bad; })()""")
        check("treasure dive: every cash-out point pays back exactly 95% before rounding", not r, r[:3])

        await ev(FAST)
        r = await ev("""(() => { CASINO.GAME_OPEN.treasure(); const c = CASINO.td; c.bet = 50; const out = {};
            for (const [j, k] of [[1, 5], [3, 3], [5, 2], [10, 2]]) { c.j = j; REEL.tav().chips = 1e9; let st = 0, back = 0;
              for (let i = 0; i < 30000; i++) { const c0 = REEL.tav().chips; CASINO.tdStart(); const order = [...Array(25).keys()].sort(() => Math.random() - 0.5);
                for (const x of order) { if (c.phase !== 'dive' || c.k >= k) break; CASINO.tdPick(x); } if (c.phase === 'dive') CASINO.tdCash(); st += 50; back += REEL.tav().chips - c0 + 50; }
              out[j + 'j' + k] = back / st; } return out; })()""")
        print("  treasure dive payback:", {k: round(v, 3) for k, v in r.items()})
        check("treasure dive played out: ~95% back for each jelly count", all(abs(v - 0.95) < 0.04 for v in r.values()), r)
        r = await ev("""(() => { CASINO.GAME_OPEN.net(); const c = CASINO.nh; c.bet = 50; REEL.tav().chips = 1e9; let st = 0, back = 0;
            for (let i = 0; i < 30000; i++) { const c0 = REEL.tav().chips; CASINO.nhQuick(); CASINO.nhCast(); for (let k = 0; k < 30 && c.phase === 'draw'; k++) CASINO.nhTick(0.1); st += 50; back += REEL.tav().chips - c0 + 50; } return back / st; })()""")
        check("net haul played 30,000 times: ~95% back", abs(r - keno) < 0.03, r)
        r = await ev("""(() => { const c = CASINO.td; REEL.tav().chips = 1000; c.phase = 'stake'; CASINO.tdStart(); const b0 = REEL.tav().chips; CASINO.tdCash(); return [c.phase, REEL.tav().chips === b0]; })()""")
        check("treasure dive: can't surface before opening a crate", r == ["dive", True], r)
        r = await ev("""(() => { const c = CASINO.td; CASINO.tdPick(c.jel[0]); return [c.phase, c.win]; })()""")
        check("treasure dive: a jelly loses the stake", r == ["done", 0], r)
        r = await ev("""(() => { const c = CASINO.nh; c.phase = 'pick'; c.picks = [0, 1, 2]; const b0 = REEL.tav().chips; CASINO.nhCast(); return [c.phase, REEL.tav().chips === b0]; })()""")
        check("net haul: no cast without 5 picks", r == ["pick", True], r)
        await ev(SLOW)
        r = await ev("""(() => { const out = []; for (const g of ['treasure', 'net']) { REEL.tav().chips = 5000; CASINO.GAME_OPEN[g](); CASINO[g === 'treasure' ? 'td' : 'nh'].phase = g === 'treasure' ? 'stake' : 'pick'; closeOverlay(); out.push(REEL.S.overlay); } return out; })()""")
        check("Back from each returns to the machines", r == ["machines", "machines"], r)

        for w, h, tag in ((1440, 810, "wide"), (390, 700, "phone")):
            await page.set_viewport_size({"width": w, "height": h}); await page.wait_for_timeout(150)
            await ev("(() => { REEL.tav().chips = 5000; CASINO.GAME_OPEN.treasure(); CASINO.td.phase = 'stake'; CASINO.tdStart(); const c = CASINO.td; for (let i = 0; i < 25 && c.k < 3; i++) if (!c.jel.includes(i)) CASINO.tdPick(i); })()")
            await page.wait_for_timeout(120); await page.screenshot(path=OUT + "/treasure_%s.png" % tag)
            await ev("(() => { CASINO.tdCash(); CASINO.GAME_OPEN.net(); CASINO.nhQuick(); CASINO.nhCast(); for (let k = 0; k < 30; k++) CASINO.nhTick(0.1); })()")
            await page.wait_for_timeout(120); await page.screenshot(path=OUT + "/net_%s.png" % tag)
            await ev("(() => { REEL.S.overlay = 'machines'; })()"); await page.wait_for_timeout(100); await page.screenshot(path=OUT + "/machines_%s.png" % tag)
        check("no page errors", not errs, errs[:3])
        await b.close()
    print("\n%d failed" % len(fails) if fails else "\nall passed")
    sys.exit(1 if fails else 0)

asyncio.run(main())
